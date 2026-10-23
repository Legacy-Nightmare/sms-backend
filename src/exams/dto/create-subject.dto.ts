import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsInt()
  classId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  fullMarks?: number;
}
