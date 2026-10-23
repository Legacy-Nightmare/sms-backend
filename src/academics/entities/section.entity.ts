import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClassEntity } from './class.entity';

@Entity('sections')
@Index(['classEntity', 'name'], { unique: true })
export class Section {
  @PrimaryGeneratedColumn()
  id: number;

  // e.g. "RUP", "A", "B"
  @Column()
  name: string;

  @ManyToOne(() => ClassEntity, (classEntity) => classEntity.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id' })
  classId: number;
}
