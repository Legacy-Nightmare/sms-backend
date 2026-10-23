import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('notices')
@ApiBearerAuth()
@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TEACHER)
  create(@Body() dto: CreateNoticeDto, @Req() req: Request) {
    const user = req.user as { userId: number };
    return this.noticesService.create(dto, user.userId);
  }

  @Get()
  findAll() {
    return this.noticesService.findAll();
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateNoticeDto) {
    return this.noticesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.noticesService.remove(id);
  }

  @Post(':id/publish')
  @Roles(Role.ADMIN, Role.TEACHER)
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.noticesService.publish(id);
  }

  @Post(':id/publish-to-website')
  @Roles(Role.ADMIN, Role.TEACHER)
  publishToWebsite(@Param('id', ParseIntPipe) id: number) {
    return this.noticesService.publishToWebsite(id);
  }

  @Post(':id/unpublish-from-website')
  @Roles(Role.ADMIN, Role.TEACHER)
  unpublishFromWebsite(@Param('id', ParseIntPipe) id: number) {
    return this.noticesService.unpublishFromWebsite(id);
  }
}
