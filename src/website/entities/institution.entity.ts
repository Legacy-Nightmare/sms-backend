import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Cards in the public homepage's "Our Institutions" strip. `tone` picks
// which of the public-site.css color variants (institution-blue/pink/
// green/ice) the card renders with — a free-form string rather than an
// enum so new tones can be added without a migration.
@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  caption: string | null;

  @Column({ default: 'blue' })
  tone: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
