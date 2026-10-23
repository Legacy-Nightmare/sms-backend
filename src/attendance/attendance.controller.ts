import {
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';
import { parseAttendancePunches } from './adms-parser';
import { buildHandshakeResponse } from './adms-handshake';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('attendance')
@Controller()
export class AttendanceController {
  private readonly logger = new Logger(AttendanceController.name);

  constructor(private readonly attendanceService: AttendanceService) {}

  // ZKTeco device init handshake: GET /iclock/cdata?SN=...&options=all
  // Excluded from Swagger: this is the raw ZKTeco wire protocol (plain-text
  // handshake lines), not a JSON REST endpoint, so it'd just be noise there.
  @ApiExcludeEndpoint()
  @Get('iclock/cdata')
  handleCDataInit(@Query('SN') sn: string, @Res() res: Response) {
    const body = buildHandshakeResponse(sn ?? '');
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(body);
  }

  // ZKTeco attendance upload: POST /iclock/cdata?SN=...&table=ATTLOG
  @ApiExcludeEndpoint()
  @Post('iclock/cdata')
  async handleCDataPost(@Req() req: Request, @Query('SN') sn: string, @Res() res: Response) {
    const payload = typeof req.body === 'string' ? req.body : '';
    const punches = parseAttendancePunches(payload);
    this.logger.log(`ATTLOG push from SN=${sn}: ${punches.length} punch line(s) parsed`);

    const inserted = await this.attendanceService.recordPunches(sn ?? '', punches);
    this.logger.log(`Inserted ${inserted} new attendance log(s) for SN=${sn}`);

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('OK');
  }

  // ZKTeco heartbeat poll. No remote command queue in this MVP, so always "OK".
  @ApiExcludeEndpoint()
  @Get('iclock/getrequest')
  handleGetRequest(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('OK');
  }

  // Device reports back the result of a command we sent it. Unused for now
  // since we never send commands, but devices may still poll/post here.
  @ApiExcludeEndpoint()
  @Post('iclock/devicecmd')
  handleDeviceCmd(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('OK');
  }

  @ApiBearerAuth()
  @Get('attendance/recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  findRecent(@Query('limit') limit?: string) {
    return this.attendanceService.findRecent(limit ? parseInt(limit, 10) : 10);
  }

  // Two modes: ?studentId= for one student's history (from/to range), or
  // ?classId= (+optional sectionId, date) for a whole class's present/absent
  // roster on a single day — the Attendance page's main view.
  @ApiBearerAuth()
  @Get('attendance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  findAttendance(
    @Query('studentId') studentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('date') date?: string,
  ) {
    if (studentId) {
      return this.attendanceService.findForStudent(
        parseInt(studentId, 10),
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      );
    }
    return this.attendanceService.findByClassAndDate(
      parseInt(classId!, 10),
      sectionId ? parseInt(sectionId, 10) : undefined,
      date ? new Date(date) : new Date(),
    );
  }
}
