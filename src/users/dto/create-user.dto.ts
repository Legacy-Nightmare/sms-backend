import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;

  // Only meaningful when role is "teacher" — links this login to a roster
  // entry so the backend can resolve their class/subject assignments.
  @IsOptional()
  @IsInt()
  teacherId?: number;
}
