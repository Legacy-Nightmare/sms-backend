import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { ClassEntity } from '../academics/entities/class.entity';
import { Section } from '../academics/entities/section.entity';
import { AttendanceLog } from '../attendance/entities/attendance-log.entity';
import { Exam } from '../exams/entities/exam.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Student) private readonly studentsRepo: Repository<Student>,
    @InjectRepository(ClassEntity) private readonly classesRepo: Repository<ClassEntity>,
    @InjectRepository(Section) private readonly sectionsRepo: Repository<Section>,
    @InjectRepository(AttendanceLog) private readonly attendanceRepo: Repository<AttendanceLog>,
    @InjectRepository(Exam) private readonly examsRepo: Repository<Exam>,
  ) {}

  async getSummary() {
    const [totalStudents, totalClasses, totalSections] = await Promise.all([
      this.studentsRepo.count({ where: { isActive: true } }),
      this.classesRepo.count(),
      this.sectionsRepo.count(),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const presentToday = await this.attendanceRepo
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.studentId)', 'count')
      .where('log.punchTime BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
      .getRawOne<{ count: string }>();

    const unpublishedExams = await this.examsRepo.find({
      where: { publishedAt: IsNull() },
      relations: { classEntity: true },
      order: { createdAt: 'DESC' },
    });

    return {
      totalStudents,
      totalClasses,
      totalSections,
      presentToday: parseInt(presentToday?.count ?? '0', 10),
      unpublishedExams: unpublishedExams.map((e) => ({
        id: e.id,
        name: e.name,
        className: e.classEntity.name,
        classId: e.classId,
      })),
    };
  }

  async getAttendanceTrend() {
    const totalStudents = await this.studentsRepo.count({ where: { isActive: true } });

    const days: Array<{ date: string; present: number; absent: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);

      const row = await this.attendanceRepo
        .createQueryBuilder('log')
        .select('COUNT(DISTINCT log.studentId)', 'count')
        .where('log.punchTime BETWEEN :start AND :end', { start, end })
        .getRawOne<{ count: string }>();

      const present = parseInt(row?.count ?? '0', 10);
      days.push({
        date: start.toISOString().slice(0, 10),
        present,
        absent: Math.max(totalStudents - present, 0),
      });
    }

    return days;
  }
}
