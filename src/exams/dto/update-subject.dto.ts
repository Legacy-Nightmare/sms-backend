import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  fullMarks?: number;
}
