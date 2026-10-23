import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';

export interface FinanceReportFilters {
  from: string;
  to: string;
  classId?: number;
  studentId?: number;
  feeTypeId?: number;
  method?: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  salaryExpense: number;
  otherExpense: number;
  profitLoss: number;
  totalDue: number;
  salaryPayable: number;
}

export interface TrendPoint {
  date: string;
  income: number;
  expense: number;
}

export interface StudentDueRow {
  studentId: number;
  studentName: string;
  studentCode: string;
  classId: number;
  className: string;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
}

// Every number here comes straight out of a SQL SUM/GROUP BY — never by
// pulling rows into app memory and adding them up — so this holds up as the
// school grows past a handful of students. Cash basis by choice: income and
// expense are money that actually moved (payments received/paid) within the
// date range; dues and salary-payable are a *current* snapshot of what's
// still owed, independent of the date range, shown separately rather than
// folded into the period figures.
@Injectable()
export class FinanceReportService {
  constructor(@InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>) {}

  async getSummary(filters: FinanceReportFilters): Promise<FinanceSummary> {
    const conditions: string[] = ["p.status = 'active'", 'p.paid_at BETWEEN $1 AND $2'];
    const params: unknown[] = [filters.from, filters.to];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      conditions.push(clause.replace('?', `$${params.length}`));
    };
    if (filters.classId) push('s.class_id = ?', filters.classId);
    if (filters.studentId) push('sf.student_id = ?', filters.studentId);
    if (filters.feeTypeId) push('sf.fee_type_id = ?', filters.feeTypeId);
    if (filters.method) push('p.method = ?', filters.method);

    const [[incomeRow], [salaryRow], [expenseRow], [dueRow], [payableRow]] = await Promise.all([
      this.paymentsRepo.manager.query(
        `
        SELECT COALESCE(SUM(p.amount), 0)::int AS income
        FROM payments p
        JOIN student_fees sf ON sf.id = p.student_fee_id
        JOIN students s ON s.id = sf.student_id
        WHERE ${conditions.join(' AND ')}
        `,
        params,
      ),
      this.paymentsRepo.manager.query(
        `
        SELECT COALESCE(SUM(amount), 0)::int AS salary_expense
        FROM salary_payments
        WHERE status = 'active' AND paid_at BETWEEN $1 AND $2
        `,
        [filters.from, filters.to],
      ),
      this.paymentsRepo.manager.query(
        `
        SELECT COALESCE(SUM(amount), 0)::int AS other_expense
        FROM expenses
        WHERE status = 'active' AND date BETWEEN $1 AND $2
        `,
        [filters.from, filters.to],
      ),
      this.paymentsRepo.manager.query(
        `
        SELECT COALESCE(SUM(sf.amount_due - COALESCE(p.paid, 0)), 0)::int AS total_due
        FROM student_fees sf
        JOIN students s ON s.id = sf.student_id
        LEFT JOIN (SELECT student_fee_id, SUM(amount) AS paid FROM payments WHERE status = 'active' GROUP BY student_fee_id) p
          ON p.student_fee_id = sf.id
        WHERE sf.amount_due - COALESCE(p.paid, 0) > 0
        ${filters.classId ? 'AND s.class_id = $1' : ''}
        `,
        filters.classId ? [filters.classId] : [],
      ),
      this.paymentsRepo.manager.query(
        `
        SELECT COALESCE(SUM(ts.amount_due - COALESCE(p.paid, 0)), 0)::int AS salary_payable
        FROM teacher_salaries ts
        LEFT JOIN (SELECT teacher_salary_id, SUM(amount) AS paid FROM salary_payments WHERE status = 'active' GROUP BY teacher_salary_id) p
          ON p.teacher_salary_id = ts.id
        WHERE ts.amount_due - COALESCE(p.paid, 0) > 0
        `,
        [],
      ),
    ]);

    const totalIncome = incomeRow.income;
    const salaryExpense = salaryRow.salary_expense;
    const otherExpense = expenseRow.other_expense;
    const totalExpense = salaryExpense + otherExpense;

    return {
      totalIncome,
      totalExpense,
      salaryExpense,
      otherExpense,
      profitLoss: totalIncome - totalExpense,
      totalDue: dueRow.total_due,
      salaryPayable: payableRow.salary_payable,
    };
  }

  async getTrend(from: string, to: string): Promise<TrendPoint[]> {
    // Cast to text in SQL, not left as a `date` type: node-pg's raw query()
    // path (unlike TypeORM's own column hydration) parses DATE columns into
    // a local-midnight JS Date, and reading that back out via toISOString()
    // shifts it a day backward in any timezone ahead of UTC (e.g. Bangladesh,
    // UTC+6) — a real bug this caught. A plain string sidesteps it entirely.
    const [incomeRows, expenseRows] = await Promise.all([
      this.paymentsRepo.manager.query(
        `
        SELECT paid_at::text AS date, SUM(amount)::int AS income
        FROM payments
        WHERE status = 'active' AND paid_at BETWEEN $1 AND $2
        GROUP BY paid_at::text
        `,
        [from, to],
      ),
      this.paymentsRepo.manager.query(
        `
        SELECT d::text AS date, SUM(amt)::int AS expense FROM (
          SELECT paid_at AS d, amount AS amt FROM salary_payments WHERE status = 'active' AND paid_at BETWEEN $1 AND $2
          UNION ALL
          SELECT date AS d, amount AS amt FROM expenses WHERE status = 'active' AND date BETWEEN $1 AND $2
        ) t
        GROUP BY d
        `,
        [from, to],
      ),
    ]);

    const byDate = new Map<string, TrendPoint>();
    for (const row of incomeRows as Array<{ date: string; income: number }>) {
      byDate.set(row.date, { date: row.date, income: row.income, expense: 0 });
    }
    for (const row of expenseRows as Array<{ date: string; expense: number }>) {
      const existing = byDate.get(row.date);
      if (existing) existing.expense = row.expense;
      else byDate.set(row.date, { date: row.date, income: 0, expense: row.expense });
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getStudentsWithDues(filters: { classId?: number; page?: number; pageSize?: number }): Promise<{
    rows: StudentDueRow[];
    total: number;
  }> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 100, 1000);
    const classFilter = filters.classId ? 'AND s.class_id = $1' : '';
    const params = filters.classId ? [filters.classId] : [];

    const sql = `
      SELECT
        s.id AS "studentId", s.name AS "studentName", s.code AS "studentCode",
        s.class_id AS "classId", c.name AS "className",
        SUM(sf.amount_due)::int AS "totalDue",
        SUM(COALESCE(p.paid, 0))::int AS "totalPaid",
        SUM(sf.amount_due - COALESCE(p.paid, 0))::int AS "totalRemaining"
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN (SELECT student_fee_id, SUM(amount) AS paid FROM payments WHERE status = 'active' GROUP BY student_fee_id) p
        ON p.student_fee_id = sf.id
      WHERE 1=1 ${classFilter}
      GROUP BY s.id, s.name, s.code, s.class_id, c.name
      HAVING SUM(sf.amount_due - COALESCE(p.paid, 0)) > 0
      ORDER BY "totalRemaining" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `
      SELECT COUNT(*)::int AS count FROM (
        SELECT sf.student_id
        FROM student_fees sf
        JOIN students s ON s.id = sf.student_id
        LEFT JOIN (SELECT student_fee_id, SUM(amount) AS paid FROM payments WHERE status = 'active' GROUP BY student_fee_id) p
          ON p.student_fee_id = sf.id
        WHERE 1=1 ${classFilter}
        GROUP BY sf.student_id
        HAVING SUM(sf.amount_due - COALESCE(p.paid, 0)) > 0
      ) x
    `;

    const [rows, countResult] = await Promise.all([
      this.paymentsRepo.manager.query(sql, [...params, pageSize, (page - 1) * pageSize]),
      this.paymentsRepo.manager.query(countSql, params),
    ]);
    return { rows, total: countResult[0]?.count ?? 0 };
  }
}
