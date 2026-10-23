import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AttendanceLog } from './entities/attendance-log.entity';
import { StudentsService } from '../students/students.service';
import { ParsedPunch } from './adms-parser';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceLog)
    private readonly attendanceRepo: Repository<AttendanceLog>,
    private readonly studentsService: StudentsService,
  ) {}

  // Resolves each punch's biometric PIN to a student and persists it,
  // de-duping on (student, punch_time) via ON CONFLICT DO NOTHING — ZKTeco
  // devices resend unacknowledged batches, so the same punch can arrive
  // more than once.
  async recordPunches(
    deviceSn: string,
    punches: ParsedPunch[],
  ): Promise<number> {
    let inserted = 0;
    for (const punch of punches) {
      const student = await this.studentsService.findByBiometricId(
        punch.biometricId,
      );
      if (!student) {
        this.logger.warn(
          `Punch for unknown biometric ID ${punch.biometricId}, ignoring`,
        );
        continue;
      }

      const result = await this.attendanceRepo
        .createQueryBuilder()
        .insert()
        .into(AttendanceLog)
        .values({ studentId: student.id, deviceSn, punchTime: punch.punchTime })
        .orIgnore()
        .execute();
      if (result.identifiers.length > 0) {
        inserted += 1;
      }
    }
    return inserted;
  }

  findForStudent(
    studentId: number,
    from?: Date,
    to?: Date,
  ): Promise<AttendanceLog[]> {
    return this.attendanceRepo.find({
      where: {
        studentId,
        ...(from && to ? { punchTime: Between(from, to) } : {}),
      },
      order: { punchTime: 'DESC' },
    });
  }

  // Latest punches across every student, for the dashboard's "live from
  // device" feed. Joins student + class + section so the UI doesn't need a
  // second round trip per row.
  async findRecent(limit: number) {
    const logs = await this.attendanceRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.student', 'student')
      .leftJoinAndSelect('student.classEntity', 'classEntity')
      .leftJoinAndSelect('student.section', 'section')
      .orderBy('log.punchTime', 'DESC')
      .take(limit)
      .getMany();

    return logs.map((log) => ({
      id: log.id,
      studentId: log.studentId,
      studentName: log.student.name,
      studentCode: log.student.code,
      className: log.student.classEntity.name,
      sectionName: log.student.section.name,
      deviceSn: log.deviceSn,
      punchTime: log.punchTime,
    }));
  }

  // Attendance for a whole class(+section) on a single day, marking every
  // student without a punch that day as absent rather than just omitting
  // them — the device only ever reports who showed up.
  async findByClassAndDate(
    classId: number,
    sectionId: number | undefined,
    date: Date,
  ) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const students = await this.studentsService.findAll({ classId, sectionId });
    const studentIds = students.map((s) => s.id);

    const logs = studentIds.length
      ? await this.attendanceRepo.find({
          where: {
            studentId: In(studentIds),
            punchTime: Between(dayStart, dayEnd),
          },
        })
      : [];
    const logByStudent = new Map(logs.map((log) => [log.studentId, log]));

    return students
      .filter((s) => s.isActive)
      .map((student) => {
        const log = logByStudent.get(student.id);
        return {
          studentId: student.id,
          studentCode: student.code,
          studentName: student.name,
          photoUrl: student.photoUrl,
          punchTime: log?.punchTime ?? null,
          deviceSn: log?.deviceSn ?? null,
          status: log ? 'present' : 'absent',
        };
      });
  }
}
