import { IsOptional, IsString } from 'class-validator';

export class CreateSiteDocumentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  category?: string;
}
