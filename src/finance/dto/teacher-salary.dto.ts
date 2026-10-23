import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTeacherSalaryDto {
  @IsInt()
  teacherId: number;

  @IsInt()
  @Min(0)
  amountDue: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @IsInt()
  periodYear: number;

  @IsOptional()
  @IsString()
  note?: string;
}

// Generates one salary record per teacher for the given month — the usual
// "run payroll for October" action, instead of one teacher at a time.
export class BulkGenerateSalaryDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  teacherIds: number[];

  @IsInt()
  @Min(0)
  amountDue: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @IsInt()
  periodYear: number;
}
