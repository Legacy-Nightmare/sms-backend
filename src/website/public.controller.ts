import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebsiteService } from './website.service';

// No guards anywhere in this controller — these are the only endpoints the
// public homepage calls, and they're meant to be reachable by anonymous
// visitors. Keep anything sensitive (individual marks, internal bookkeeping
// fields) out of what gets returned here.
@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get('site')
  getSite() {
    return this.websiteService.getPublicSite();
  }

  @Get('notices')
  async getNotices() {
    const notices = await this.websiteService.findPublishedNotices();
    return notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      classEntity: notice.classEntity
        ? { id: notice.classEntity.id, name: notice.classEntity.name }
        : null,
      publishedToWebsiteAt: notice.publishedToWebsiteAt,
    }));
  }

  @Get('results-announcements')
  async getResultsAnnouncements() {
    const exams = await this.websiteService.findAnnouncedResults();
    return exams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      type: exam.type,
      academicYear: exam.academicYear,
      examDate: exam.examDate,
      classEntity: { id: exam.classEntity.id, name: exam.classEntity.name },
      resultsAnnouncedAt: exam.resultsAnnouncedAt,
    }));
  }
}
