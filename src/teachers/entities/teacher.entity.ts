import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({ nullable: true })
  nid: string | null;

  @Column({ name: 'date_of_birth', nullable: true })
  dateOfBirth: string | null;

  @Column({ name: 'joining_date', nullable: true })
  joiningDate: string | null;

  @Column({ type: 'int', nullable: true })
  salary: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Soft-delete marker — "removing" a teacher sets this instead of a hard
  // DELETE, so teacher_class_subjects/teacher_salaries/salary_payments rows
  // (and anything else joining on this id) keep resolving correctly. A
  // non-null value means the teacher no longer appears in the roster.
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
