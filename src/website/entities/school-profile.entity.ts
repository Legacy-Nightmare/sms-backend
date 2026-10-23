import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Singleton table — always exactly one row, id=1, seeded by migration
// 1792651600272-CreateWebsiteContentTables so the public site and the
// Website Manage dashboard page never have to special-case a missing row.
export const SCHOOL_PROFILE_ID = 1;

@Entity('school_profile')
export class SchoolProfile {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'school_name' })
  schoolName: string;

  @Column({ nullable: true })
  tagline: string | null;

  @Column({ name: 'about_text', type: 'text', nullable: true })
  aboutText: string | null;

  @Column({ nullable: true })
  address: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  email: string | null;

  @Column({ name: 'map_url', nullable: true })
  mapUrl: string | null;

  @Column({ name: 'facebook_url', nullable: true })
  facebookUrl: string | null;

  @Column({ name: 'youtube_url', nullable: true })
  youtubeUrl: string | null;

  @Column({ name: 'linkedin_url', nullable: true })
  linkedinUrl: string | null;

  @Column({ name: 'x_url', nullable: true })
  xUrl: string | null;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'hero_image_url', nullable: true })
  heroImageUrl: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
