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

  // Progress-report split of fullMarks — all three must be provided
  // together and sum to fullMarks (validated in the service), or all
  // omitted to leave this subject out of progress reports for now.
  @IsOptional()
  @IsInt()
  @Min(1)
  ct1FullMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  ct2FullMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  semesterFinalFullMarks?: number;
}
