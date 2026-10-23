import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherSalary } from './entities/teacher-salary.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { CreateTeacherSalaryDto, BulkGenerateSalaryDto } from './dto/teacher-salary.dto';
import { RecordPaymentDto, VoidRecordDto } from './dto/payment.dto';
import { RecordStatus } from './entities/enums';

export interface TeacherSalaryRow {
  id: number;
  teacherId: number;
  teacherName: string;
  amountDue: number;
  paid: number;
  remaining: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  periodMonth: number;
  periodYear: number;
  note: string | null;
  createdAt: Date;
}

export interface TeacherSalaryFilters {
  teacherId?: number;
  periodMonth?: number;
  periodYear?: number;
  status?: 'PAID' | 'PARTIAL' | 'UNPAID';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TeacherSalaryService {
  constructor(
    @InjectRepository(TeacherSalary) private readonly salariesRepo: Repository<TeacherSalary>,
    @InjectRepository(SalaryPayment) private readonly paymentsRepo: Repository<SalaryPayment>,
  ) {}

  async create(dto: CreateTeacherSalaryDto, createdById: number): Promise<TeacherSalary> {
    try {
      return await this.salariesRepo.save(this.salariesRepo.create({ ...dto, note: dto.note ?? null, createdById }));
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('This teacher already has a salary record for this month');
      }
      throw err;
    }
  }

  async bulkGenerate(dto: BulkGenerateSalaryDto, createdById: number): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const teacherId of dto.teacherIds) {
      try {
        await this.salariesRepo.save(
          this.salariesRepo.create({
            teacherId,
            amountDue: dto.amountDue,
            periodMonth: dto.periodMonth,
            periodYear: dto.periodYear,
            createdById,
          }),
        );
        created += 1;
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }
    return { created, skipped };
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
  }

  async findAll(filters: TeacherSalaryFilters): Promise<{ rows: TeacherSalaryRow[]; total: number }> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 50, 200);

    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      conditions.push(clause.replace('?', `$${params.length}`));
    };
    if (filters.teacherId) push('ts.teacher_id = ?', filters.teacherId);
    if (filters.periodMonth) push('ts.period_month = ?', filters.periodMonth);
    if (filters.periodYear) push('ts.period_year = ?', filters.periodYear);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const statusHaving = filters.status ? `WHERE status = '${filters.status}'` : '';

    const sql = `
      SELECT * FROM (
        SELECT
          ts.id AS "id",
          ts.teacher_id AS "teacherId",
          u.name AS "teacherName",
          ts.amount_due AS "amountDue",
          COALESCE(p.paid, 0)::int AS "paid",
          (ts.amount_due - COALESCE(p.paid, 0))::int AS "remaining",
          CASE
            WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID'
            WHEN COALESCE(p.paid, 0) >= ts.amount_due THEN 'PAID'
            ELSE 'PARTIAL'
          END AS "status",
          ts.period_month AS "periodMonth",
          ts.period_year AS "periodYear",
          ts.note AS "note",
          ts.created_at AS "createdAt"
        FROM teacher_salaries ts
        JOIN users u ON u.id = ts.teacher_id
        LEFT JOIN (
          SELECT teacher_salary_id, SUM(amount) AS paid
          FROM salary_payments
          WHERE status = 'active'
          GROUP BY teacher_salary_id
        ) p ON p.teacher_salary_id = ts.id
        ${where}
      ) x
      ${statusHaving}
      ORDER BY "periodYear" DESC, "periodMonth" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `
      SELECT COUNT(*)::int AS count FROM (
        SELECT
          ts.id,
          ts.amount_due,
          COALESCE(p.paid, 0) AS paid,
          CASE
            WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID'
            WHEN COALESCE(p.paid, 0) >= ts.amount_due THEN 'PAID'
            ELSE 'PARTIAL'
          END AS status
        FROM teacher_salaries ts
        LEFT JOIN (
          SELECT teacher_salary_id, SUM(amount) AS paid
          FROM salary_payments
          WHERE status = 'active'
          GROUP BY teacher_salary_id
        ) p ON p.teacher_salary_id = ts.id
        ${where}
      ) x
      ${statusHaving}
    `;

    const [rows, countResult] = await Promise.all([
      this.salariesRepo.manager.query(sql, [...params, pageSize, (page - 1) * pageSize]),
      this.salariesRepo.manager.query(countSql, params),
    ]);
    return { rows, total: countResult[0]?.count ?? 0 };
  }

  async findById(id: number): Promise<TeacherSalaryRow & { payments: SalaryPayment[] }> {
    const [row] = await this.salariesRepo.manager.query(
      `
      SELECT
        ts.id AS "id", ts.teacher_id AS "teacherId", u.name AS "teacherName",
        ts.amount_due AS "amountDue", COALESCE(p.paid, 0)::int AS "paid",
        (ts.amount_due - COALESCE(p.paid, 0))::int AS "remaining",
        CASE WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID' WHEN COALESCE(p.paid, 0) >= ts.amount_due THEN 'PAID' ELSE 'PARTIAL' END AS "status",
        ts.period_month AS "periodMonth", ts.period_year AS "periodYear", ts.note AS "note", ts.created_at AS "createdAt"
      FROM teacher_salaries ts
      JOIN users u ON u.id = ts.teacher_id
      LEFT JOIN (SELECT teacher_salary_id, SUM(amount) AS paid FROM salary_payments WHERE status = 'active' GROUP BY teacher_salary_id) p ON p.teacher_salary_id = ts.id
      WHERE ts.id = $1
      `,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Teacher salary record not found');
    }
    const payments = await this.paymentsRepo.find({ where: { teacherSalaryId: id }, order: { createdAt: 'DESC' } });
    return { ...row, payments };
  }

  async recordPayment(teacherSalaryId: number, dto: RecordPaymentDto, paidById: number): Promise<SalaryPayment> {
    return this.salariesRepo.manager.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const existing = await manager.findOne(SalaryPayment, { where: { idempotencyKey: dto.idempotencyKey } });
        if (existing) return existing;
      }

      const salary = await manager
        .createQueryBuilder(TeacherSalary, 'ts')
        .setLock('pessimistic_write')
        .where('ts.id = :id', { id: teacherSalaryId })
        .getOne();
      if (!salary) {
        throw new NotFoundException('Teacher salary record not found');
      }

      const { sum } = await manager
        .createQueryBuilder(SalaryPayment, 'p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .where('p.teacherSalaryId = :id AND p.status = :status', {
          id: teacherSalaryId,
          status: RecordStatus.ACTIVE,
        })
        .getRawOne<{ sum: string }>();
      const paidSoFar = parseInt(sum, 10);
      const remaining = salary.amountDue - paidSoFar;

      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Payment of ${dto.amount} exceeds the remaining due of ${remaining} — advance payments aren't supported`,
        );
      }

      const payment = await manager.save(
        SalaryPayment,
        manager.create(SalaryPayment, {
          teacherSalaryId,
          amount: dto.amount,
          method: dto.method,
          paidAt: dto.paidAt,
          note: dto.note ?? null,
          paidById,
          idempotencyKey: dto.idempotencyKey ?? null,
        }),
      );
      payment.receiptNumber = `RCPT-T-${String(payment.id).padStart(6, '0')}`;
      return manager.save(SalaryPayment, payment);
    });
  }

  async voidPayment(paymentId: number, dto: VoidRecordDto, voidedById: number): Promise<SalaryPayment> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Salary payment not found');
    }
    if (payment.status === RecordStatus.VOIDED) {
      throw new ConflictException('Payment is already voided');
    }
    payment.status = RecordStatus.VOIDED;
    payment.voidReason = dto.reason;
    payment.voidedById = voidedById;
    payment.voidedAt = new Date();
    return this.paymentsRepo.save(payment);
  }
}
