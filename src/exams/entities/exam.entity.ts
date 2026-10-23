import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassEntity } from '../../academics/entities/class.entity';

// FINAL also covers one-off exams with no tutorial counterpart (e.g.
// "Midterm") — they still grade standalone via getStudentResult, and simply
// don't participate in a combined semester result unless a TUTORIAL exam
// for the same class/academic year also exists.
export enum ExamType {
  TUTORIAL = 'tutorial',
  FINAL = 'final',
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
