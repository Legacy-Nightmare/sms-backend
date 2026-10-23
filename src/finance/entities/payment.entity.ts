import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StudentFee } from './student-fee.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod, RecordStatus } from './enums';

// Append-only. Never edited or deleted — a mistake gets voided (status +
// voidReason) and re-recorded, so the audit trail stays intact.
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StudentFee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_fee_id' })
  studentFee: StudentFee;

  @Column({ name: 'student_fee_id' })
  studentFeeId: number;

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
  receivedBy: User | null;

  @Column({ name: 'received_by', nullable: true })
  receivedById: number | null;

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

  // Client-supplied key so a double-click or a retried request can never
  // create two payment rows for the same intended action — the second
  // attempt is detected via this unique constraint and the original row is
  // returned instead of inserting again.
  @Column({ name: 'idempotency_key', unique: true, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
