import { IsInt, IsString, Min } from 'class-validator';

export class AdmitCardExamsLookupDto {
  @IsInt()
  classId: number;

  @IsInt()
  sectionId: number;

  @IsInt()
  @Min(1)
  roll: number;
}

export class AdmitCardDownloadDto extends AdmitCardExamsLookupDto {
  @IsInt()
  examId: number;

  @IsString()
  recaptchaToken: string;
}
