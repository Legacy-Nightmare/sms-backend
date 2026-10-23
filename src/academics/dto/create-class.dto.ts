import { IsInt, IsString, Min } from 'class-validator';

export class CreateClassDto {
  @IsInt()
  @Min(1)
  level: number;

  @IsString()
  name: string;
}
