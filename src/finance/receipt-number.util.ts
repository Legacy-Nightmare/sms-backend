import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

// Random, not derived from the row's own id — a sequential number lets
// anyone infer how many receipts exist or guess the next one. Retries on
// the rare collision since receipt_number carries a unique DB constraint.
export async function generateReceiptNumber<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  prefix: string,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const digits = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    const receiptNumber = `${prefix}-${digits}`;
    const existing = await manager.findOne(entity, { where: { receiptNumber } as never });
    if (!existing) return receiptNumber;
  }
  throw new Error('Could not generate a unique receipt number');
}
