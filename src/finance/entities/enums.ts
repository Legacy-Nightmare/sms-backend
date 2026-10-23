export enum PaymentMethod {
  CASH = 'cash',
  BANK = 'bank',
  BKASH = 'bkash',
  NAGAD = 'nagad',
  OTHER = 'other',
}

// Payments/salary-payments/expenses are append-only. A mistake is corrected
// by voiding the entry (with a reason) and recording a new one — never by
// editing or deleting, so the audit trail always shows what really happened.
export enum RecordStatus {
  ACTIVE = 'active',
  VOIDED = 'voided',
}
