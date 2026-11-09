import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

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

// All fields optional — only the ones present in the request body are
// changed. periodMonth/periodYear/note accept `null` to explicitly clear
// them (the frontend's edit form always sends every field, so `undefined`
// never reaches here in practice — but `null` is what actually clears a
// value, since a field left out of the JSON body is indistinguishable from
// "don't touch this"). Amount is guarded in the service against dropping
// below what's already been paid.
export class UpdateStudentFeeDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  amountDue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number | null;

  @IsOptional()
  @IsInt()
  periodYear?: number | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class FeeAmountDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  amount: number;
}

// Bills several named fees for one student in a single call — the "Add fee"
// form's fixed set (Admission Fee, Session Fee, Exam Fee, ...). Fee types
// are resolved/created by name, so the admin never has to pre-create them
// via the fee-types settings dialog first.
export class CreateMultiStudentFeeDto {
  @IsInt()
  studentId: number;

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeAmountDto)
  fees: FeeAmountDto[];
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
