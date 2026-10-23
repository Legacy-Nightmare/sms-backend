import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { FeeType } from './fee-type.entity';
import { User } from '../../users/entities/user.entity';

// One billed fee for one student — e.g. "Rahim owes 1500 BDT for Monthly
// Tuition, Oct 2026". Amount is frozen at billing time (not re-derived from
// ClassFee later). periodMonth/periodYear are null for one-time fees
// (admission, exam); set for recurring ones (monthly tuition) so the same
// student can't be billed twice for the same month.
@Entity('student_fees')
@Index(['studentId', 'feeTypeId', 'periodMonth', 'periodYear'], { unique: true })
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

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdById: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
