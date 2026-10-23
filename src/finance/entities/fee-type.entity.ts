import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// e.g. "Admission Fee", "Monthly Tuition", "Exam Fee", "Other"
@Entity('fee_types')
export class FeeType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
