import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassEntity } from '../../academics/entities/class.entity';
import { Section } from '../../academics/entities/section.entity';
import { Guardian } from './guardian.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Human-readable display code, format "{classLevel}-{section}-{roll}", e.g.
  // "1-RUP-56". NOT what's enrolled on the ZKTeco device — device PINs are
  // numeric-only, so this is for humans (reports, guardian-facing views).
  @Column({ unique: true })
  code: string;

  // The numeric PIN/User ID actually enrolled on the ZKTeco device via its
  // biometric enrollment flow. This is what attendance punches are keyed to.
  @Column({ name: 'biometric_id', unique: true })
  biometricId: number;

  @Column({ type: 'int' })
  roll: number;

  @ManyToOne(() => ClassEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id' })
  classId: number;

  @ManyToOne(() => Section, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ name: 'section_id' })
  sectionId: number;

  @Column({ nullable: true })
  dateOfBirth: string;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Guardian, (guardian) => guardian.student)
  guardians: Guardian[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
