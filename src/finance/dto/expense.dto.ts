import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MinLength(2)
  category: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  note?: string;
}
