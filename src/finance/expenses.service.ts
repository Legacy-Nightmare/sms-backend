import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/expense.dto';
import { VoidRecordDto } from './dto/payment.dto';
import { RecordStatus } from './entities/enums';

@Injectable()
export class ExpensesService {
  constructor(@InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>) {}

  create(dto: CreateExpenseDto, createdById: number): Promise<Expense> {
    return this.expensesRepo.save(
      this.expensesRepo.create({ ...dto, note: dto.note ?? null, createdById }),
    );
  }

  findAll(filters: { from?: string; to?: string; category?: string }): Promise<Expense[]> {
    const where: FindOptionsWhere<Expense> = { status: RecordStatus.ACTIVE };
    if (filters.from && filters.to) where.date = Between(filters.from, filters.to);
    if (filters.category) where.category = filters.category;
    return this.expensesRepo.find({ where, order: { date: 'DESC' } });
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
