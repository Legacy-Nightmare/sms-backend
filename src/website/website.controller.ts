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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
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

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const DOCUMENT_TYPES = ['application/pdf'];
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const WEBSITE_LOGO_DIR = 'uploads/website/logo';
const WEBSITE_HERO_DIR = 'uploads/website/hero';
const WEBSITE_GALLERY_DIR = 'uploads/website/gallery';
const WEBSITE_DOCUMENTS_DIR = 'uploads/website/documents';

function diskUpload(dir: string, allowedTypes: string[], maxSize: number) {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(
          null,
          `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`,
        );
      },
    }),
    limits: { fileSize: maxSize },
    fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
      if (!allowedTypes.includes(file.mimetype)) {
        cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
        return;
      }
      cb(null, true);
    },
  };
}

// Dashboard-only (Website Manage page) — see public.controller.ts for the
// unauthenticated reads the public homepage actually consumes.
@ApiTags('website')
@ApiBearerAuth()
@Controller('website')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

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
    FileInterceptor('logo', diskUpload(WEBSITE_LOGO_DIR, IMAGE_TYPES, MAX_IMAGE_SIZE)),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No logo uploaded');
    }
    return this.websiteService.setLogo(`/${WEBSITE_LOGO_DIR}/${file.filename}`);
  }

  @Post('profile/hero-image')
  @UseInterceptors(
    FileInterceptor('image', diskUpload(WEBSITE_HERO_DIR, IMAGE_TYPES, MAX_IMAGE_SIZE)),
  )
  uploadHeroImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }
    return this.websiteService.setHeroImage(`/${WEBSITE_HERO_DIR}/${file.filename}`);
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
    FileInterceptor('photo', diskUpload(WEBSITE_GALLERY_DIR, IMAGE_TYPES, MAX_IMAGE_SIZE)),
  )
  addGalleryPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateGalleryPhotoDto,
  ) {
    if (!file) {
      throw new BadRequestException('No photo uploaded');
    }
    return this.websiteService.addGalleryPhoto(
      `/${WEBSITE_GALLERY_DIR}/${file.filename}`,
      dto.caption,
    );
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
    FileInterceptor('file', diskUpload(WEBSITE_DOCUMENTS_DIR, DOCUMENT_TYPES, MAX_DOCUMENT_SIZE)),
  )
  addDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateSiteDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.websiteService.addDocument(
      dto.title,
      `/${WEBSITE_DOCUMENTS_DIR}/${file.filename}`,
      dto.category,
    );
  }

  @Delete('documents/:id')
  removeDocument(@Param('id', ParseIntPipe) id: number) {
    return this.websiteService.removeDocument(id);
  }
}
