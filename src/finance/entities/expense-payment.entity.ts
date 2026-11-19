import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Expense } from './expense.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod, RecordStatus } from './enums';

// Append-only, same void-not-edit pattern as Payment/SalaryPayment.
@Entity('expense_payments')
export class ExpensePayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Expense, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;

  @Column({ name: 'expense_id' })
  expenseId: number;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column({ name: 'paid_at', type: 'date' })
  paidAt: string;

  @Column({ name: 'receipt_number', unique: true, nullable: true })
  receiptNumber: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paid_by' })
  paidBy: User | null;

  @Column({ name: 'paid_by', nullable: true })
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
