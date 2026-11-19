import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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

  // Second factor (F-28) — class/section/roll alone is a small, guessable
  // space. Optional at the DTO level because older student records may
  // have no date of birth on file at all; enforced in the controller only
  // when the matched student actually has one, so nobody who could use
  // this page before gets locked out by a field with nothing to check it
  // against.
  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}
