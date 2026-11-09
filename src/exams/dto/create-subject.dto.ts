import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateSubjectDto {
  @IsInt()
  classId: number;

  @IsInt()
  subjectId: number;

  // Omit to use the catalog subject's own default (or 100 if it has none).
  @IsOptional()
  @IsInt()
  @Min(1)
  fullMarks?: number;
}
