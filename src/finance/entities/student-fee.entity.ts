import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { FeeType } from './fee-type.entity';
import { User } from '../../users/entities/user.entity';
import { Exam } from '../../exams/entities/exam.entity';

// One billed fee for one student — e.g. "Rahim owes 1500 BDT for Monthly
// Tuition, Oct 2026". Amount is frozen at billing time (not re-derived from
// ClassFee later). periodMonth/periodYear are null for one-time fees
// (admission); set for recurring ones (monthly tuition) so the same student
// can't be billed twice for the same month.
//
// Exam Fee bills are identified by which *exam* they're for, not by
// period — two exams can fall in the same month/year and each still needs
// its own bill. So the two kinds of "already billed?" uniqueness never
// overlap: the period-based index only applies when there's no exam
// (examId IS NULL), and the exam-based index only applies when there is
// one. Without this split, billing a second exam's fee for a student
// already billed (for any exam) in the same period silently no-ops —
// it looks like a duplicate of the period-based index, even though it's a
// different exam.
@Entity('student_fees')
@Index(['studentId', 'feeTypeId', 'periodMonth', 'periodYear'], {
  unique: true,
  where: '"exam_id" IS NULL',
})
@Index(['studentId', 'feeTypeId', 'examId'], { unique: true, where: '"exam_id" IS NOT NULL' })
export class StudentFee {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: number;

  @ManyToOne(() => FeeType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fee_type_id' })
  feeType: FeeType;

  @Column({ name: 'fee_type_id' })
  feeTypeId: number;

  @Column({ name: 'amount_due', type: 'int' })
  amountDue: number;

  @Column({ name: 'period_month', type: 'int', nullable: true })
  periodMonth: number | null;

  @Column({ name: 'period_year', type: 'int', nullable: true })
  periodYear: number | null;

  @Column({ nullable: true })
  note: string | null;

  // Only set for Exam Fee bills — which exam the fee is for, so the admit
  // card (only issuable once this fee is fully paid) can show the exam's
  // own name rather than deriving a label from period month/year.
  @ManyToOne(() => Exam, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam | null;

  @Column({ name: 'exam_id', nullable: true })
  examId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdById: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
