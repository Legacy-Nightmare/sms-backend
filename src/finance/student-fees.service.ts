import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentFee } from './entities/student-fee.entity';
import { Payment } from './entities/payment.entity';
import { FeeTypesService } from './fee-types.service';
import { StudentsService } from '../students/students.service';
import {
  CreateStudentFeeDto,
  BulkApplyFeeDto,
  CreateMultiStudentFeeDto,
  UpdateStudentFeeDto,
} from './dto/student-fee.dto';
import { RecordPaymentDto, VoidRecordDto } from './dto/payment.dto';
import { RecordStatus } from './entities/enums';

export interface StudentFeeRow {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  roll: number;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  feeTypeId: number;
  feeTypeName: string;
  amountDue: number;
  paid: number;
  remaining: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  periodMonth: number | null;
  periodYear: number | null;
  note: string | null;
  createdAt: Date;
}

export interface StudentFeeFilters {
  studentId?: number;
  classId?: number;
  sectionId?: number;
  feeTypeId?: number;
  status?: 'PAID' | 'PARTIAL' | 'UNPAID';
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface StudentFeeSummary {
  totalBilled: number;
  collected: number;
  outstanding: number;
}

// Payment with receivedBy flattened to just a name — never return the full
// User relation (it carries the password hash), matching the lesson learned
// from the earlier users.service.ts leak. Fields are listed explicitly
// rather than derived from Payment so a future relation added to that
// entity can't leak here by accident.
export interface PaymentRow {
  id: number;
  studentFeeId: number;
  amount: number;
  method: Payment['method'];
  paidAt: string;
  receiptNumber: string | null;
  receivedById: number | null;
  receivedByName: string | null;
  note: string | null;
  status: Payment['status'];
  voidReason: string | null;
  voidedById: number | null;
  voidedAt: Date | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

@Injectable()
export class StudentFeesService {
  constructor(
    @InjectRepository(StudentFee)
    private readonly studentFeesRepo: Repository<StudentFee>,
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    private readonly feeTypesService: FeeTypesService,
    private readonly studentsService: StudentsService,
  ) {}

  async create(
    dto: CreateStudentFeeDto,
    createdById: number,
  ): Promise<StudentFee> {
    await this.studentsService.findById(dto.studentId);
    await this.feeTypesService.findById(dto.feeTypeId);
    try {
      const fee = this.studentFeesRepo.create({
        studentId: dto.studentId,
        feeTypeId: dto.feeTypeId,
        amountDue: dto.amountDue,
        periodMonth: dto.periodMonth ?? null,
        periodYear: dto.periodYear ?? null,
        note: dto.note ?? null,
        createdById,
      });
      return await this.studentFeesRepo.save(fee);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException(
          'This student already has a fee of this type for this period',
        );
      }
      throw err;
    }
  }

  // Bills every active student in a class at once. Students already billed
  // for the same fee type + period are skipped (not duplicated) — the
  // unique constraint is the backstop, this just avoids noisy errors for
  // the common case of re-running it.
  async bulkApply(
    dto: BulkApplyFeeDto,
    createdById: number,
  ): Promise<{ created: number; skipped: number }> {
    await this.feeTypesService.findById(dto.feeTypeId);
    const students = await this.studentsService.findAll({
      classId: dto.classId,
    });

    let created = 0;
    let skipped = 0;
    for (const student of students) {
      try {
        await this.studentFeesRepo.save(
          this.studentFeesRepo.create({
            studentId: student.id,
            feeTypeId: dto.feeTypeId,
            amountDue: dto.amount,
            periodMonth: dto.periodMonth ?? null,
            periodYear: dto.periodYear ?? null,
            note: dto.note ?? null,
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

  // Bills a fixed set of named fees (Admission Fee, Session Fee, Exam Fee,
  // ...) for one student in a single submission — the "Add fee" form. Each
  // named fee is resolved/created on the fly via FeeTypesService, and a fee
  // the student's already been billed for in this period is skipped rather
  // than aborting the whole batch (same reasoning as bulkApply above).
  async createMultiple(
    dto: CreateMultiStudentFeeDto,
    createdById: number,
  ): Promise<{ created: Array<{ id: number; name: string; amount: number }>; skipped: string[] }> {
    await this.studentsService.findById(dto.studentId);

    // Row ids/amounts are returned (not just a count) so the caller can
    // immediately record a payment against each one — the "Add fee" form's
    // payment-status field (paid/partial/unpaid at billing time).
    const created: Array<{ id: number; name: string; amount: number }> = [];
    const skipped: string[] = [];
    for (const entry of dto.fees) {
      const feeType = await this.feeTypesService.findOrCreateByName(entry.name);
      try {
        const fee = await this.studentFeesRepo.save(
          this.studentFeesRepo.create({
            studentId: dto.studentId,
            feeTypeId: feeType.id,
            amountDue: entry.amount,
            periodMonth: dto.periodMonth ?? null,
            periodYear: dto.periodYear ?? null,
            note: dto.note ?? null,
            createdById,
          }),
        );
        created.push({ id: fee.id, name: entry.name, amount: entry.amount });
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          skipped.push(entry.name);
          continue;
        }
        throw err;
      }
    }
    return { created, skipped };
  }

  // Metadata-only edit (amount/period/note) — never touches payments.
  // Rejected if the new amount would be less than what's already been paid,
  // since that would make "remaining" negative.
  async update(id: number, dto: UpdateStudentFeeDto): Promise<StudentFee> {
    const fee = await this.studentFeesRepo.findOne({ where: { id } });
    if (!fee) {
      throw new NotFoundException('Student fee not found');
    }

    if (dto.amountDue !== undefined) {
      const { sum } = await this.paymentsRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .where('p.studentFeeId = :id AND p.status = :status', {
          id,
          status: RecordStatus.ACTIVE,
        })
        .getRawOne<{ sum: string }>();
      const paidSoFar = parseInt(sum, 10);
      if (dto.amountDue < paidSoFar) {
        throw new BadRequestException(
          `Can't set the amount due below ${paidSoFar} — that's already been paid`,
        );
      }
      fee.amountDue = dto.amountDue;
    }
    if (dto.periodMonth !== undefined) fee.periodMonth = dto.periodMonth;
    if (dto.periodYear !== undefined) fee.periodYear = dto.periodYear;
    if (dto.note !== undefined) fee.note = dto.note;
    return this.studentFeesRepo.save(fee);
  }

  // Payments are append-only (voided, never deleted — see Payment entity),
  // and the FK from payments to student_fees cascades on delete, so a fee
  // that's ever had a payment (even a voided one) can't be removed without
  // silently destroying that audit trail. Only a never-paid bill can go.
  async remove(id: number): Promise<void> {
    const fee = await this.studentFeesRepo.findOne({ where: { id } });
    if (!fee) {
      throw new NotFoundException('Student fee not found');
    }
    const paymentCount = await this.paymentsRepo.count({ where: { studentFeeId: id } });
    if (paymentCount > 0) {
      throw new ConflictException(
        'This fee has payment history and cannot be deleted — void the payment(s) first if the bill itself was wrong',
      );
    }
    await this.studentFeesRepo.delete(id);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === '23505'
    );
  }

  // One query per page: the paid-so-far sum is a correlated subquery
  // (SQL-side aggregation, not loaded-then-summed-in-JS), and status is
  // filtered via an outer query over that computed column so filtering and
  // pagination both happen in Postgres, not after fetching everything.
  async findAll(
    filters: StudentFeeFilters,
  ): Promise<{ rows: StudentFeeRow[]; total: number; summary: StudentFeeSummary }> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 50, 200);

    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      conditions.push(clause.replace('?', `$${params.length}`));
    };
    if (filters.studentId) push('sf.student_id = ?', filters.studentId);
    if (filters.classId) push('s.class_id = ?', filters.classId);
    if (filters.sectionId) push('s.section_id = ?', filters.sectionId);
    if (filters.feeTypeId) push('sf.fee_type_id = ?', filters.feeTypeId);
    if (filters.from) push('sf.created_at::date >= ?', filters.from);
    if (filters.to) push('sf.created_at::date <= ?', filters.to);
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const statusHaving = filters.status
      ? `WHERE status = '${filters.status}'` // enum-like value from our own code, not user-concatenated SQL
      : '';

    // Shared by the page query, the count, and the summary totals below — a
    // bare base (no SELECT, no closing alias) so each caller wraps it with
    // only the aggregation it needs, over identical filters.
    const base = `
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      JOIN classes c ON c.id = s.class_id
      JOIN sections sec ON sec.id = s.section_id
      JOIN fee_types ft ON ft.id = sf.fee_type_id
      LEFT JOIN (
        SELECT student_fee_id, SUM(amount) AS paid
        FROM payments
        WHERE status = 'active'
        GROUP BY student_fee_id
      ) p ON p.student_fee_id = sf.id
      ${where}
    `;
    const computedColumns = `
      sf.amount_due AS "amountDue",
      COALESCE(p.paid, 0)::int AS "paid",
      (sf.amount_due - COALESCE(p.paid, 0))::int AS "remaining",
      CASE
        WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID'
        WHEN COALESCE(p.paid, 0) >= sf.amount_due THEN 'PAID'
        ELSE 'PARTIAL'
      END AS "status"
    `;

    const sql = `
      SELECT * FROM (
        SELECT
          sf.id AS "id",
          sf.student_id AS "studentId",
          s.name AS "studentName",
          s.code AS "studentCode",
          s.roll AS "roll",
          s.class_id AS "classId",
          c.name AS "className",
          s.section_id AS "sectionId",
          sec.name AS "sectionName",
          sf.fee_type_id AS "feeTypeId",
          ft.name AS "feeTypeName",
          ${computedColumns},
          sf.period_month AS "periodMonth",
          sf.period_year AS "periodYear",
          sf.note AS "note",
          sf.created_at AS "createdAt"
        ${base}
      ) x
      ${statusHaving}
      ORDER BY "createdAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `
      SELECT COUNT(*)::int AS count FROM (
        SELECT sf.id, ${computedColumns}
        ${base}
      ) x
      ${statusHaving}
    `;
    const summarySql = `
      SELECT
        COALESCE(SUM("amountDue"), 0)::int AS "totalBilled",
        COALESCE(SUM("paid"), 0)::int AS "collected",
        COALESCE(SUM("remaining"), 0)::int AS "outstanding"
      FROM (
        SELECT sf.id, ${computedColumns}
        ${base}
      ) x
      ${statusHaving}
    `;

    const [rows, countResult, summaryResult] = await Promise.all([
      this.studentFeesRepo.manager.query(sql, [
        ...params,
        pageSize,
        (page - 1) * pageSize,
      ]),
      this.studentFeesRepo.manager.query(countSql, params),
      this.studentFeesRepo.manager.query(summarySql, params),
    ]);

    return {
      rows,
      total: countResult[0]?.count ?? 0,
      summary: summaryResult[0] ?? { totalBilled: 0, collected: 0, outstanding: 0 },
    };
  }

  async findById(
    id: number,
  ): Promise<StudentFeeRow & { payments: PaymentRow[] }> {
    const [row] = await this.studentFeesRepo.manager.query(
      `
      SELECT
        sf.id AS "id", sf.student_id AS "studentId", s.name AS "studentName", s.code AS "studentCode",
        s.roll AS "roll", s.class_id AS "classId", c.name AS "className",
        s.section_id AS "sectionId", sec.name AS "sectionName",
        sf.fee_type_id AS "feeTypeId", ft.name AS "feeTypeName",
        sf.amount_due AS "amountDue", COALESCE(p.paid, 0)::int AS "paid",
        (sf.amount_due - COALESCE(p.paid, 0))::int AS "remaining",
        CASE WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID' WHEN COALESCE(p.paid, 0) >= sf.amount_due THEN 'PAID' ELSE 'PARTIAL' END AS "status",
        sf.period_month AS "periodMonth", sf.period_year AS "periodYear", sf.note AS "note", sf.created_at AS "createdAt"
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      JOIN classes c ON c.id = s.class_id
      JOIN sections sec ON sec.id = s.section_id
      JOIN fee_types ft ON ft.id = sf.fee_type_id
      LEFT JOIN (SELECT student_fee_id, SUM(amount) AS paid FROM payments WHERE status = 'active' GROUP BY student_fee_id) p ON p.student_fee_id = sf.id
      WHERE sf.id = $1
      `,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Student fee not found');
    }
    const payments = await this.paymentsRepo.find({
      where: { studentFeeId: id },
      relations: { receivedBy: true },
      order: { createdAt: 'DESC' },
    });
    const paymentRows: PaymentRow[] = payments.map((payment) => ({
      id: payment.id,
      studentFeeId: payment.studentFeeId,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.paidAt,
      receiptNumber: payment.receiptNumber,
      receivedById: payment.receivedById,
      receivedByName: payment.receivedBy?.name ?? null,
      note: payment.note,
      status: payment.status,
      voidReason: payment.voidReason,
      voidedById: payment.voidedById,
      voidedAt: payment.voidedAt,
      idempotencyKey: payment.idempotencyKey,
      createdAt: payment.createdAt,
    }));
    return { ...row, payments: paymentRows };
  }

  // Locks the StudentFee row for the duration of the transaction so two
  // concurrent payments against the same fee can't both read the same
  // "remaining" and both think there's room, overpaying the fee.
  async recordPayment(
    studentFeeId: number,
    dto: RecordPaymentDto,
    receivedById: number,
  ): Promise<Payment> {
    return this.studentFeesRepo.manager.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const existing = await manager.findOne(Payment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) return existing;
      }

      const fee = await manager
        .createQueryBuilder(StudentFee, 'sf')
        .setLock('pessimistic_write')
        .where('sf.id = :id', { id: studentFeeId })
        .getOne();
      if (!fee) {
        throw new NotFoundException('Student fee not found');
      }

      const { sum } = await manager
        .createQueryBuilder(Payment, 'p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .where('p.studentFeeId = :id AND p.status = :status', {
          id: studentFeeId,
          status: RecordStatus.ACTIVE,
        })
        .getRawOne<{ sum: string }>();
      const paidSoFar = parseInt(sum, 10);
      const remaining = fee.amountDue - paidSoFar;

      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Payment of ${dto.amount} exceeds the remaining due of ${remaining} — advance payments aren't supported`,
        );
      }

      const payment = await manager.save(
        Payment,
        manager.create(Payment, {
          studentFeeId,
          amount: dto.amount,
          method: dto.method,
          paidAt: dto.paidAt,
          note: dto.note ?? null,
          receivedById,
          idempotencyKey: dto.idempotencyKey ?? null,
        }),
      );
      payment.receiptNumber = `RCPT-S-${String(payment.id).padStart(6, '0')}`;
      return manager.save(Payment, payment);
    });
  }

  async voidPayment(
    paymentId: number,
    dto: VoidRecordDto,
    voidedById: number,
  ): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
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
