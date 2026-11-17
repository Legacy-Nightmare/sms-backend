import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ExamComponent, ExamType } from '../entities/exam.entity';

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

  // Progress-report component (CT1/CT2/Semester Final) — omit for every
  // other exam.
  @IsOptional()
  @IsEnum(ExamComponent)
  component?: ExamComponent;

  // Only meaningful (and required together) on a SEMESTER_FINAL component.
  @IsOptional()
  @IsString()
  attendancePeriodFrom?: string;

  @IsOptional()
  @IsString()
  attendancePeriodTo?: string;

  // Whether this exam can be linked to an Exam Fee for an admit card.
  @IsOptional()
  @IsBoolean()
  issuesAdmitCard?: boolean;
}
