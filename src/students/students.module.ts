import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { AcademicsModule } from '../academics/academics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Student, Guardian]), AcademicsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
