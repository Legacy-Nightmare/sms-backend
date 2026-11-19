import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { StudentsService } from '../students/students.service';
import { StudentFeesService } from './student-fees.service';
import { AcademicsService } from '../academics/academics.service';
import { AdmitCardDownloadDto, AdmitCardExamsLookupDto } from './dto/admit-card-public.dto';
import { verifyRecaptcha } from '../platform/recaptcha.util';

// No guards — this is the public "download my admit card" flow on the
// school website, reachable by anonymous guardians who identify their
// child by class/section/roll instead of logging in. Same discipline as
// PublicController: never return more than this flow strictly needs (no
// amounts, no payment history, no guardian contact info), and keep "not
// found" vs "found but not paid" responses generic enough that this can't
// be used to enumerate which rolls exist in a class.
@ApiTags('public')
@Controller('public/admit-card')
export class AdmitCardPublicController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentFeesService: StudentFeesService,
    private readonly academicsService: AcademicsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('classes')
  async getClasses() {
    const classes = await this.academicsService.findAllClasses();
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
    }));
  }

  @Post('exams')
  async getExams(@Body() dto: AdmitCardExamsLookupDto) {
    const student = await this.studentsService.findByClassSectionRoll(
      dto.classId,
      dto.sectionId,
      dto.roll,
    );
    // No student at that class/section/roll — same empty list as a student
    // with no admit-card-eligible exams yet, so this can't be used to probe
    // for which rolls exist.
    if (!student) return { exams: [] };

    const exams = await this.studentFeesService.listExamsIssuingAdmitCard(dto.classId);
    return { exams };
  }

  @Post('download')
  async download(@Body() dto: AdmitCardDownloadDto) {
    await verifyRecaptcha(dto.recaptchaToken, this.configService.get<string>('RECAPTCHA_SECRET_KEY'));

    const student = await this.studentsService.findByClassSectionRoll(
      dto.classId,
      dto.sectionId,
      dto.roll,
    );
    if (!student) {
      return {
        eligible: false,
        reason: 'NOT_FOUND',
        message: 'No student was found matching these details. Please double-check and try again.',
      };
    }

    const fee = await this.studentFeesService.findFeeForExam(student.id, dto.examId);
    if (!fee) {
      return {
        eligible: false,
        reason: 'NOT_BILLED',
        message:
          'The examination fee for this exam has not been billed for this student yet. Please contact the school office.',
      };
    }
    if (fee.remaining > 0) {
      return {
        eligible: false,
        reason: 'UNPAID',
        message:
          'Payment is not complete, or has not yet been updated in the system. Please contact the school office.',
      };
    }

    // Fetched server-side (same reasoning as StudentsController's own
    // photo proxy: the storage bucket sends no CORS headers, so this can't
    // be fetched from the browser) and returned inline as a data URL —
    // there's no admin bearer token available on this public page to use
    // the authenticated photo-proxy route instead.
    let photoDataUrl: string | null = null;
    if (student.photoUrl) {
      try {
        const upstream = await fetch(student.photoUrl);
        if (upstream.ok) {
          const buffer = Buffer.from(await upstream.arrayBuffer());
          const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
          photoDataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      } catch {
        // Storage unreachable — the card still works without a photo.
      }
    }

    return {
      eligible: true,
      admitCard: {
        studentName: student.name,
        studentCode: student.code,
        roll: student.roll,
        className: student.classEntity.name,
        sectionName: student.section.name,
        examName: fee.examName,
        photoDataUrl,
      },
    };
  }
}
