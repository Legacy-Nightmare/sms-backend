import { IsString, MinLength } from 'class-validator';

export class CreateFeeTypeDto {
  @IsString()
  @MinLength(2)
  name: string;
}
