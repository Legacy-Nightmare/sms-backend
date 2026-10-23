import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeType } from './entities/fee-type.entity';
import { ClassFee } from './entities/class-fee.entity';
import { StudentFee } from './entities/student-fee.entity';
import { Payment } from './entities/payment.entity';
import { TeacherSalary } from './entities/teacher-salary.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { Expense } from './entities/expense.entity';
import { FeeTypesService } from './fee-types.service';
import { StudentFeesService } from './student-fees.service';
import { TeacherSalaryService } from './teacher-salary.service';
import { ExpensesService } from './expenses.service';
import { FinanceReportService } from './finance-report.service';
import { FinanceController } from './finance.controller';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeeType, ClassFee, StudentFee, Payment, TeacherSalary, SalaryPayment, Expense]),
    StudentsModule,
    UsersModule,
  ],
  controllers: [FinanceController],
  providers: [FeeTypesService, StudentFeesService, TeacherSalaryService, ExpensesService, FinanceReportService],
})
export class FinanceModule {}
