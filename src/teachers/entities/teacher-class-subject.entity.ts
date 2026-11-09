import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Plain FK columns, no ManyToOne relations — the DB-level foreign keys
// (added in the migration) are what actually enforce integrity; avoiding
// relations here means this entity doesn't need to import the exams
// module's `Subject` (class_subjects) entity, keeping the two modules
// decoupled. Reads join across tables with a raw query instead.
@Entity('teacher_class_subjects')
@Index(['teacherId', 'classSubjectId'], { unique: true })
export class TeacherClassSubject {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'teacher_id' })
  teacherId: number;

  @Column({ name: 'class_subject_id' })
  classSubjectId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
