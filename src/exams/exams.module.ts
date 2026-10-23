import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subject } from './entities/subject.entity';
import { Exam } from './entities/exam.entity';
import { Mark } from './entities/mark.entity';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { StudentsModule } from '../students/students.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicsModule } from '../academics/academics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subject, Exam, Mark]),
    StudentsModule,
    NotificationsModule,
    AcademicsModule,
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
