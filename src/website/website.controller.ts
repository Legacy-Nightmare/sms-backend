import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebsiteService } from './website.service';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { CreateGalleryPhotoDto } from './dto/create-gallery-photo.dto';
import { CreateSiteDocumentDto } from './dto/create-site-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { StorageService } from '../platform/storage/storage.service';
import { memoryUpload, randomFileKey } from '../platform/storage/upload.util';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const DOCUMENT_TYPES = ['application/pdf'];
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const WEBSITE_LOGO_PREFIX = 'website/logo';
const WEBSITE_HERO_PREFIX = 'website/hero';
const WEBSITE_GALLERY_PREFIX = 'website/gallery';
const WEBSITE_DOCUMENTS_PREFIX = 'website/documents';

// Dashboard-only (Website Manage page) — see public.controller.ts for the
// unauthenticated reads the public homepage actually consumes.
@ApiTags('website')
@ApiBearerAuth()
@Controller('website')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WebsiteController {
  constructor(
    private readonly websiteService: WebsiteService,
    private readonly storage: StorageService,
  ) {}

  @Get('profile')
  getProfile() {
    return this.websiteService.getProfile();
  }

  @Put('profile')
  updateProfile(@Body() dto: UpdateSchoolProfileDto) {
    return this.websiteService.updateProfile(dto);
  }

  @Post('profile/logo')
  @UseInterceptors(
    FileInterceptor('logo', memoryUpload(IMAGE_TYPES, MAX_IMAGE_SIZE)),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No logo uploaded');
    }
    const url = await this.storage.upload(
      randomFileKey(WEBSITE_LOGO_PREFIX, file.originalname),
      file.buffer,
      file.mimetype,
    );
    return this.websiteService.setLogo(url);
  }

  @Post('profile/hero-image')
  @UseInterceptors(
    FileInterceptor('image', memoryUpload(IMAGE_TYPES, MAX_IMAGE_SIZE)),
  )
  async uploadHeroImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }
    const url = await this.storage.upload(
      randomFileKey(WEBSITE_HERO_PREFIX, file.originalname),
      file.buffer,
      file.mimetype,
    );
    return this.websiteService.setHeroImage(url);
  }

  @Get('institutions')
  findAllInstitutions() {
    return this.websiteService.findAllInstitutions();
  }

  @Post('institutions')
  createInstitution(@Body() dto: CreateInstitutionDto) {
    return this.websiteService.createInstitution(dto);
  }

  @Put('institutions/:id')
  updateInstitution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstitutionDto,
  ) {
    return this.websiteService.updateInstitution(id, dto);
  }

  @Delete('institutions/:id')
  removeInstitution(@Param('id', ParseIntPipe) id: number) {
    return this.websiteService.removeInstitution(id);
  }

  @Get('gallery')
  findAllGalleryPhotos() {
    return this.websiteService.findAllGalleryPhotos();
  }

  @Post('gallery')
  @UseInterceptors(
    FileInterceptor('photo', memoryUpload(IMAGE_TYPES, MAX_IMAGE_SIZE)),
  )
  async addGalleryPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateGalleryPhotoDto,
  ) {
    if (!file) {
      throw new BadRequestException('No photo uploaded');
    }
    const url = await this.storage.upload(
      randomFileKey(WEBSITE_GALLERY_PREFIX, file.originalname),
      file.buffer,
      file.mimetype,
    );
    return this.websiteService.addGalleryPhoto(url, dto.caption);
  }

  @Delete('gallery/:id')
  removeGalleryPhoto(@Param('id', ParseIntPipe) id: number) {
    return this.websiteService.removeGalleryPhoto(id);
  }

  @Get('documents')
  findAllDocuments() {
    return this.websiteService.findAllDocuments();
  }

  @Post('documents')
  @UseInterceptors(
    FileInterceptor('file', memoryUpload(DOCUMENT_TYPES, MAX_DOCUMENT_SIZE)),
  )
  async addDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateSiteDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const url = await this.storage.upload(
      randomFileKey(WEBSITE_DOCUMENTS_PREFIX, file.originalname),
      file.buffer,
      file.mimetype,
    );
    return this.websiteService.addDocument(dto.title, url, dto.category);
  }

  @Delete('documents/:id')
  removeDocument(@Param('id', ParseIntPipe) id: number) {
    return this.websiteService.removeDocument(id);
  }
}
