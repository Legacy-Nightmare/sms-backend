import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// The reusable subject catalog ("Bangla", "Mathematics", ...) — a class
// attaches one of these via `ClassSubject` (exams/entities/subject.entity.ts,
// table `class_subjects`), which copies `defaultFullMarks` in as its own
// starting `fullMarks` and can then edit it independently per class.
@Entity('subjects')
export class SubjectCatalog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'default_full_marks', type: 'int', nullable: true })
  defaultFullMarks: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
