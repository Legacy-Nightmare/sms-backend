import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { EnterMarksDto } from './dto/enter-marks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('exams')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('subjects')
  @Roles(Role.ADMIN)
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.examsService.createSubject(dto);
  }

  @Get('subjects')
  findSubjects(@Query('classId', ParseIntPipe) classId: number) {
    return this.examsService.findSubjectsByClass(classId);
  }

  @Put('subjects/:id')
  @Roles(Role.ADMIN)
  updateSubject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.examsService.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  @Roles(Role.ADMIN)
  removeSubject(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.removeSubject(id);
  }

  @Post('exams')
  @Roles(Role.ADMIN)
  createExam(@Body() dto: CreateExamDto) {
    return this.examsService.createExam(dto);
  }

  @Put('exams/:id')
  @Roles(Role.ADMIN)
  updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.updateExam(id, dto);
  }

  @Get('exams')
  findExams(
    @Query('classId') classId?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.examsService.findExams(
      classId ? parseInt(classId, 10) : undefined,
      academicYear,
    );
  }

  @Get('exams/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.findExamById(id);
  }

  @Post('exams/:id/marks')
  @Roles(Role.ADMIN, Role.TEACHER)
  enterMarks(
    @Param('id', ParseIntPipe) examId: number,
    @Body() dto: EnterMarksDto,
  ) {
    return this.examsService.enterMarks(examId, dto);
  }

  @Get('exams/:id/marks-sheet')
  @Roles(Role.ADMIN, Role.TEACHER)
  getMarksSheet(
    @Param('id', ParseIntPipe) examId: number,
    @Query('subjectId', ParseIntPipe) subjectId: number,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.examsService.getMarksSheet(
      examId,
      subjectId,
      sectionId ? parseInt(sectionId, 10) : undefined,
    );
  }

  @Get('exams/:id/results')
  getResults(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.getResultsForExam(examId);
  }

  @Get('exams/:id/results/:studentId')
  getStudentResult(
    @Param('id', ParseIntPipe) examId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.examsService.getStudentResult(examId, studentId);
  }

  @Get('classes/:classId/students/:studentId/semester-result')
  getSemesterResult(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('academicYear') academicYear: string,
  ) {
    return this.examsService.getCombinedResult(
      classId,
      studentId,
      academicYear,
    );
  }

  @Post('exams/:id/publish')
  @Roles(Role.ADMIN)
  publish(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.publishExam(examId);
  }

  @Post('exams/:id/notify-guardians')
  @Roles(Role.ADMIN)
  notifyGuardians(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.notifyGuardians(examId);
  }

  @Post('exams/:id/publish-and-notify')
  @Roles(Role.ADMIN)
  publishAndNotify(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.publishAndNotify(examId);
  }

  @Post('exams/:id/announce-results')
  @Roles(Role.ADMIN)
  announceResultsOnWebsite(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.announceResultsOnWebsite(examId);
  }

  @Post('exams/:id/retract-results-announcement')
  @Roles(Role.ADMIN)
  retractResultsAnnouncement(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.retractResultsAnnouncement(examId);
  }

  @Delete('exams/:id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) examId: number) {
    return this.examsService.deleteExam(examId);
  }
}
