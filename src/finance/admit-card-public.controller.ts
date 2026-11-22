import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AppThrottlerGuard } from '../common/guards/app-throttler.guard';
import { StudentsService } from '../students/students.service';
import { StudentFeesService } from './student-fees.service';
import { AcademicsService } from '../academics/academics.service';
import { AdmitCardDownloadDto, AdmitCardExamsLookupDto } from './dto/admit-card-public.dto';
import { verifyRecaptcha } from '../platform/recaptcha.util';

// The admin "date of birth" field is free text (no date picker, see
// add-student-drawer.tsx), so legacy records may not be in the public
// form's strict YYYY-MM-DD. Comparing parsed calendar dates instead of
// raw strings means a differently-formatted but equal date still
// matches; an unparseable stored value is treated as "no DOB on file"
// rather than permanently locking that student out of this page.
function toCalendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

// No auth guards — this is the public "download my admit card" flow on
// the school website, reachable by anonymous guardians who identify their
// child by class/section/roll instead of logging in. Same discipline as
// PublicController: never return more than this flow strictly needs (no
// amounts, no payment history, no guardian contact info), and keep "not
// found" vs "found but not paid" responses generic enough that this can't
// be used to enumerate which rolls exist in a class. ThrottlerGuard is
// tighter here than the app default (F-27: 100 lookups in 0.3s went
// through unrefused) since class+section+roll is a small, guessable space.
@ApiTags('public')
@Controller('public/admit-card')
@UseGuards(AppThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
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
    // Deliberately doesn't look up the student at all — this is purely
    // "what exams does this class have," the same for every roll whether
    // or not it exists. Returning a different shape for a real vs. fake
    // roll would let this be used to probe which rolls are enrolled;
    // the one check that actually needs the student (download, below)
    // answers with the same generic message either way.
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
    // Same generic message whether class/section/roll didn't match at all,
    // or matched but the date of birth didn't — telling the two apart
    // would confirm a real roll exists even when the DOB guess is wrong.
    const notFound = {
      eligible: false,
      reason: 'NOT_FOUND' as const,
      message: 'No student was found matching these details. Please double-check and try again.',
    };
    if (!student) return notFound;
    const storedDob = toCalendarDate(student.dateOfBirth);
    if (storedDob && storedDob !== toCalendarDate(dto.dateOfBirth)) return notFound;

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
    // The exam picker (getExams above) already filters to
    // issuesAdmitCard=true exams, but that's a client-side convenience —
    // a direct request could still name an examId never meant to issue
    // one, so it's re-checked here too.
    if (!fee.issuesAdmitCard) {
      return {
        eligible: false,
        reason: 'NO_ADMIT_CARD',
        message: 'No admit card is issued for this exam. Please contact the school office.',
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

    // studentCode deliberately left out (F-28) — it's never printed on the
    // card itself (confirmed in testing: no student ID shown), only used
    // for the downloaded file's name, and the frontend can build a safe
    // substitute from the roll number instead of this being one more
    // identifying field handed back to an unauthenticated caller.
    return {
      eligible: true,
      admitCard: {
        studentName: student.name,
        roll: student.roll,
        className: student.classEntity.name,
        sectionName: student.section.name,
        examName: fee.examName,
        photoDataUrl,
      },
    };
  }
}
