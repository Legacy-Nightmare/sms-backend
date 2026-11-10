import { IsEnum, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class UpdateUserDto {
  @IsEnum(Role)
  role: Role;

  // Explicit `null` clears the link; omit the field entirely to leave it
  // unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  teacherId?: number | null;
}
