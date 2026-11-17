import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { Exam, ExamComponent, ExamType } from './entities/exam.entity';
import { Mark } from './entities/mark.entity';
import { TeacherClassSubject } from '../teachers/entities/teacher-class-subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { EnterMarksDto } from './dto/enter-marks.dto';
import { gradeForPercentage } from './grading';
import { StudentsService } from '../students/students.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AcademicsService } from '../academics/academics.service';
import { SubjectsService } from '../subjects/subjects.service';
import { UsersService } from '../users/users.service';
import { AttendanceService } from '../attendance/attendance.service';
import { Role } from '../common/enums/role.enum';

// Identifies the caller for the assignment check below — admins bypass it
// entirely, so only role+userId are needed, not the full user record.
export interface MarksRequester {
  userId: number;
  role: Role;
}

export interface SubjectResult {
  subjectId: number;
  subjectName: string;
  marksObtained: number;
  fullMarks: number;
}

export interface StudentExamResult {
  studentId: number;
  studentName: string;
  studentCode: string;
  subjects: SubjectResult[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  gpa: number;
  hasGuardianEmail: boolean;
}

export interface CombinedSubjectResult {
  subjectId: number;
  subjectName: string;
  fullMarks: number;
  tutorialMarks: number | null;
  finalMarks: number | null;
  combinedMarks: number;
}

export interface CombinedStudentResult {
  studentId: number;
  studentName: string;
  studentCode: string;
  academicYear: string;
  tutorialExam: { id: number; name: string } | null;
  finalExam: { id: number; name: string } | null;
  tutorialWeightPercent: number;
  finalWeightPercent: number;
  subjects: CombinedSubjectResult[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  gpa: number;
}

export interface ProgressReportSubject {
  subjectId: number;
  subjectName: string;
  fullMarks: number;
  ct1Marks: number | null;
  ct2Marks: number | null;
  semesterFinalMarks: number | null;
  totalMarks: number;
  highestMarks: number;
  gradePoint: number;
  letterGrade: string;
}

export interface ProgressReport {
  studentId: number;
  studentName: string;
  studentCode: string;
  roll: number;
  className: string;
  sectionName: string;
  academicYear: string;
  examTitle: string;
  subjects: ProgressReportSubject[];
  totalFullMarks: number;
  totalObtained: number;
  gpa: number;
  letterGrade: string;
  position: number;
  totalStudents: number;
  totalWorkingDays: number | null;
  totalAttendances: number | null;
}

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    @InjectRepository(Exam)
    private readonly examsRepo: Repository<Exam>,
    @InjectRepository(Mark)
    private readonly marksRepo: Repository<Mark>,
    @InjectRepository(TeacherClassSubject)
    private readonly teacherClassSubjectsRepo: Repository<TeacherClassSubject>,
    private readonly studentsService: StudentsService,
    private readonly notificationsService: NotificationsService,
    private readonly academicsService: AcademicsService,
    private readonly subjectsService: SubjectsService,
    private readonly usersService: UsersService,
    private readonly attendanceService: AttendanceService,
  ) {}

  // Admins can enter marks for anything; a teacher account can only enter
  // marks for a class_subjects row they're actually assigned to (via
  // teacher_class_subjects) — never any other class or subject, even ones
  // on a class they do teach some other subject in.
  private async assertTeacherAssignedToSubject(
    requester: MarksRequester,
    classSubjectId: number,
  ): Promise<void> {
    if (requester.role !== Role.TEACHER) {
      return;
    }
    const user = await this.usersService.findById(requester.userId);
    if (!user.teacherId) {
      throw new ForbiddenException(
        'Your account is not linked to a teacher profile — ask an admin to link it under Staff accounts',
      );
    }
    const assignment = await this.teacherClassSubjectsRepo.findOne({
      where: { teacherId: user.teacherId, classSubjectId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this class/subject');
    }
  }

  // CT1 + CT2 + Semester Final must either all be provided (and sum to
  // fullMarks) or all be left out — a subject either has a progress-report
  // split configured or it doesn't, no half-configured state.
  private validateComponentSplit(
    fullMarks: number,
    ct1: number | null | undefined,
    ct2: number | null | undefined,
    semesterFinal: number | null | undefined,
  ): { ct1FullMarks: number | null; ct2FullMarks: number | null; semesterFinalFullMarks: number | null } {
    const provided = [ct1, ct2, semesterFinal].filter(
      (v): v is number => v !== undefined && v !== null,
    );
    if (provided.length === 0) {
      return { ct1FullMarks: null, ct2FullMarks: null, semesterFinalFullMarks: null };
    }
    if (provided.length !== 3) {
      throw new BadRequestException(
        "Provide CT1, CT2, and Semester Final full marks together, or leave all three blank",
      );
    }
    const sum = (ct1 as number) + (ct2 as number) + (semesterFinal as number);
    if (sum !== fullMarks) {
      throw new BadRequestException(
        `CT1 + CT2 + Semester Final (${sum}) must add up to this subject's full marks (${fullMarks})`,
      );
    }
    return {
      ct1FullMarks: ct1 as number,
      ct2FullMarks: ct2 as number,
      semesterFinalFullMarks: semesterFinal as number,
    };
  }

  async createSubject(dto: CreateSubjectDto): Promise<Subject> {
    const existing = await this.subjectsRepo.findOne({
      where: { classId: dto.classId, subjectId: dto.subjectId },
    });
    if (existing) {
      throw new ConflictException('This subject is already added to this class');
    }
    const catalogSubject = await this.subjectsService.findById(dto.subjectId);
    const fullMarks = dto.fullMarks ?? catalogSubject.defaultFullMarks ?? 100;
    const split = this.validateComponentSplit(
      fullMarks,
      dto.ct1FullMarks,
      dto.ct2FullMarks,
      dto.semesterFinalFullMarks,
    );
    const subject = this.subjectsRepo.create({
      classId: dto.classId,
      subjectId: dto.subjectId,
      name: catalogSubject.name,
      fullMarks,
      ...split,
    });
    return this.subjectsRepo.save(subject);
  }

  findSubjectsByClass(classId: number): Promise<Subject[]> {
    return this.subjectsRepo.find({ where: { classId } });
  }

  findAllSubjectsWithClass(): Promise<
    Array<{
      id: number;
      name: string;
      fullMarks: number;
      classId: number;
      classLevel: number | null;
      className: string;
      classSortOrder: number;
    }>
  > {
    return this.subjectsRepo.manager.query(
      `SELECT cs.id AS "id", cs.name AS "name", cs.full_marks AS "fullMarks",
              cs.class_id AS "classId", c.level AS "classLevel", c.name AS "className",
              c.sort_order AS "classSortOrder"
       FROM class_subjects cs
       JOIN classes c ON c.id = cs.class_id
       ORDER BY c.sort_order, cs.name`,
    );
  }

  async updateSubject(id: number, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    const split = this.validateComponentSplit(
      dto.fullMarks,
      dto.ct1FullMarks,
      dto.ct2FullMarks,
      dto.semesterFinalFullMarks,
    );
    await this.subjectsRepo.update(id, { fullMarks: dto.fullMarks, ...split });
    return this.subjectsRepo.findOneByOrFail({ id });
  }

  // Blocked (not cascaded) if marks already exist — silently wiping entered
  // marks because a subject got deleted would be a nasty surprise for
  // whoever entered them.
  async removeSubject(id: number): Promise<void> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    const markCount = await this.marksRepo.count({ where: { subjectId: id } });
    if (markCount > 0) {
      throw new ConflictException(
        `Cannot delete "${subject.name}" — marks have already been entered for it (${markCount} record(s)). Remove those exam results first.`,
      );
    }
    await this.subjectsRepo.delete(id);
  }

  async createExam(dto: CreateExamDto): Promise<Exam> {
    const exam = this.examsRepo.create(dto);
    return this.examsRepo.save(exam);
  }

  async updateExam(examId: number, dto: UpdateExamDto): Promise<Exam> {
    const exam = await this.findExamById(examId);
    await this.examsRepo.update(examId, {
      name: dto.name ?? exam.name,
      type: dto.type ?? exam.type,
      sectionId: dto.sectionId !== undefined ? dto.sectionId : exam.sectionId,
      examDate: dto.examDate ?? exam.examDate,
      academicYear: dto.academicYear ?? exam.academicYear,
      component: dto.component !== undefined ? dto.component : exam.component,
      attendancePeriodFrom:
        dto.attendancePeriodFrom !== undefined
          ? dto.attendancePeriodFrom
          : exam.attendancePeriodFrom,
      attendancePeriodTo:
        dto.attendancePeriodTo !== undefined ? dto.attendancePeriodTo : exam.attendancePeriodTo,
      issuesAdmitCard: dto.issuesAdmitCard ?? exam.issuesAdmitCard,
    });
    return this.findExamById(examId);
  }

  // sectionId filters inclusively: an exam explicitly scoped to that
  // section matches, and so does an "all sections" exam (sectionId null) —
  // it covers every section's students, this one included.
  findExams(classId?: number, academicYear?: string, sectionId?: number): Promise<Exam[]> {
    const qb = this.examsRepo
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.classEntity', 'classEntity')
      .leftJoinAndSelect('exam.section', 'section')
      .orderBy('exam.createdAt', 'DESC');
    if (classId) qb.andWhere('exam.classId = :classId', { classId });
    if (academicYear) qb.andWhere('exam.academicYear = :academicYear', { academicYear });
    if (sectionId) {
      qb.andWhere('(exam.sectionId = :sectionId OR exam.sectionId IS NULL)', { sectionId });
    }
    return qb.getMany();
  }

  async findExamById(id: number): Promise<Exam> {
    const exam = await this.examsRepo.findOne({
      where: { id },
      relations: { classEntity: true, section: true },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  // Validates the whole batch against the exam's own class before writing
  // anything, then saves every row inside one transaction — either every
  // mark in the request lands, or (on any validation error, or any DB
  // failure mid-save) none of them do. Two teachers saving the same
  // exam/subject concurrently: last write to commit wins, same as the
  // upsert-on-conflict behavior this already relied on — no optimistic
  // locking, by choice (nothing here is high-stakes enough to justify the
  // UX cost of conflict detection).
  async enterMarks(
    examId: number,
    dto: EnterMarksDto,
    requester: MarksRequester,
  ): Promise<{ saved: number }> {
    const exam = await this.findExamById(examId);

    const [classStudents, classSubjects] = await Promise.all([
      this.studentsService.findAll({
        classId: exam.classId,
        sectionId: exam.sectionId ?? undefined,
      }),
      this.subjectsRepo.find({ where: { classId: exam.classId } }),
    ]);
    const studentIds = new Set(classStudents.map((s) => s.id));
    const subjectsById = new Map(classSubjects.map((s) => [s.id, s]));

    // One check per distinct subject in the batch, not per entry — a
    // teacher submits a whole subject's grid at once, so every entry
    // normally shares the same subjectId anyway.
    const distinctSubjectIds = new Set(dto.entries.map((e) => e.subjectId));
    for (const classSubjectId of distinctSubjectIds) {
      await this.assertTeacherAssignedToSubject(requester, classSubjectId);
    }

    const errors: Array<{
      studentId: number;
      subjectId: number;
      message: string;
    }> = [];
    for (const entry of dto.entries) {
      if (!studentIds.has(entry.studentId)) {
        errors.push({
          studentId: entry.studentId,
          subjectId: entry.subjectId,
          message: "Student is not in this exam's class",
        });
        continue;
      }
      const subject = subjectsById.get(entry.subjectId);
      if (!subject) {
        errors.push({
          studentId: entry.studentId,
          subjectId: entry.subjectId,
          message: "Subject does not belong to this exam's class",
        });
        continue;
      }
      if (entry.marksObtained > subject.fullMarks) {
        errors.push({
          studentId: entry.studentId,
          subjectId: entry.subjectId,
          message: `Marks cannot exceed ${subject.fullMarks} for ${subject.name}`,
        });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: `${errors.length} mark entr${errors.length === 1 ? 'y is' : 'ies are'} invalid`,
        errors,
      });
    }

    await this.marksRepo.manager.transaction(async (manager) => {
      for (const entry of dto.entries) {
        await manager.upsert(
          Mark,
          {
            examId,
            studentId: entry.studentId,
            subjectId: entry.subjectId,
            marksObtained: entry.marksObtained,
          },
          { conflictPaths: ['examId', 'studentId', 'subjectId'] },
        );
      }
    });

    return { saved: dto.entries.length };
  }

  // The bulk-entry grid for one subject: every student in the exam's class
  // (optionally narrowed to one section), each with their current mark for
  // that subject or null if not entered yet.
  async getMarksSheet(
    examId: number,
    subjectId: number,
    sectionId: number | undefined,
    requester: MarksRequester,
  ): Promise<
    Array<{
      studentId: number;
      studentCode: string;
      studentName: string;
      roll: number;
      marksObtained: number | null;
    }>
  > {
    await this.assertTeacherAssignedToSubject(requester, subjectId);
    const exam = await this.findExamById(examId);
    const subject = await this.subjectsRepo.findOne({
      where: { id: subjectId, classId: exam.classId },
    });
    if (!subject) {
      throw new NotFoundException("Subject not found for this exam's class");
    }

    // An exam locked to one section always uses that section, regardless of
    // what's requested — the caller-supplied sectionId only matters for an
    // "all sections" exam, as an optional narrowing filter.
    const students = await this.studentsService.findAll({
      classId: exam.classId,
      sectionId: exam.sectionId ?? sectionId,
    });
    const marks = await this.marksRepo.find({ where: { examId, subjectId } });
    const markByStudent = new Map(
      marks.map((m) => [m.studentId, m.marksObtained]),
    );

    return students
      .map((s) => ({
        studentId: s.id,
        studentCode: s.code,
        studentName: s.name,
        roll: s.roll,
        marksObtained: markByStudent.get(s.id) ?? null,
      }))
      .sort((a, b) => a.roll - b.roll);
  }

  async getStudentResult(
    examId: number,
    studentId: number,
  ): Promise<StudentExamResult> {
    const student = await this.studentsService.findById(studentId);
    const marks = await this.marksRepo.find({
      where: { examId, studentId },
      relations: { subject: true },
    });

    const subjects: SubjectResult[] = marks.map((m) => ({
      subjectId: m.subjectId,
      subjectName: m.subject.name,
      marksObtained: m.marksObtained,
      fullMarks: m.subject.fullMarks,
    }));

    const totalObtained = subjects.reduce((sum, s) => sum + s.marksObtained, 0);
    const totalFullMarks = subjects.reduce((sum, s) => sum + s.fullMarks, 0);
    const percentage =
      totalFullMarks > 0 ? (totalObtained / totalFullMarks) * 100 : 0;
    const { grade, gpa } = gradeForPercentage(percentage);

    return {
      studentId: student.id,
      studentName: student.name,
      studentCode: student.code,
      subjects,
      totalObtained,
      totalFullMarks,
      percentage: Math.round(percentage * 100) / 100,
      grade,
      gpa,
      hasGuardianEmail: student.guardians.some((g) => !!g.email),
    };
  }

  async getResultsForExam(examId: number): Promise<StudentExamResult[]> {
    const exam = await this.findExamById(examId);
    const students = await this.studentsService.findAll({
      classId: exam.classId,
      sectionId: exam.sectionId ?? undefined,
    });
    return Promise.all(
      students.map((s) => this.getStudentResult(examId, s.id)),
    );
  }

  // Combines a student's tutorial and final exam for one class/academic year
  // into one semester result, weighted per the class's configured split.
  // Per subject: both marks are converted to a percentage of that subject's
  // fullMarks (shared by both exams, since fullMarks lives on Subject, not
  // Exam) then blended by weight. If only one of the two exam types exists
  // for this class/year, that exam is used at 100% weight rather than
  // failing — a school can adopt this feature one exam at a time.
  async getCombinedResult(
    classId: number,
    studentId: number,
    academicYear: string,
  ): Promise<CombinedStudentResult> {
    const classEntity = await this.academicsService.findClassById(classId);
    const student = await this.studentsService.findById(studentId);

    const [tutorialExam, finalExam] = await Promise.all([
      this.examsRepo.findOne({
        where: { classId, academicYear, type: ExamType.TUTORIAL },
        order: { createdAt: 'DESC' },
      }),
      this.examsRepo.findOne({
        where: { classId, academicYear, type: ExamType.FINAL },
        order: { createdAt: 'DESC' },
      }),
    ]);

    if (!tutorialExam && !finalExam) {
      throw new NotFoundException(
        `No tutorial or final exam found for this class in ${academicYear}`,
      );
    }

    const [tutorialMarks, finalMarks, subjects] = await Promise.all([
      tutorialExam
        ? this.marksRepo.find({ where: { examId: tutorialExam.id, studentId } })
        : Promise.resolve<Mark[]>([]),
      finalExam
        ? this.marksRepo.find({ where: { examId: finalExam.id, studentId } })
        : Promise.resolve<Mark[]>([]),
      this.subjectsRepo.find({ where: { classId } }),
    ]);
    const tutorialBySubject = new Map<number, number>(
      tutorialMarks.map((m) => [m.subjectId, m.marksObtained]),
    );
    const finalBySubject = new Map<number, number>(
      finalMarks.map((m) => [m.subjectId, m.marksObtained]),
    );

    let tutorialWeight = classEntity.tutorialWeightPercent;
    let finalWeight = classEntity.finalWeightPercent;
    if (!tutorialExam) {
      tutorialWeight = 0;
      finalWeight = 100;
    } else if (!finalExam) {
      tutorialWeight = 100;
      finalWeight = 0;
    }

    const subjectResults: CombinedSubjectResult[] = subjects.map((subject) => {
      const tutorialMarksObtained = tutorialBySubject.get(subject.id) ?? null;
      const finalMarksObtained = finalBySubject.get(subject.id) ?? null;
      const tutorialPct =
        tutorialMarksObtained !== null
          ? (tutorialMarksObtained / subject.fullMarks) * 100
          : 0;
      const finalPct =
        finalMarksObtained !== null
          ? (finalMarksObtained / subject.fullMarks) * 100
          : 0;
      const combinedPct =
        (tutorialPct * tutorialWeight + finalPct * finalWeight) / 100;
      const combinedMarks =
        Math.round(
          ((combinedPct / 100) * subject.fullMarks + Number.EPSILON) * 100,
        ) / 100;

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        fullMarks: subject.fullMarks,
        tutorialMarks: tutorialMarksObtained,
        finalMarks: finalMarksObtained,
        combinedMarks,
      };
    });

    const totalObtained = subjectResults.reduce(
      (sum, s) => sum + s.combinedMarks,
      0,
    );
    const totalFullMarks = subjectResults.reduce(
      (sum, s) => sum + s.fullMarks,
      0,
    );
    const percentage =
      totalFullMarks > 0 ? (totalObtained / totalFullMarks) * 100 : 0;
    const { grade, gpa } = gradeForPercentage(percentage);

    return {
      studentId: student.id,
      studentName: student.name,
      studentCode: student.code,
      academicYear,
      tutorialExam: tutorialExam
        ? { id: tutorialExam.id, name: tutorialExam.name }
        : null,
      finalExam: finalExam ? { id: finalExam.id, name: finalExam.name } : null,
      tutorialWeightPercent: tutorialWeight,
      finalWeightPercent: finalWeight,
      subjects: subjectResults,
      totalObtained: Math.round((totalObtained + Number.EPSILON) * 100) / 100,
      totalFullMarks,
      percentage: Math.round((percentage + Number.EPSILON) * 100) / 100,
      grade,
      gpa,
    };
  }

  // The school's own three-part progress report: CT1 + CT2 + Semester Final
  // raw marks summed per subject (not a weighted blend — see
  // getCombinedResult above for that, separate feature). Ranking/"highest
  // marks" are computed within the student's own section, since that's the
  // group a printed report card is normally compared against.
  async getProgressReport(
    classId: number,
    studentId: number,
    academicYear: string,
  ): Promise<ProgressReport> {
    const student = await this.studentsService.findById(studentId);

    const [ct1Exam, ct2Exam, semesterFinalExam] = await Promise.all([
      this.examsRepo.findOne({
        where: { classId, academicYear, component: ExamComponent.CT1 },
        order: { createdAt: 'DESC' },
      }),
      this.examsRepo.findOne({
        where: { classId, academicYear, component: ExamComponent.CT2 },
        order: { createdAt: 'DESC' },
      }),
      this.examsRepo.findOne({
        where: { classId, academicYear, component: ExamComponent.SEMESTER_FINAL },
        order: { createdAt: 'DESC' },
      }),
    ]);
    if (!ct1Exam && !ct2Exam && !semesterFinalExam) {
      throw new NotFoundException(
        `No progress-report exams (CT1/CT2/Semester Final) found for this class in ${academicYear}`,
      );
    }

    const allSubjects = await this.subjectsRepo.find({ where: { classId } });
    const reportableSubjects = allSubjects.filter(
      (s) =>
        s.ct1FullMarks !== null &&
        s.ct2FullMarks !== null &&
        s.semesterFinalFullMarks !== null,
    );
    if (reportableSubjects.length === 0) {
      throw new BadRequestException(
        'No subjects in this class have a CT1/CT2/Semester Final split configured yet',
      );
    }
    const reportableSubjectIds = new Set(reportableSubjects.map((s) => s.id));

    // Ranking pool = the student's own section, not the whole class — a
    // printed report card's "Position" is normally within one's own
    // section.
    const classmates = await this.studentsService.findAll({
      classId,
      sectionId: student.sectionId,
    });
    const classmateIds = classmates.map((s) => s.id);

    const [ct1Marks, ct2Marks, semesterFinalMarks] = await Promise.all([
      ct1Exam
        ? this.marksRepo.find({ where: { examId: ct1Exam.id, studentId: In(classmateIds) } })
        : Promise.resolve<Mark[]>([]),
      ct2Exam
        ? this.marksRepo.find({ where: { examId: ct2Exam.id, studentId: In(classmateIds) } })
        : Promise.resolve<Mark[]>([]),
      semesterFinalExam
        ? this.marksRepo.find({
            where: { examId: semesterFinalExam.id, studentId: In(classmateIds) },
          })
        : Promise.resolve<Mark[]>([]),
    ]);

    // Per-student, per-subject totals across all three components — feeds
    // both this student's own row and the class-wide "highest marks"/rank.
    const totalsByStudent = new Map<number, Map<number, number>>();
    const addMarks = (marks: Mark[]) => {
      for (const m of marks) {
        if (!reportableSubjectIds.has(m.subjectId)) continue;
        const bySubject = totalsByStudent.get(m.studentId) ?? new Map<number, number>();
        bySubject.set(m.subjectId, (bySubject.get(m.subjectId) ?? 0) + m.marksObtained);
        totalsByStudent.set(m.studentId, bySubject);
      }
    };
    addMarks(ct1Marks);
    addMarks(ct2Marks);
    addMarks(semesterFinalMarks);

    const highestBySubject = new Map<number, number>();
    for (const bySubject of totalsByStudent.values()) {
      for (const [subjectId, total] of bySubject) {
        highestBySubject.set(subjectId, Math.max(highestBySubject.get(subjectId) ?? 0, total));
      }
    }

    const ct1ByStudent = new Map(
      ct1Marks.filter((m) => m.studentId === studentId).map((m) => [m.subjectId, m.marksObtained]),
    );
    const ct2ByStudent = new Map(
      ct2Marks.filter((m) => m.studentId === studentId).map((m) => [m.subjectId, m.marksObtained]),
    );
    const semesterFinalByStudent = new Map(
      semesterFinalMarks
        .filter((m) => m.studentId === studentId)
        .map((m) => [m.subjectId, m.marksObtained]),
    );

    const subjectRows: ProgressReportSubject[] = reportableSubjects.map((s) => {
      const ct1 = ct1ByStudent.get(s.id) ?? null;
      const ct2 = ct2ByStudent.get(s.id) ?? null;
      const semesterFinal = semesterFinalByStudent.get(s.id) ?? null;
      const total = (ct1 ?? 0) + (ct2 ?? 0) + (semesterFinal ?? 0);
      const percentage = s.fullMarks > 0 ? (total / s.fullMarks) * 100 : 0;
      const { grade, gpa } = gradeForPercentage(percentage);
      return {
        subjectId: s.id,
        subjectName: s.name,
        fullMarks: s.fullMarks,
        ct1Marks: ct1,
        ct2Marks: ct2,
        semesterFinalMarks: semesterFinal,
        totalMarks: total,
        highestMarks: highestBySubject.get(s.id) ?? total,
        gradePoint: gpa,
        letterGrade: grade,
      };
    });

    const totalFullMarks = reportableSubjects.reduce((sum, s) => sum + s.fullMarks, 0);
    const totalObtained = subjectRows.reduce((sum, s) => sum + s.totalMarks, 0);
    const overallPercentage = totalFullMarks > 0 ? (totalObtained / totalFullMarks) * 100 : 0;
    const { grade: overallGrade, gpa: overallGpa } = gradeForPercentage(overallPercentage);

    // Standard competition ranking (ties share a rank; the next distinct
    // score resumes at "number of students so far", e.g. 1st, 1st, 3rd).
    const classmatePercentages = classmates
      .map((c) => {
        const bySubject = totalsByStudent.get(c.id) ?? new Map<number, number>();
        const obtained = reportableSubjects.reduce(
          (sum, s) => sum + (bySubject.get(s.id) ?? 0),
          0,
        );
        return {
          studentId: c.id,
          percentage: totalFullMarks > 0 ? (obtained / totalFullMarks) * 100 : 0,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
    let position = 1;
    for (let i = 0; i < classmatePercentages.length; i++) {
      if (i > 0 && classmatePercentages[i].percentage < classmatePercentages[i - 1].percentage) {
        position = i + 1;
      }
      if (classmatePercentages[i].studentId === studentId) {
        break;
      }
    }

    let totalWorkingDays: number | null = null;
    let totalAttendances: number | null = null;
    if (semesterFinalExam?.attendancePeriodFrom && semesterFinalExam.attendancePeriodTo) {
      const from = new Date(semesterFinalExam.attendancePeriodFrom);
      const to = new Date(semesterFinalExam.attendancePeriodTo);
      to.setHours(23, 59, 59, 999);
      [totalWorkingDays, totalAttendances] = await Promise.all([
        this.attendanceService.countWorkingDays(classId, student.sectionId, from, to),
        this.attendanceService.countAttendanceDays(studentId, from, to),
      ]);
    }

    return {
      studentId: student.id,
      studentName: student.name,
      studentCode: student.code,
      roll: student.roll,
      className: student.classEntity.name,
      sectionName: student.section.name,
      academicYear,
      examTitle:
        semesterFinalExam?.name ??
        ct2Exam?.name ??
        ct1Exam?.name ??
        `Progress Report — ${academicYear}`,
      subjects: subjectRows,
      totalFullMarks,
      totalObtained: Math.round((totalObtained + Number.EPSILON) * 100) / 100,
      gpa: overallGpa,
      letterGrade: overallGrade,
      position,
      totalStudents: classmates.length,
      totalWorkingDays,
      totalAttendances,
    };
  }

  // Shared by notifyGuardians/publishAndNotify: emails every guardian with
  // an address on file and reports who was skipped for lacking one.
  // Best-effort — one guardian's bad/missing address never blocks the rest.
  private async emailGuardiansForResults(
    examName: string,
    results: StudentExamResult[],
  ): Promise<{
    emailed: number;
    missingGuardianEmail: Array<{
      studentId: number;
      studentName: string;
      studentCode: string;
    }>;
  }> {
    let emailed = 0;
    const missingGuardianEmail: Array<{
      studentId: number;
      studentName: string;
      studentCode: string;
    }> = [];
    for (const result of results) {
      const student = await this.studentsService.findById(result.studentId);
      const guardianEmails = student.guardians
        .map((g) => g.email)
        .filter((e): e is string => !!e);

      if (guardianEmails.length === 0) {
        missingGuardianEmail.push({
          studentId: student.id,
          studentName: student.name,
          studentCode: student.code,
        });
      }

      for (const email of guardianEmails) {
        await this.notificationsService.sendMail(
          email,
          `${examName} result for ${student.name} (${student.code})`,
          this.renderResultEmail(examName, result),
        );
        emailed += 1;
      }
    }
    return { emailed, missingGuardianEmail };
  }

  // Marks the exam published without sending any email — for schools that
  // want results visible before guardians are notified separately.
  async publishExam(examId: number): Promise<{ published: number }> {
    const exam = await this.findExamById(examId);
    const results = await this.getResultsForExam(examId);
    exam.publishedAt = new Date();
    await this.examsRepo.save(exam);
    return { published: results.length };
  }

  // Emails guardians the current results without touching publishedAt —
  // works on a draft (a preview send) or a published exam (a resend), and
  // can be called more than once.
  async notifyGuardians(examId: number): Promise<{
    emailed: number;
    missingGuardianEmail: Array<{
      studentId: number;
      studentName: string;
      studentCode: string;
    }>;
  }> {
    const exam = await this.findExamById(examId);
    const results = await this.getResultsForExam(examId);
    const { emailed, missingGuardianEmail } =
      await this.emailGuardiansForResults(exam.name, results);
    exam.emailedCount = emailed;
    await this.examsRepo.save(exam);
    return { emailed, missingGuardianEmail };
  }

  // Publish + notify in one step, for the common case of doing both at once.
  async publishAndNotify(examId: number): Promise<{
    published: number;
    emailed: number;
    missingGuardianEmail: Array<{
      studentId: number;
      studentName: string;
      studentCode: string;
    }>;
  }> {
    const exam = await this.findExamById(examId);
    const results = await this.getResultsForExam(examId);
    const { emailed, missingGuardianEmail } =
      await this.emailGuardiansForResults(exam.name, results);
    exam.publishedAt = new Date();
    exam.emailedCount = emailed;
    await this.examsRepo.save(exam);
    return { published: results.length, emailed, missingGuardianEmail };
  }

  // Public-website announcement only — never exposes individual marks
  // (there's no guardian login yet, so anything shown here is visible to
  // anyone). Requires the exam to already be published (publishedAt set);
  // announcing unfinalized results publicly would be misleading.
  async announceResultsOnWebsite(examId: number): Promise<Exam> {
    const exam = await this.findExamById(examId);
    if (!exam.publishedAt) {
      throw new BadRequestException(
        'Publish the exam results before announcing them on the website',
      );
    }
    exam.resultsAnnouncedAt = new Date();
    return this.examsRepo.save(exam);
  }

  async retractResultsAnnouncement(examId: number): Promise<Exam> {
    const exam = await this.findExamById(examId);
    exam.resultsAnnouncedAt = null;
    return this.examsRepo.save(exam);
  }

  async deleteExam(examId: number): Promise<void> {
    const result = await this.examsRepo.delete(examId);
    if (result.affected === 0) {
      throw new NotFoundException('Exam not found');
    }
  }

  private renderResultEmail(
    examName: string,
    result: StudentExamResult,
  ): string {
    const rows = result.subjects
      .map(
        (s) =>
          `<tr><td>${s.subjectName}</td><td>${s.marksObtained}/${s.fullMarks}</td></tr>`,
      )
      .join('');
    return `
      <h2>${examName} — Result for ${result.studentName} (${result.studentCode})</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Subject</th><th>Marks</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p><strong>Total:</strong> ${result.totalObtained}/${result.totalFullMarks}
         (${result.percentage}%)</p>
      <p><strong>Grade:</strong> ${result.grade} (GPA ${result.gpa.toFixed(2)})</p>
    `;
  }
}
