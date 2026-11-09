import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClassEntity } from '../../academics/entities/class.entity';
import { SubjectCatalog } from '../../subjects/entities/subject-catalog.entity';

// A class's own instance of a catalog subject ("Bangla" attached to Class
// 6) — `name` and `fullMarks` are copied in from the catalog subject at
// creation time (fullMarks from its `defaultFullMarks`, or 100) and then
// editable independently per class, which is why they stay plain columns
// here rather than being read live off the `subject` relation. Every bit of
// exam/mark/report code already reads `.name`/`.fullMarks` straight off
// this entity, unchanged since before the catalog existed.
@Entity('class_subjects')
@Index(['classId', 'subjectId'], { unique: true })
export class Subject {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id' })
  classId: number;

  @ManyToOne(() => SubjectCatalog, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectCatalog;

  @Column({ name: 'subject_id' })
  subjectId: number;

  @Column({ name: 'full_marks', type: 'int', default: 100 })
  fullMarks: number;
}
