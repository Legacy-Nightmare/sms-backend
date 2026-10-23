import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { FeeTypesService } from './fee-types.service';
import { StudentFeesService } from './student-fees.service';
import { TeacherSalaryService } from './teacher-salary.service';
import { ExpensesService } from './expenses.service';
import { FinanceReportService } from './finance-report.service';
import { CreateFeeTypeDto } from './dto/fee-type.dto';
import { UpsertClassFeeDto } from './dto/class-fee.dto';
import { CreateStudentFeeDto, BulkApplyFeeDto } from './dto/student-fee.dto';
import { RecordPaymentDto, VoidRecordDto } from './dto/payment.dto';
import { CreateTeacherSalaryDto, BulkGenerateSalaryDto } from './dto/teacher-salary.dto';
import { CreateExpenseDto } from './dto/expense.dto';

function currentUserId(req: Request): number {
  return (req.user as { userId: number }).userId;
}

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.FINANCE)
export class FinanceController {
  constructor(
    private readonly feeTypesService: FeeTypesService,
    private readonly studentFeesService: StudentFeesService,
    private readonly teacherSalaryService: TeacherSalaryService,
    private readonly expensesService: ExpensesService,
    private readonly reportService: FinanceReportService,
    private readonly usersService: UsersService,
  ) {}

  // ---- fee types + per-class fee structure ----

  @Post('fee-types')
  createFeeType(@Body() dto: CreateFeeTypeDto) {
    return this.feeTypesService.create(dto);
  }

  @Get('fee-types')
  findFeeTypes() {
    return this.feeTypesService.findAll();
  }

  @Post('class-fees')
  upsertClassFee(@Body() dto: UpsertClassFeeDto) {
    return this.feeTypesService.upsertClassFee(dto);
  }

  @Get('class-fees')
  findClassFees(@Query('classId', ParseIntPipe) classId: number) {
    return this.feeTypesService.findClassFees(classId);
  }

  // ---- student fees + payments ----

  @Post('student-fees')
  createStudentFee(@Body() dto: CreateStudentFeeDto, @Req() req: Request) {
    return this.studentFeesService.create(dto, currentUserId(req));
  }

  @Post('student-fees/bulk')
  bulkApplyStudentFee(@Body() dto: BulkApplyFeeDto, @Req() req: Request) {
    return this.studentFeesService.bulkApply(dto, currentUserId(req));
  }

  @Get('student-fees')
  findStudentFees(
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('feeTypeId') feeTypeId?: string,
    @Query('status') status?: 'PAID' | 'PARTIAL' | 'UNPAID',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.studentFeesService.findAll({
      studentId: studentId ? parseInt(studentId, 10) : undefined,
      classId: classId ? parseInt(classId, 10) : undefined,
      feeTypeId: feeTypeId ? parseInt(feeTypeId, 10) : undefined,
      status,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('student-fees/:id')
  findStudentFeeById(@Param('id', ParseIntPipe) id: number) {
    return this.studentFeesService.findById(id);
  }

  @Post('student-fees/:id/payments')
  recordStudentPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @Req() req: Request,
  ) {
    return this.studentFeesService.recordPayment(id, dto, currentUserId(req));
  }

  @Post('payments/:id/void')
  voidStudentPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidRecordDto, @Req() req: Request) {
    return this.studentFeesService.voidPayment(id, dto, currentUserId(req));
  }

  // ---- teacher salary + payments ----

  @Get('teachers')
  findTeachers() {
    return this.usersService.findByRole(Role.TEACHER);
  }

  @Post('teacher-salaries')
  createTeacherSalary(@Body() dto: CreateTeacherSalaryDto, @Req() req: Request) {
    return this.teacherSalaryService.create(dto, currentUserId(req));
  }

  @Post('teacher-salaries/bulk')
  bulkGenerateSalary(@Body() dto: BulkGenerateSalaryDto, @Req() req: Request) {
    return this.teacherSalaryService.bulkGenerate(dto, currentUserId(req));
  }

  @Get('teacher-salaries')
  findTeacherSalaries(
    @Query('teacherId') teacherId?: string,
    @Query('periodMonth') periodMonth?: string,
    @Query('periodYear') periodYear?: string,
    @Query('status') status?: 'PAID' | 'PARTIAL' | 'UNPAID',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.teacherSalaryService.findAll({
      teacherId: teacherId ? parseInt(teacherId, 10) : undefined,
      periodMonth: periodMonth ? parseInt(periodMonth, 10) : undefined,
      periodYear: periodYear ? parseInt(periodYear, 10) : undefined,
      status,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('teacher-salaries/:id')
  findTeacherSalaryById(@Param('id', ParseIntPipe) id: number) {
    return this.teacherSalaryService.findById(id);
  }

  @Post('teacher-salaries/:id/payments')
  recordSalaryPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: RecordPaymentDto, @Req() req: Request) {
    return this.teacherSalaryService.recordPayment(id, dto, currentUserId(req));
  }

  @Post('salary-payments/:id/void')
  voidSalaryPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidRecordDto, @Req() req: Request) {
    return this.teacherSalaryService.voidPayment(id, dto, currentUserId(req));
  }

  // ---- expenses ----

  @Post('expenses')
  createExpense(@Body() dto: CreateExpenseDto, @Req() req: Request) {
    return this.expensesService.create(dto, currentUserId(req));
  }

  @Get('expenses')
  findExpenses(@Query('from') from?: string, @Query('to') to?: string, @Query('category') category?: string) {
    return this.expensesService.findAll({ from, to, category });
  }

  @Post('expenses/:id/void')
  voidExpense(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidRecordDto, @Req() req: Request) {
    return this.expensesService.void(id, dto, currentUserId(req));
  }

  // ---- report ----

  @Get('report/summary')
  getSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('feeTypeId') feeTypeId?: string,
    @Query('method') method?: string,
  ) {
    return this.reportService.getSummary({
      from,
      to,
      classId: classId ? parseInt(classId, 10) : undefined,
      studentId: studentId ? parseInt(studentId, 10) : undefined,
      feeTypeId: feeTypeId ? parseInt(feeTypeId, 10) : undefined,
      method,
    });
  }

  @Get('report/trend')
  getTrend(@Query('from') from: string, @Query('to') to: string) {
    return this.reportService.getTrend(from, to);
  }

  @Get('report/students-with-dues')
  getStudentsWithDues(
    @Query('classId') classId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reportService.getStudentsWithDues({
      classId: classId ? parseInt(classId, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }
}
