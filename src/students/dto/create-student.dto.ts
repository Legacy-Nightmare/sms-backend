import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { GuardianRelation } from '../entities/guardian.entity';

export class CreateGuardianDto {
  @IsString()
  name: string;

  @IsEnum(GuardianRelation)
  relation: GuardianRelation;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateStudentDto {
  @IsString()
  name: string;

  @IsInt()
  classId: number;

  @IsInt()
  sectionId: number;

  @IsInt()
  @Min(1)
  roll: number;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGuardianDto)
  guardians?: CreateGuardianDto[];
}
