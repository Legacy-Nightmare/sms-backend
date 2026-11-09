import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  name: string;

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
}
