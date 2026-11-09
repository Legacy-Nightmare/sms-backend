import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Slides for the public homepage's hero carousel — replaces the old
// single school_profile.hero_image_url, which only ever supported one
// static image with no real rotation.
@Entity('hero_images')
export class HeroImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
