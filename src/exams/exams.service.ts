import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { Exam, ExamType } from './entities/exam.entity';
import { Mark } from './entities/mark.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { EnterMarksDto } from './dto/enter-marks.dto';
import { gradeForPercentage } from './grading';
import { StudentsService } from '../students/students.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AcademicsService } from '../academics/academics.service';

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

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    @InjectRepository(Exam)
    private readonly examsRepo: Repository<Exam>,
    @InjectRepository(Mark)
    private readonly marksRepo: Repository<Mark>,
    private readonly studentsService: StudentsService,
    private readonly notificationsService: NotificationsService,
    private readonly academicsService: AcademicsService,
  ) {}

  async createSubject(dto: CreateSubjectDto): Promise<Subject> {
    const existing = await this.subjectsRepo.findOne({
      where: { classId: dto.classId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Subject ${dto.name} already exists for this class`,
      );
    }
    const subject = this.subjectsRepo.create(dto);
    return this.subjectsRepo.save(subject);
  }

  findSubjectsByClass(classId: number): Promise<Subject[]> {
    return this.subjectsRepo.find({ where: { classId } });
  }

  async updateSubject(id: number, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    if (dto.name && dto.name !== subject.name) {
      const existing = await this.subjectsRepo.findOne({
        where: { classId: subject.classId, name: dto.name },
      });
      if (existing) {
        throw new ConflictException(
          `Subject ${dto.name} already exists for this class`,
        );
      }
    }
    await this.subjectsRepo.update(id, {
      name: dto.name ?? subject.name,
      fullMarks: dto.fullMarks ?? subject.fullMarks,
    });
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
      examDate: dto.examDate ?? exam.examDate,
      academicYear: dto.academicYear ?? exam.academicYear,
    });
    return this.findExamById(examId);
  }

  findExams(classId?: number, academicYear?: string): Promise<Exam[]> {
    return this.examsRepo.find({
      where: {
        ...(classId ? { classId } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      relations: { classEntity: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findExamById(id: number): Promise<Exam> {
    const exam = await this.examsRepo.findOne({
      where: { id },
      relations: { classEntity: true },
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
  ): Promise<{ saved: number }> {
    const exam = await this.findExamById(examId);

    const [classStudents, classSubjects] = await Promise.all([
      this.studentsService.findAll({ classId: exam.classId }),
      this.subjectsRepo.find({ where: { classId: exam.classId } }),
    ]);
    const studentIds = new Set(classStudents.map((s) => s.id));
    const subjectsById = new Map(classSubjects.map((s) => [s.id, s]));

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
    sectionId?: number,
  ): Promise<
    Array<{
      studentId: number;
      studentCode: string;
      studentName: string;
      roll: number;
      marksObtained: number | null;
    }>
  > {
    const exam = await this.findExamById(examId);
    const subject = await this.subjectsRepo.findOne({
      where: { id: subjectId, classId: exam.classId },
    });
    if (!subject) {
      throw new NotFoundException("Subject not found for this exam's class");
    }

    const students = await this.studentsService.findAll({
      classId: exam.classId,
      sectionId,
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
