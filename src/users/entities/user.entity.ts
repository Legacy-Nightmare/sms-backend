import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  // select: false keeps it out of normal queries; ApiHideProperty keeps it
  // out of the Swagger schema too, so the docs never imply a response could
  // carry a password hash even informationally.
  @ApiHideProperty()
  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.TEACHER })
  role: Role;

  // Links a teacher-role login to its roster entry in `teachers`, so the
  // backend knows which class/subject assignments this account actually
  // has. Meaningless for admin/finance accounts — stays null for those.
  @Column({ name: 'teacher_id', nullable: true })
  teacherId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
