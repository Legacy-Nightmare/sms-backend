import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { SchoolProfile, SCHOOL_PROFILE_ID } from './entities/school-profile.entity';
import { Institution } from './entities/institution.entity';
import { GalleryPhoto } from './entities/gallery-photo.entity';
import { SiteDocument } from './entities/site-document.entity';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { Notice } from '../notices/entities/notice.entity';
import { Exam } from '../exams/entities/exam.entity';

@Injectable()
export class WebsiteService {
  constructor(
    @InjectRepository(SchoolProfile)
    private readonly profileRepo: Repository<SchoolProfile>,
    @InjectRepository(Institution)
    private readonly institutionsRepo: Repository<Institution>,
    @InjectRepository(GalleryPhoto)
    private readonly galleryRepo: Repository<GalleryPhoto>,
    @InjectRepository(SiteDocument)
    private readonly documentsRepo: Repository<SiteDocument>,
    // Read-only here — publishing itself is owned by NoticesService /
    // ExamsService. Queried directly rather than through those services to
    // avoid depending on their guardian-notification side effects for what
    // is just a public read.
    @InjectRepository(Notice)
    private readonly noticesRepo: Repository<Notice>,
    @InjectRepository(Exam)
    private readonly examsRepo: Repository<Exam>,
  ) {}

  // The seed migration always inserts id=1, so a missing row here means the
  // migration hasn't run rather than a real "no profile yet" state.
  async getProfile(): Promise<SchoolProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id: SCHOOL_PROFILE_ID },
    });
    if (!profile) {
      throw new NotFoundException(
        'School profile not found — has the website migration run?',
      );
    }
    return profile;
  }

  async updateProfile(dto: UpdateSchoolProfileDto): Promise<SchoolProfile> {
    await this.getProfile();
    await this.profileRepo.update(SCHOOL_PROFILE_ID, dto);
    return this.getProfile();
  }

  async setLogo(url: string): Promise<SchoolProfile> {
    await this.getProfile();
    await this.profileRepo.update(SCHOOL_PROFILE_ID, { logoUrl: url });
    return this.getProfile();
  }

  async setHeroImage(url: string): Promise<SchoolProfile> {
    await this.getProfile();
    await this.profileRepo.update(SCHOOL_PROFILE_ID, { heroImageUrl: url });
    return this.getProfile();
  }

  findAllInstitutions(): Promise<Institution[]> {
    return this.institutionsRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  private findActiveInstitutions(): Promise<Institution[]> {
    return this.institutionsRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  createInstitution(dto: CreateInstitutionDto): Promise<Institution> {
    const institution = this.institutionsRepo.create(dto);
    return this.institutionsRepo.save(institution);
  }

  async updateInstitution(
    id: number,
    dto: UpdateInstitutionDto,
  ): Promise<Institution> {
    const result = await this.institutionsRepo.update(id, dto);
    if (result.affected === 0) {
      throw new NotFoundException('Institution not found');
    }
    const institution = await this.institutionsRepo.findOne({ where: { id } });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    return institution;
  }

  async removeInstitution(id: number): Promise<void> {
    const result = await this.institutionsRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Institution not found');
    }
  }

  findAllGalleryPhotos(): Promise<GalleryPhoto[]> {
    return this.galleryRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  addGalleryPhoto(imageUrl: string, caption?: string): Promise<GalleryPhoto> {
    const photo = this.galleryRepo.create({ imageUrl, caption: caption ?? null });
    return this.galleryRepo.save(photo);
  }

  async removeGalleryPhoto(id: number): Promise<void> {
    const result = await this.galleryRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Gallery photo not found');
    }
  }

  findAllDocuments(): Promise<SiteDocument[]> {
    return this.documentsRepo.find({ order: { createdAt: 'DESC' } });
  }

  addDocument(
    title: string,
    fileUrl: string,
    category?: string,
  ): Promise<SiteDocument> {
    const document = this.documentsRepo.create({
      title,
      fileUrl,
      category: category ?? null,
    });
    return this.documentsRepo.save(document);
  }

  async removeDocument(id: number): Promise<void> {
    const result = await this.documentsRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Document not found');
    }
  }

  // Everything the public homepage needs in one call — profile plus every
  // active/public collection, so the frontend doesn't have to coordinate
  // four separate requests just to render the page.
  async getPublicSite(): Promise<{
    profile: SchoolProfile;
    institutions: Institution[];
    gallery: GalleryPhoto[];
    documents: SiteDocument[];
  }> {
    const [profile, institutions, gallery, documents] = await Promise.all([
      this.getProfile(),
      this.findActiveInstitutions(),
      this.findAllGalleryPhotos(),
      this.findAllDocuments(),
    ]);
    return { profile, institutions, gallery, documents };
  }

  // Notices an admin has explicitly published to the website — independent
  // of the notice's own guardian-email publish state (a notice can be
  // public-site-visible while still a guardian-email draft, or vice versa).
  findPublishedNotices(): Promise<Notice[]> {
    return this.noticesRepo.find({
      where: { publishedToWebsiteAt: Not(IsNull()) },
      relations: { classEntity: true },
      order: { publishedToWebsiteAt: 'DESC' },
    });
  }

  // Announcement-only: callers must never surface individual marks from
  // this — only exam name/class/date, so public visitors never see grades.
  findAnnouncedResults(): Promise<Exam[]> {
    return this.examsRepo.find({
      where: { resultsAnnouncedAt: Not(IsNull()) },
      relations: { classEntity: true },
      order: { resultsAnnouncedAt: 'DESC' },
    });
  }
}
