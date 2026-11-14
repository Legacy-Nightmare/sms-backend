import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ExamType } from '../entities/exam.entity';

export class CreateExamDto {
  @IsString()
  name: string;

  @IsEnum(ExamType)
  type: ExamType;

  @IsInt()
  classId: number;

  // Omit for "all sections of the class" (the default).
  @IsOptional()
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @IsString()
  examDate?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;
}
