import { IsInt, Min } from 'class-validator';

export class UpsertClassFeeDto {
  @IsInt()
  classId: number;

  @IsInt()
  feeTypeId: number;

  @IsInt()
  @Min(0)
  amount: number;
}
