import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PaymentMethod } from '../entities/enums';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsString()
  paidAt: string;

  @IsOptional()
  @IsString()
  note?: string;

  // Generated client-side (one per "Pay" click) so a double-submit — double
  // click, or a retried request after a flaky response — can't record the
  // same payment twice.
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class VoidRecordDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
