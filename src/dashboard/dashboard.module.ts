import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { ClassEntity } from '../academics/entities/class.entity';
import { Section } from '../academics/entities/section.entity';
import { AttendanceLog } from '../attendance/entities/attendance-log.entity';
import { Exam } from '../exams/entities/exam.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Student, ClassEntity, Section, AttendanceLog, Exam])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
