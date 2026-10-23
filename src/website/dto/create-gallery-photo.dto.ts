import { IsOptional, IsString } from 'class-validator';

export class CreateGalleryPhotoDto {
  @IsOptional()
  @IsString()
  caption?: string;
}
