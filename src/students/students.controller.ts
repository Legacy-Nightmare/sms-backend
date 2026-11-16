import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { StorageService } from '../platform/storage/storage.service';
import { memoryUpload, randomFileKey } from '../platform/storage/upload.util';

const STUDENT_PHOTOS_PREFIX = 'students';
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Get()
  findAll(
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.studentsService.findAll({
      classId: classId ? parseInt(classId, 10) : undefined,
      sectionId: sectionId ? parseInt(sectionId, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.findById(id);
  }

  // Streams the student's photo through this server instead of the browser
  // fetching it directly from the storage bucket — the bucket sends no
  // Access-Control-Allow-Origin header, so a browser-side fetch() (needed to
  // embed the photo in a generated PDF, unlike a plain <img src>) fails with
  // a CORS error. A server-to-server fetch isn't subject to CORS at all, and
  // this server already sends its own CORS headers on every response.
  @Get(':id/photo')
  async getPhoto(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const student = await this.studentsService.findById(id);
    if (!student.photoUrl) {
      throw new NotFoundException('This student has no photo');
    }
    const upstream = await fetch(student.photoUrl);
    if (!upstream.ok || !upstream.body) {
      throw new NotFoundException('Photo could not be retrieved from storage');
    }
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buffer);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Post(':id/photo')
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('photo', memoryUpload(ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE)),
  )
  async uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No photo uploaded');
    }
    const url = await this.storage.upload(
      randomFileKey(STUDENT_PHOTOS_PREFIX, file.originalname),
      file.buffer,
      file.mimetype,
    );
    return this.studentsService.setPhoto(id, url);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.remove(id);
  }
}
