import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { Guardian, GuardianRelation } from './entities/guardian.entity';
import { AcademicsService } from '../academics/academics.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    @InjectRepository(Guardian)
    private readonly guardiansRepo: Repository<Guardian>,
    private readonly academicsService: AcademicsService,
  ) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    const classEntity = await this.academicsService.findClassById(dto.classId);
    const section = classEntity.sections.find((s) => s.id === dto.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found for this class');
    }

    const code = `${classEntity.level}-${section.name}-${dto.roll}`;
    const existing = await this.studentsRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Student code ${code} already exists`);
    }

    const student = this.studentsRepo.create({
      name: dto.name,
      code,
      biometricId: await this.nextBiometricId(),
      roll: dto.roll,
      classId: dto.classId,
      sectionId: dto.sectionId,
      dateOfBirth: dto.dateOfBirth,
    });
    const saved = await this.studentsRepo.save(student);

    if (dto.guardians?.length) {
      const guardians = dto.guardians.map((g) =>
        this.guardiansRepo.create({ ...g, studentId: saved.id }),
      );
      await this.guardiansRepo.save(guardians);
    }

    return this.findById(saved.id);
  }

  findAll(filters: {
    classId?: number;
    sectionId?: number;
  }): Promise<Student[]> {
    return this.studentsRepo.find({
      where: {
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      },
      relations: { guardians: true, classEntity: true, section: true },
      order: { roll: 'ASC' },
    });
  }

  async findById(id: number): Promise<Student> {
    const student = await this.studentsRepo.findOne({
      where: { id },
      relations: { guardians: true, classEntity: true, section: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  findByCode(code: string): Promise<Student | null> {
    return this.studentsRepo.findOne({
      where: { code },
      relations: { guardians: true },
    });
  }

  findByBiometricId(biometricId: number): Promise<Student | null> {
    return this.studentsRepo.findOne({
      where: { biometricId },
      relations: { guardians: true },
    });
  }

  // Biometric IDs start at 1000 (comfortably below that, single/double-digit
  // PINs are easy to mistype on a device keypad) and increment from whatever
  // the highest existing one is, so enrollment order doesn't have to match
  // roll/admission order.
  private async nextBiometricId(): Promise<number> {
    const { max } = await this.studentsRepo
      .createQueryBuilder('student')
      .select('MAX(student.biometricId)', 'max')
      .getRawOne<{ max: string | null }>();
    return max ? parseInt(max, 10) + 1 : 1000;
  }

  // Re-derives `code` only when class/section/roll actually change, and
  // checks the recomputed code for a conflict the same way create() does —
  // excluding this student's own row, since its current code would
  // otherwise always "conflict" with itself.
  async update(id: number, dto: UpdateStudentDto): Promise<Student> {
    const existing = await this.findById(id);

    const classId = dto.classId ?? existing.classId;
    const sectionId = dto.sectionId ?? existing.sectionId;
    const roll = dto.roll ?? existing.roll;

    let code = existing.code;
    if (
      dto.classId !== undefined ||
      dto.sectionId !== undefined ||
      dto.roll !== undefined
    ) {
      const classEntity = await this.academicsService.findClassById(classId);
      const section = classEntity.sections.find((s) => s.id === sectionId);
      if (!section) {
        throw new NotFoundException('Section not found for this class');
      }
      code = `${classEntity.level}-${section.name}-${roll}`;
      if (code !== existing.code) {
        const conflict = await this.studentsRepo.findOne({ where: { code } });
        if (conflict && conflict.id !== id) {
          throw new ConflictException(`Student code ${code} already exists`);
        }
      }
    }

    await this.studentsRepo.update(id, {
      name: dto.name ?? existing.name,
      classId,
      sectionId,
      roll,
      code,
      dateOfBirth: dto.dateOfBirth ?? existing.dateOfBirth,
      isActive: dto.isActive ?? existing.isActive,
    });

    if (dto.guardian) {
      const currentGuardian = existing.guardians[0];
      if (currentGuardian) {
        await this.guardiansRepo.update(currentGuardian.id, {
          ...(dto.guardian.name !== undefined
            ? { name: dto.guardian.name }
            : {}),
          ...(dto.guardian.relation !== undefined
            ? { relation: dto.guardian.relation }
            : {}),
          ...(dto.guardian.phone !== undefined
            ? { phone: dto.guardian.phone }
            : {}),
          ...(dto.guardian.email !== undefined
            ? { email: dto.guardian.email }
            : {}),
        });
      } else if (dto.guardian.name) {
        await this.guardiansRepo.save(
          this.guardiansRepo.create({
            name: dto.guardian.name,
            relation: dto.guardian.relation ?? GuardianRelation.OTHER,
            phone: dto.guardian.phone,
            email: dto.guardian.email,
            studentId: id,
          }),
        );
      }
    }

    return this.findById(id);
  }

  async setPhoto(id: number, photoUrl: string): Promise<Student> {
    await this.findById(id);
    await this.studentsRepo.update(id, { photoUrl });
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.studentsRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Student not found');
    }
  }
}
