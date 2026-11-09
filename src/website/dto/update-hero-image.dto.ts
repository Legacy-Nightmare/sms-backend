import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateHeroImageDto {
  @Type(() => Number)
  @IsInt()
  sortOrder: number;
}
