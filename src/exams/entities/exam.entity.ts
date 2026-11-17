import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassEntity } from '../../academics/entities/class.entity';
import { Section } from '../../academics/entities/section.entity';

// FINAL also covers one-off exams with no tutorial counterpart (e.g.
// "Midterm") — they still grade standalone via getStudentResult, and simply
// don't participate in a combined semester result unless a TUTORIAL exam
// for the same class/academic year also exists.
export enum ExamType {
  TUTORIAL = 'tutorial',
  FINAL = 'final',
}

// Marks a school's own three-part semester progress report: two small class
// tests (CT1/CT2) plus one larger semester-end exam, whose raw marks sum to
// a subject's full marks — a different, additive scheme from the
// TUTORIAL/FINAL weighted-blend above (getCombinedResult), not a
// replacement for it. Null (the default) means this exam isn't part of a
// progress report at all.
export enum ExamComponent {
  CT1 = 'ct1',
  CT2 = 'ct2',
  SEMESTER_FINAL = 'semester_final',
}

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn()
  id: number;

  // e.g. "Midterm", "Final Term 2026"
  @Column()
  name: string;

  @Column({ type: 'enum', enum: ExamType, default: ExamType.FINAL })
  type: ExamType;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id' })
  classId: number;

  // Null = every section of the class (the default, "All"); a specific id
  // restricts marks entry and results to just that section's students.
  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section: Section | null;

  @Column({ name: 'section_id', nullable: true })
  sectionId: number | null;

  @Column({ name: 'exam_date', type: 'date', nullable: true })
  examDate: string;

  // Free-form session/year label (e.g. "2026"), so exams can be filtered by
  // year without a full academic-year/session entity — the exam name
  // already carries most of that context (e.g. "Final Term 2026").
  @Column({ name: 'academic_year', nullable: true })
  academicYear: string | null;

  // Set once results are finalized and published to guardians; null while
  // marks are still being entered.
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // Running total of guardian emails sent for this exam — updated every time
  // publish (or a later resend) runs, so the UI can show a cumulative count
  // without re-deriving it from a log table.
  @Column({ name: 'emailed_count', type: 'int', default: 0 })
  emailedCount: number;

  // Public-website announcement only ("Result Published — Class 10"), never
  // individual marks — set via announceResultsOnWebsite, independent of
  // publishedAt (which gates the guardian-facing dashboard/email results).
  @Column({ name: 'results_announced_at', type: 'timestamptz', nullable: true })
  resultsAnnouncedAt: Date | null;

  // Which progress-report component this exam represents (CT1/CT2/Semester
  // Final), or null for every other exam (Midterm, the existing
  // TUTORIAL/FINAL combined-result exams, etc.) — unrelated to `type` above.
  @Column({ name: 'component', type: 'enum', enum: ExamComponent, nullable: true })
  component: ExamComponent | null;

  // Only meaningful on the SEMESTER_FINAL component of a progress report —
  // the date range the report's "Total Working Days"/"Total Attendances"
  // footer counts real attendance punches over.
  @Column({ name: 'attendance_period_from', type: 'date', nullable: true })
  attendancePeriodFrom: string | null;

  @Column({ name: 'attendance_period_to', type: 'date', nullable: true })
  attendancePeriodTo: string | null;

  // Whether a student fee can be linked to this exam for an admit card —
  // not every exam (e.g. a class test) needs one. Set right after creation
  // via the "Issue admit card?" prompt; false until then.
  @Column({ name: 'issues_admit_card', default: false })
  issuesAdmitCard: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
