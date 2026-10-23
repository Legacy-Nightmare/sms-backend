import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';

@Entity('attendance_logs')
@Index(['studentId', 'punchTime'], { unique: true })
export class AttendanceLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'device_sn', nullable: true })
  deviceSn: string;

  @Column({ name: 'punch_time', type: 'timestamptz' })
  punchTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
