import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Section } from './section.entity';

@Entity('classes')
export class ClassEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Numeric grade level, e.g. 1 through 10 — optional, since pre-primary
  // classes (Play, KG, Nursery) have no natural number. Purely informational
  // when set; use `sortOrder` for ordering/display, not this.
  @Column({ type: 'int', nullable: true })
  level: number | null;

  @Column()
  name: string;

  // The always-set ordering/display key for every class, numbered or not —
  // decoupled from `level` so pre-primary classes can be positioned
  // anywhere in the list (e.g. before "Class 1").
  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;

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
