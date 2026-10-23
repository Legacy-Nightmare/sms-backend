import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStudentFeeDto {
  @IsInt()
  studentId: number;

  @IsInt()
  feeTypeId: number;

  @IsInt()
  @Min(0)
  amountDue: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @IsOptional()
  @IsInt()
  periodYear?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

// Bills every active student in a class at once — the efficient path for
// something like "this month's tuition for Class 5", instead of one
// student at a time.
export class BulkApplyFeeDto {
  @IsInt()
  classId: number;

  @IsInt()
  feeTypeId: number;

  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @IsOptional()
  @IsInt()
  periodYear?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
