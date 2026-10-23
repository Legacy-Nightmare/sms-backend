import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from './entities/class.entity';
import { Section } from './entities/section.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateResultWeightsDto } from './dto/update-result-weights.dto';
import { Student } from '../students/entities/student.entity';

@Injectable()
export class AcademicsService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classesRepo: Repository<ClassEntity>,
    @InjectRepository(Section)
    private readonly sectionsRepo: Repository<Section>,
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
  ) {}

  async createClass(dto: CreateClassDto): Promise<ClassEntity> {
    const existing = await this.classesRepo.findOne({
      where: { level: dto.level },
    });
    if (existing) {
      throw new ConflictException(`Class level ${dto.level} already exists`);
    }
    const classEntity = this.classesRepo.create(dto);
    return this.classesRepo.save(classEntity);
  }

  // Attaches a live student count per class and per section — the frontend
  // class grid shows these, and computing them here avoids an N+1 of
  // separate /students?classId= calls per card.
  async findAllClasses() {
    const classes = await this.classesRepo.find({
      relations: { sections: true },
      order: { level: 'ASC' },
    });

    const [classCounts, sectionCounts] = await Promise.all([
      this.studentsRepo
        .createQueryBuilder('s')
        .select('s.classId', 'classId')
        .addSelect('COUNT(*)', 'count')
        .where('s.isActive = true')
        .groupBy('s.classId')
        .getRawMany<{ classId: number; count: string }>(),
      this.studentsRepo
        .createQueryBuilder('s')
        .select('s.sectionId', 'sectionId')
        .addSelect('COUNT(*)', 'count')
        .where('s.isActive = true')
        .groupBy('s.sectionId')
        .getRawMany<{ sectionId: number; count: string }>(),
    ]);
    const classCountMap = new Map(
      classCounts.map((c) => [c.classId, parseInt(c.count, 10)]),
    );
    const sectionCountMap = new Map(
      sectionCounts.map((c) => [c.sectionId, parseInt(c.count, 10)]),
    );

    return classes.map((c) => ({
      ...c,
      studentCount: classCountMap.get(c.id) ?? 0,
      sections: c.sections.map((s) => ({
        ...s,
        studentCount: sectionCountMap.get(s.id) ?? 0,
      })),
    }));
  }

  async findClassById(id: number): Promise<ClassEntity> {
    const classEntity = await this.classesRepo.findOne({
      where: { id },
      relations: { sections: true },
    });
    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }
    return classEntity;
  }

  async updateResultWeights(
    classId: number,
    dto: UpdateResultWeightsDto,
  ): Promise<ClassEntity> {
    if (dto.tutorialWeightPercent + dto.finalWeightPercent !== 100) {
      throw new BadRequestException(
        'Tutorial and final weights must add up to 100',
      );
    }
    await this.findClassById(classId);
    await this.classesRepo.update(classId, {
      tutorialWeightPercent: dto.tutorialWeightPercent,
      finalWeightPercent: dto.finalWeightPercent,
    });
    return this.findClassById(classId);
  }

  async createSection(dto: CreateSectionDto): Promise<Section> {
    await this.findClassById(dto.classId);
    const existing = await this.sectionsRepo.findOne({
      where: { classId: dto.classId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Section ${dto.name} already exists for this class`,
      );
    }
    const section = this.sectionsRepo.create(dto);
    return this.sectionsRepo.save(section);
  }

  findSectionsByClass(classId: number): Promise<Section[]> {
    return this.sectionsRepo.find({ where: { classId } });
  }

  async updateSection(id: number, dto: UpdateSectionDto): Promise<Section> {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (dto.name !== section.name) {
      const existing = await this.sectionsRepo.findOne({
        where: { classId: section.classId, name: dto.name },
      });
      if (existing) {
        throw new ConflictException(
          `Section ${dto.name} already exists for this class`,
        );
      }
    }
    await this.sectionsRepo.update(id, { name: dto.name });
    return this.sectionsRepo.findOneByOrFail({ id });
  }

  // Blocked (not cascaded) if students are still assigned — losing the
  // section assignment on every one of their records silently would be a
  // much bigger surprise than an error telling the admin to move them first.
  async removeSection(id: number): Promise<void> {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    const studentCount = await this.studentsRepo.count({
      where: { sectionId: id },
    });
    if (studentCount > 0) {
      throw new ConflictException(
        `Cannot delete section "${section.name}" — ${studentCount} student(s) are still assigned to it`,
      );
    }
    await this.sectionsRepo.delete(id);
  }
}
