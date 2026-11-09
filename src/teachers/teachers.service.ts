import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Teacher } from './entities/teacher.entity';
import { TeacherClassSubject } from './entities/teacher-class-subject.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

export interface TeacherAssignment {
  id: number;
  classSubjectId: number;
  classId: number;
  classLevel: number | null;
  className: string;
  classSortOrder: number;
  subjectName: string;
}

export type TeacherWithAssignments = Teacher & { assignments: TeacherAssignment[] };

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teachersRepo: Repository<Teacher>,
    @InjectRepository(TeacherClassSubject)
    private readonly assignmentsRepo: Repository<TeacherClassSubject>,
  ) {}

  create(dto: CreateTeacherDto): Promise<Teacher> {
    return this.teachersRepo.save(
      this.teachersRepo.create({
        name: dto.name,
        salary: dto.salary ?? null,
        nid: dto.nid ?? null,
        dateOfBirth: dto.dateOfBirth ?? null,
        joiningDate: dto.joiningDate ?? null,
      }),
    );
  }

  async findAll(): Promise<TeacherWithAssignments[]> {
    const teachers = await this.teachersRepo.find({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
    const rows = await this.fetchAssignmentRows();
    const byTeacher = new Map<number, TeacherAssignment[]>();
    for (const row of rows) {
      const list = byTeacher.get(row.teacherId) ?? [];
      list.push(row);
      byTeacher.set(row.teacherId, list);
    }
    return teachers.map((t) => Object.assign(t, { assignments: byTeacher.get(t.id) ?? [] }));
  }

  async findById(id: number): Promise<TeacherWithAssignments> {
    const teacher = await this.teachersRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    const assignments = await this.fetchAssignmentRows(id);
    return Object.assign(teacher, { assignments });
  }

  private async fetchAssignmentRows(
    teacherId?: number,
  ): Promise<Array<TeacherAssignment & { teacherId: number }>> {
    const where = teacherId !== undefined ? 'WHERE tcs.teacher_id = $1' : '';
    const params = teacherId !== undefined ? [teacherId] : [];
    return this.assignmentsRepo.manager.query(
      `SELECT tcs.id AS "id", tcs.teacher_id AS "teacherId", tcs.class_subject_id AS "classSubjectId",
              c.id AS "classId", c.level AS "classLevel", c.name AS "className",
              c.sort_order AS "classSortOrder", cs.name AS "subjectName"
       FROM teacher_class_subjects tcs
       JOIN class_subjects cs ON cs.id = tcs.class_subject_id
       JOIN classes c ON c.id = cs.class_id
       ${where}
       ORDER BY c.sort_order, cs.name`,
      params,
    );
  }

  async update(id: number, dto: UpdateTeacherDto): Promise<TeacherWithAssignments> {
    const existing = await this.teachersRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    await this.teachersRepo.update(id, {
      name: dto.name ?? existing.name,
      salary: dto.salary !== undefined ? dto.salary : existing.salary,
      nid: dto.nid !== undefined ? dto.nid : existing.nid,
      dateOfBirth: dto.dateOfBirth !== undefined ? dto.dateOfBirth : existing.dateOfBirth,
      joiningDate: dto.joiningDate !== undefined ? dto.joiningDate : existing.joiningDate,
      isActive: dto.isActive ?? existing.isActive,
    });
    return this.findById(id);
  }

  async setPhoto(id: number, photoUrl: string): Promise<TeacherWithAssignments> {
    await this.findById(id);
    await this.teachersRepo.update(id, { photoUrl });
    return this.findById(id);
  }

  // Replace-all semantics — the teacher's class/subject multi-select
  // submits the whole desired set each time, so the simplest correct move
  // is to wipe and re-insert rather than diff.
  async setAssignments(id: number, classSubjectIds: number[]): Promise<TeacherWithAssignments> {
    await this.findById(id);
    await this.assignmentsRepo.manager.transaction(async (manager) => {
      await manager.delete(TeacherClassSubject, { teacherId: id });
      if (classSubjectIds.length > 0) {
        await manager.save(
          TeacherClassSubject,
          classSubjectIds.map((classSubjectId) =>
            manager.create(TeacherClassSubject, { teacherId: id, classSubjectId }),
          ),
        );
      }
    });
    return this.findById(id);
  }

  // Soft delete — a hard DELETE here would cascade and destroy this
  // teacher's class/subject assignments, salary records, and every
  // payment receipt tied to those salary rows. Setting deletedAt instead
  // keeps the row (and everything joined to it) intact; findAll/findById
  // just stop surfacing it.
  async remove(id: number): Promise<void> {
    const result = await this.teachersRepo.update(
      { id, deletedAt: IsNull() },
      { deletedAt: new Date() },
    );
    if (result.affected === 0) {
      throw new NotFoundException('Teacher not found');
    }
  }
}
