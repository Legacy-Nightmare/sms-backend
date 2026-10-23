import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClassEntity } from '../../academics/entities/class.entity';
import { FeeType } from './fee-type.entity';

// The configured amount for one fee type on one class — e.g. "Class 5's
// Monthly Tuition is 1500 BDT". Students get billed from this amount, but
// their own StudentFee row is a frozen copy — changing this later never
// rewrites fees already charged.
@Entity('class_fees')
@Index(['classId', 'feeTypeId'], { unique: true })
export class ClassFee {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id' })
  classId: number;

  @ManyToOne(() => FeeType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fee_type_id' })
  feeType: FeeType;

  @Column({ name: 'fee_type_id' })
  feeTypeId: number;

  // Whole BDT — school fees in this context are never fractional, and
  // integers sidestep float rounding entirely (never store money as float).
  @Column({ type: 'int' })
  amount: number;
}
