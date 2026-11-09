import { IsArray, IsInt } from 'class-validator';

export class SetAssignmentsDto {
  @IsArray()
  @IsInt({ each: true })
  classSubjectIds: number[];
}
