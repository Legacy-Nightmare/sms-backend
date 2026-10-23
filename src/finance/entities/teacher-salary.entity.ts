import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// One teacher's payable salary for one month. amountDue is a snapshot, not
// re-derived from anywhere else, so changing a teacher's rate later never
// rewrites a month already set.
@Entity('teacher_salaries')
@Index(['teacherId', 'periodMonth', 'periodYear'], { unique: true })
export class TeacherSalary {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: number;

  @Column({ name: 'amount_due', type: 'int' })
  amountDue: number;

  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

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
