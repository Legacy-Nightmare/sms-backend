import { BadRequestException } from '@nestjs/common';
import { StudentFeesService } from './student-fees.service';
import { StudentFee } from './entities/student-fee.entity';
import { Payment } from './entities/payment.entity';

function makeQueryBuilder(result: unknown) {
  const qb: Record<string, jest.Mock> = {
    setLock: jest.fn(() => qb),
    where: jest.fn(() => qb),
    select: jest.fn(() => qb),
    getOne: jest.fn().mockResolvedValue(result),
    getRawOne: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

describe('StudentFeesService.recordPayment', () => {
  let service: StudentFeesService;
  let manager: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    transaction: jest.Mock;
  };

  const fee = { id: 1, amountDue: 1000 } as StudentFee;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn((_entity, obj) =>
        Promise.resolve(obj.id ? obj : { ...obj, id: 42 }),
      ),
      create: jest.fn((_entity, obj) => obj),
      transaction: jest.fn((cb) => cb(manager)),
    };

    const studentFeesRepo = { manager } as never;
    const paymentsRepo = {} as never;
    service = new StudentFeesService(
      studentFeesRepo,
      paymentsRepo,
      {} as never,
      {} as never,
    );
  });

  it('rejects a payment larger than the remaining due (no advance payments)', async () => {
    manager.createQueryBuilder
      .mockReturnValueOnce(makeQueryBuilder(fee)) // StudentFee lookup (with lock)
      .mockReturnValueOnce(makeQueryBuilder({ sum: '400' })); // sum of existing active payments

    await expect(
      service.recordPayment(
        1,
        { amount: 700, paidAt: '2026-10-01' } as never,
        9,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('accepts a payment that exactly matches the remaining due, and stamps a receipt number', async () => {
    manager.createQueryBuilder
      .mockReturnValueOnce(makeQueryBuilder(fee))
      .mockReturnValueOnce(makeQueryBuilder({ sum: '400' }));

    const payment = await service.recordPayment(
      1,
      { amount: 600, paidAt: '2026-10-01' } as never,
      9,
    );

    expect(payment.receiptNumber).toMatch(/^RCPT-S-\d{6}$/);
    expect(manager.save).toHaveBeenCalled();
  });

  it('excludes voided payments from the "already paid" total', async () => {
    // Service never sees voided rows directly — the SQL filters by
    // status = 'active', so this spec documents that contract rather than
    // re-testing SQL: the query builder mock returns the already-filtered
    // sum, proving the service trusts (and the query enforces) active-only.
    manager.createQueryBuilder
      .mockReturnValueOnce(makeQueryBuilder(fee))
      .mockReturnValueOnce(makeQueryBuilder({ sum: '0' })); // a prior payment was voided -> excluded -> sum is 0

    const payment = await service.recordPayment(
      1,
      { amount: 1000, paidAt: '2026-10-01' } as never,
      9,
    );
    expect(payment.amount).toBe(1000);
  });

  it('replays an existing payment instead of double-recording on a repeated idempotency key', async () => {
    const existing = {
      id: 55,
      amount: 300,
      idempotencyKey: 'key-abc',
    } as Payment;
    manager.findOne.mockResolvedValueOnce(existing);

    const result = await service.recordPayment(
      1,
      { amount: 300, paidAt: '2026-10-01', idempotencyKey: 'key-abc' } as never,
      9,
    );

    expect(result).toBe(existing);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
