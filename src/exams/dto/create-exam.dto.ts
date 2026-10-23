import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ExamType } from '../entities/exam.entity';

export class CreateExamDto {
  @IsString()
  name: string;

  @IsEnum(ExamType)
  type: ExamType;

  @IsInt()
  classId: number;

  @IsOptional()
  @IsString()
  examDate?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;
}
