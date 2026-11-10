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
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { SetAssignmentsDto } from './dto/set-assignments.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { StorageService } from '../platform/storage/storage.service';
import { memoryUpload, randomFileKey } from '../platform/storage/upload.util';

const TEACHER_PHOTOS_PREFIX = 'teachers';
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

// Class-level default of ADMIN+FINANCE — finance legitimately needs to
// read the roster (names, salary) to run payroll; a plain TEACHER account
// must not be able to list every other teacher's salary and NID, so that
// role is deliberately left out of the default and only admin-only routes
// below exist for anything mutating.
@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.FINANCE)
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Get()
  findAll() {
    return this.teachersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teachersService.findById(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Put(':id/assignments')
  @Roles(Role.ADMIN)
  setAssignments(@Param('id', ParseIntPipe) id: number, @Body() dto: SetAssignmentsDto) {
    return this.teachersService.setAssignments(id, dto.classSubjectIds);
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
      randomFileKey(TEACHER_PHOTOS_PREFIX, file.originalname),
      file.buffer,
      file.mimetype,
    );
    return this.teachersService.setPhoto(id, url);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teachersService.remove(id);
  }
}
