import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassEntity } from '../../academics/entities/class.entity';
import { User } from '../../users/entities/user.entity';

@Entity('notices')
export class Notice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  // Null means school-wide (targets guardians of every student).
  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity | null;

  @Column({ name: 'class_id', nullable: true })
  classId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdById: number | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // Independent of publishedAt (guardian email) — this controls whether the
  // notice appears on the public homepage's Notice Board.
  @Column({ name: 'published_to_website_at', type: 'timestamptz', nullable: true })
  publishedToWebsiteAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
