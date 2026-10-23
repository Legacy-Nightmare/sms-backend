import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TeacherSalary } from './teacher-salary.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod, RecordStatus } from './enums';

// Append-only, same void-not-edit pattern as Payment.
@Entity('salary_payments')
export class SalaryPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TeacherSalary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_salary_id' })
  teacherSalary: TeacherSalary;

  @Column({ name: 'teacher_salary_id' })
  teacherSalaryId: number;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column({ name: 'paid_at', type: 'date' })
  paidAt: string;

  @Column({ name: 'receipt_number', unique: true, nullable: true })
  receiptNumber: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by' })
  paidBy: User | null;

  @Column({ name: 'received_by', nullable: true })
  paidById: number | null;

  @Column({ nullable: true })
  note: string | null;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status: RecordStatus;

  @Column({ name: 'void_reason', nullable: true })
  voidReason: string | null;

  @Column({ name: 'voided_by', nullable: true })
  voidedById: number | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'idempotency_key', unique: true, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
