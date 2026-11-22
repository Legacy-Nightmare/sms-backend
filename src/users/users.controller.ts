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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateRole(id, dto.role, dto.teacherId);
  }

  @Put(':id/active')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserActiveDto,
    @Req() req: Request,
  ) {
    if (!dto.isActive) this.assertNotSelf(id, req, 'deactivate');
    return this.usersService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    this.assertNotSelf(id, req, 'delete');
    return this.usersService.remove(id);
  }

  // F-07: an admin who deactivates/deletes their own account locks
  // themselves out, and if they're the only admin, locks everyone out.
  private assertNotSelf(id: number, req: Request, action: string) {
    if ((req.user as { userId: number }).userId === id) {
      throw new BadRequestException(`You can't ${action} your own account`);
    }
  }
}
