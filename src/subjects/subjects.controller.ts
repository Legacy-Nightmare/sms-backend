import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectCatalogDto } from './dto/create-subject-catalog.dto';
import { UpdateSubjectCatalogDto } from './dto/update-subject-catalog.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// The reusable subject catalog — distinct from exams' /subjects routes,
// which manage a single class's own copy of one of these (name + marks
// total), attached by subjectId.
@ApiTags('subject-catalog')
@ApiBearerAuth()
@Controller('subject-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSubjectCatalogDto) {
    return this.subjectsService.create(dto);
  }

  @Get()
  findAll() {
    return this.subjectsService.findAll();
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectCatalogDto) {
    return this.subjectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.subjectsService.remove(id);
  }
}
