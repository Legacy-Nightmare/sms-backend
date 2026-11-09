import { IsInt, Min } from 'class-validator';

// A class-subject's name/catalog link is fixed at creation — to use a
// different subject, remove this one and add the right catalog subject
// instead. Only the per-class marks total is editable afterward.
export class UpdateSubjectDto {
  @IsInt()
  @Min(1)
  fullMarks: number;
}
