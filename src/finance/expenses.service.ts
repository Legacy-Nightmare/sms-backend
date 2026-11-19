import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { ExpensePayment } from './entities/expense-payment.entity';
import { CreateExpenseDto } from './dto/expense.dto';
import { RecordPaymentDto, VoidRecordDto } from './dto/payment.dto';
import { RecordStatus } from './entities/enums';
import { generateReceiptNumber } from './receipt-number.util';

export interface ExpenseRow {
  id: number;
  category: string;
  amountDue: number;
  paid: number;
  remaining: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  date: string;
  note: string | null;
  createdAt: Date;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(ExpensePayment) private readonly paymentsRepo: Repository<ExpensePayment>,
  ) {}

  create(dto: CreateExpenseDto, createdById: number): Promise<Expense> {
    return this.expensesRepo.save(
      this.expensesRepo.create({ ...dto, note: dto.note ?? null, createdById }),
    );
  }

  async findAll(filters: ExpenseFilters): Promise<ExpenseRow[]> {
    const conditions: string[] = [`e.status = 'active'`];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      conditions.push(clause.replace('?', `$${params.length}`));
    };
    if (filters.from && filters.to) {
      params.push(filters.from, filters.to);
      conditions.push(`e.date BETWEEN $${params.length - 1} AND $${params.length}`);
    }
    if (filters.category) push('e.category = ?', filters.category);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.expensesRepo.manager.query(
      `
      SELECT
        e.id AS "id",
        e.category AS "category",
        e.amount AS "amountDue",
        COALESCE(p.paid, 0)::int AS "paid",
        (e.amount - COALESCE(p.paid, 0))::int AS "remaining",
        CASE
          WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID'
          WHEN COALESCE(p.paid, 0) >= e.amount THEN 'PAID'
          ELSE 'PARTIAL'
        END AS "status",
        e.date AS "date",
        e.note AS "note",
        e.created_at AS "createdAt"
      FROM expenses e
      LEFT JOIN (
        SELECT expense_id, SUM(amount) AS paid
        FROM expense_payments
        WHERE status = 'active'
        GROUP BY expense_id
      ) p ON p.expense_id = e.id
      ${where}
      ORDER BY e.date DESC, e.id DESC
      `,
      params,
    );
  }

  async findById(id: number): Promise<ExpenseRow & { payments: ExpensePayment[] }> {
    const [row] = await this.expensesRepo.manager.query(
      `
      SELECT
        e.id AS "id", e.category AS "category", e.amount AS "amountDue",
        COALESCE(p.paid, 0)::int AS "paid", (e.amount - COALESCE(p.paid, 0))::int AS "remaining",
        CASE WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID' WHEN COALESCE(p.paid, 0) >= e.amount THEN 'PAID' ELSE 'PARTIAL' END AS "status",
        e.date AS "date", e.note AS "note", e.created_at AS "createdAt"
      FROM expenses e
      LEFT JOIN (SELECT expense_id, SUM(amount) AS paid FROM expense_payments WHERE status = 'active' GROUP BY expense_id) p ON p.expense_id = e.id
      WHERE e.id = $1
      `,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Expense not found');
    }
    const payments = await this.paymentsRepo.find({ where: { expenseId: id }, order: { createdAt: 'DESC' } });
    return { ...row, payments };
  }

  async recordPayment(expenseId: number, dto: RecordPaymentDto, paidById: number): Promise<ExpensePayment> {
    return this.expensesRepo.manager.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const existing = await manager.findOne(ExpensePayment, { where: { idempotencyKey: dto.idempotencyKey } });
        if (existing) return existing;
      }

      const expense = await manager
        .createQueryBuilder(Expense, 'e')
        .setLock('pessimistic_write')
        .where('e.id = :id', { id: expenseId })
        .getOne();
      if (!expense) {
        throw new NotFoundException('Expense not found');
      }

      const { sum } = await manager
        .createQueryBuilder(ExpensePayment, 'p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .where('p.expenseId = :id AND p.status = :status', { id: expenseId, status: RecordStatus.ACTIVE })
        .getRawOne<{ sum: string }>();
      const paidSoFar = parseInt(sum, 10);
      const remaining = expense.amount - paidSoFar;

      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Payment of ${dto.amount} exceeds the remaining due of ${remaining} — advance payments aren't supported`,
        );
      }

      const payment = await manager.save(
        ExpensePayment,
        manager.create(ExpensePayment, {
          expenseId,
          amount: dto.amount,
          method: dto.method,
          paidAt: dto.paidAt,
          note: dto.note ?? null,
          paidById,
          idempotencyKey: dto.idempotencyKey ?? null,
        }),
      );
      payment.receiptNumber = await generateReceiptNumber(manager, ExpensePayment, 'RCPT-E');
      return manager.save(ExpensePayment, payment);
    });
  }

  async voidPayment(paymentId: number, dto: VoidRecordDto, voidedById: number): Promise<ExpensePayment> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Expense payment not found');
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

  async void(id: number, dto: VoidRecordDto, voidedById: number): Promise<Expense> {
    const expense = await this.expensesRepo.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.status === RecordStatus.VOIDED) {
      throw new ConflictException('Expense is already voided');
    }
    expense.status = RecordStatus.VOIDED;
    expense.voidReason = dto.reason;
    expense.voidedById = voidedById;
    expense.voidedAt = new Date();
    return this.expensesRepo.save(expense);
  }
}
