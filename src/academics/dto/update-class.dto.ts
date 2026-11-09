import { IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // Explicit `null` clears the level (e.g. converting a numbered class to
  // a pre-primary one); omit the field entirely to leave it unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  level?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
