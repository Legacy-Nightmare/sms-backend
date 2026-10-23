import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ExamType } from '../entities/exam.entity';

// classId is deliberately not editable here — changing a published or
// marks-in-progress exam's class would orphan marks keyed to students in
// the old class. Create a new exam instead if it needs to move classes.
export class UpdateExamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @IsOptional()
  @IsString()
  examDate?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;
}
