import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Section } from './section.entity';

@Entity('classes')
export class ClassEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Numeric grade level, e.g. 1 through 10
  @Column({ type: 'int', unique: true })
  level: number;

  @Column()
  name: string;

  // What share of the combined semester result each exam type contributes
  // for this class (e.g. 20% tutorial + 80% final). Must sum to 100 —
  // enforced in AcademicsService, not a DB constraint, to keep this simple.
  @Column({ name: 'tutorial_weight_percent', type: 'int', default: 20 })
  tutorialWeightPercent: number;

  @Column({ name: 'final_weight_percent', type: 'int', default: 80 })
  finalWeightPercent: number;

  @OneToMany(() => Section, (section) => section.classEntity)
  sections: Section[];
}
