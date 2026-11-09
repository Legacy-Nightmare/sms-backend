import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  name: string;

  // Optional — pre-primary classes (Play, KG, Nursery) have no numeric
  // level.
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  // Defaults to end-of-list (see AcademicsService.createClass) when omitted.
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
