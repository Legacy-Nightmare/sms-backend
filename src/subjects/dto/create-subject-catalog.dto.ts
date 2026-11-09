import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubjectCatalogDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultFullMarks?: number;
}
