import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RecordStatus } from './enums';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn()
  id: number;

  // Free-text, not a separate category table — keeps this simple, per spec.
  @Column()
  category: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  note: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdById: number | null;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status: RecordStatus;

  @Column({ name: 'void_reason', nullable: true })
  voidReason: string | null;

  @Column({ name: 'voided_by', nullable: true })
  voidedById: number | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
