import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcademicsService } from './academics.service';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateResultWeightsDto } from './dto/update-result-weights.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('academics')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Post('classes')
  @Roles(Role.ADMIN)
  createClass(@Body() dto: CreateClassDto) {
    return this.academicsService.createClass(dto);
  }

  @Get('classes')
  findAllClasses() {
    return this.academicsService.findAllClasses();
  }

  @Put('classes/:id/result-weights')
  @Roles(Role.ADMIN)
  updateResultWeights(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateResultWeightsDto,
  ) {
    return this.academicsService.updateResultWeights(id, dto);
  }

  @Post('sections')
  @Roles(Role.ADMIN)
  createSection(@Body() dto: CreateSectionDto) {
    return this.academicsService.createSection(dto);
  }

  @Get('sections')
  findSections(@Query('classId', ParseIntPipe) classId: number) {
    return this.academicsService.findSectionsByClass(classId);
  }

  @Put('sections/:id')
  @Roles(Role.ADMIN)
  updateSection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.academicsService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @Roles(Role.ADMIN)
  removeSection(@Param('id', ParseIntPipe) id: number) {
    return this.academicsService.removeSection(id);
  }
}
