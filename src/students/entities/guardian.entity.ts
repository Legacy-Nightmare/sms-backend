import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Student } from './student.entity';

export enum GuardianRelation {
  FATHER = 'father',
  MOTHER = 'mother',
  OTHER = 'other',
}

@Entity('guardians')
export class Guardian {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: GuardianRelation, default: GuardianRelation.OTHER })
  relation: GuardianRelation;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @ManyToOne(() => Student, (student) => student.guardians, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: number;
}
