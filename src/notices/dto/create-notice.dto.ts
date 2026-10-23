import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateNoticeDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsInt()
  classId?: number;
}
