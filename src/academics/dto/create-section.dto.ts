import { IsInt, IsString } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  name: string;

  @IsInt()
  classId: number;
}
