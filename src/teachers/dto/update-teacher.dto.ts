import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salary?: number;

  @IsOptional()
  @IsString()
  nid?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
