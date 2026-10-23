import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from './entities/notice.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { StudentsService } from '../students/students.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticesRepo: Repository<Notice>,
    private readonly studentsService: StudentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateNoticeDto, createdById: number): Promise<Notice> {
    const notice = this.noticesRepo.create({
      title: dto.title,
      body: dto.body,
      classId: dto.classId ?? null,
      createdById,
    });
    return this.noticesRepo.save(notice);
  }

  findAll(): Promise<Notice[]> {
    return this.noticesRepo.find({
      relations: { classEntity: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Notice> {
    const notice = await this.noticesRepo.findOne({ where: { id } });
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }
    return notice;
  }

  // Editing is allowed even after publish (e.g. fixing a typo) — it doesn't
  // re-send anything; that only happens via the separate publish action.
  async update(id: number, dto: CreateNoticeDto): Promise<Notice> {
    await this.findById(id);
    await this.noticesRepo.update(id, {
      title: dto.title,
      body: dto.body,
      classId: dto.classId ?? null,
    });
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.noticesRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Notice not found');
    }
  }

  // Emails every targeted guardian (one student's class, or everyone if the
  // notice is school-wide) and marks the notice published. Best-effort on
  // email, same as exam result publishing — one bad address never blocks
  // the rest.
  async publish(id: number): Promise<{ emailed: number }> {
    const notice = await this.findById(id);
    const students = await this.studentsService.findAll(
      notice.classId ? { classId: notice.classId } : {},
    );

    let emailed = 0;
    for (const student of students) {
      const guardianEmails = student.guardians
        .map((g) => g.email)
        .filter((e): e is string => !!e);
      for (const email of guardianEmails) {
        await this.notificationsService.sendMail(
          email,
          notice.title,
          `<p>${notice.body}</p>`,
        );
        emailed += 1;
      }
    }

    notice.publishedAt = new Date();
    await this.noticesRepo.save(notice);

    return { emailed };
  }

  // Independent of publish() above — this only controls visibility on the
  // public homepage's Notice Board, no email is sent either way.
  async publishToWebsite(id: number): Promise<Notice> {
    const notice = await this.findById(id);
    notice.publishedToWebsiteAt = new Date();
    return this.noticesRepo.save(notice);
  }

  async unpublishFromWebsite(id: number): Promise<Notice> {
    const notice = await this.findById(id);
    notice.publishedToWebsiteAt = null;
    return this.noticesRepo.save(notice);
  }
}
