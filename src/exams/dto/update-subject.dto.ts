import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

// A class-subject's name/catalog link is fixed at creation — to use a
// different subject, remove this one and add the right catalog subject
// instead. Only the per-class marks total (and its optional progress-report
// split) are editable afterward.
export class UpdateSubjectDto {
  @IsInt()
  @Min(1)
  fullMarks: number;

  // All three must be provided together and sum to fullMarks (validated in
  // the service), or all sent as `null` to clear the split and leave this
  // subject out of progress reports.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  ct1FullMarks?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  ct2FullMarks?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  semesterFinalFullMarks?: number | null;
}
