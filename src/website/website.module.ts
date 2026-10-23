import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolProfile } from './entities/school-profile.entity';
import { Institution } from './entities/institution.entity';
import { GalleryPhoto } from './entities/gallery-photo.entity';
import { SiteDocument } from './entities/site-document.entity';
import { Notice } from '../notices/entities/notice.entity';
import { Exam } from '../exams/entities/exam.entity';
import { WebsiteService } from './website.service';
import { WebsiteController } from './website.controller';
import { PublicController } from './public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolProfile,
      Institution,
      GalleryPhoto,
      SiteDocument,
      Notice,
      Exam,
    ]),
  ],
  controllers: [WebsiteController, PublicController],
  providers: [WebsiteService],
})
export class WebsiteModule {}
