import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubjectCatalog } from './entities/subject-catalog.entity';
import { CreateSubjectCatalogDto } from './dto/create-subject-catalog.dto';
import { UpdateSubjectCatalogDto } from './dto/update-subject-catalog.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(SubjectCatalog)
    private readonly subjectsRepo: Repository<SubjectCatalog>,
  ) {}

  async create(dto: CreateSubjectCatalogDto): Promise<SubjectCatalog> {
    try {
      return await this.subjectsRepo.save(
        this.subjectsRepo.create({
          name: dto.name,
          defaultFullMarks: dto.defaultFullMarks ?? null,
        }),
      );
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException(`Subject "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  findAll(): Promise<SubjectCatalog[]> {
    return this.subjectsRepo.find({ order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<SubjectCatalog> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  async update(id: number, dto: UpdateSubjectCatalogDto): Promise<SubjectCatalog> {
    const existing = await this.findById(id);
    try {
      await this.subjectsRepo.update(id, {
        name: dto.name ?? existing.name,
        defaultFullMarks: dto.defaultFullMarks !== undefined ? dto.defaultFullMarks : existing.defaultFullMarks,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException(`Subject "${dto.name}" already exists`);
      }
      throw err;
    }
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    await this.findById(id);
    try {
      const result = await this.subjectsRepo.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException('Subject not found');
      }
    } catch (err) {
      if (this.isForeignKeyViolation(err)) {
        throw new ConflictException(
          'This subject is still assigned to one or more classes — remove it from those classes first',
        );
      }
      throw err;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
  }

  private isForeignKeyViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23503';
  }
}
