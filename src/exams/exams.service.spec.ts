import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExamsService, type MarksRequester } from './exams.service';
import { Exam, ExamType } from './entities/exam.entity';
import { Role } from '../common/enums/role.enum';

const admin: MarksRequester = { userId: 1, role: Role.ADMIN };

describe('ExamsService.enterMarks', () => {
  let service: ExamsService;
  let marksRepo: { manager: { transaction: jest.Mock } };
  let studentsService: { findAll: jest.Mock };
  let teacherClassSubjectsRepo: { findOne: jest.Mock };
  let usersService: { findById: jest.Mock };

  const exam = { id: 1, classId: 10, classEntity: { id: 10 } } as Exam;
  const students = [
    { id: 100, name: 'Alice', code: '1-A-1', roll: 1 },
    { id: 101, name: 'Bob', code: '1-A-2', roll: 2 },
  ];
  const subjects = [{ id: 200, name: 'Math', classId: 10, fullMarks: 100 }];

  beforeEach(() => {
    const examsRepo = { findOne: jest.fn().mockResolvedValue(exam) };
    const subjectsRepo = {
      find: jest.fn().mockResolvedValue(subjects),
      findOne: jest.fn(),
    };
    marksRepo = {
      manager: { transaction: jest.fn((cb) => cb({ upsert: jest.fn() })) },
    };
    studentsService = { findAll: jest.fn().mockResolvedValue(students) };
    teacherClassSubjectsRepo = { findOne: jest.fn() };
    const notificationsService = { sendMail: jest.fn() };
    const academicsService = { findClassById: jest.fn() };
    const subjectsService = { findById: jest.fn() };
    usersService = { findById: jest.fn() };
    const attendanceService = {};

    // Constructed directly (no Nest TestingModule/DI) — this is a plain unit
    // test of the validation + transaction logic, not of Nest wiring, and
    // @nestjs/typeorm's ESM build currently breaks ts-jest if imported just
    // for getRepositoryToken().
    service = new ExamsService(
      subjectsRepo as never,
      examsRepo as never,
      marksRepo as never,
      teacherClassSubjectsRepo as never,
      studentsService as never,
      notificationsService as never,
      academicsService as never,
      subjectsService as never,
      usersService as never,
      attendanceService as never,
    );
  });

  it('saves every row inside a transaction when the whole batch is valid', async () => {
    const result = await service.enterMarks(
      1,
      {
        entries: [
          { studentId: 100, subjectId: 200, marksObtained: 90 },
          { studentId: 101, subjectId: 200, marksObtained: 45 },
        ],
      },
      admin,
    );

    expect(result).toEqual({ saved: 2 });
    expect(marksRepo.manager.transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a mark above the subject's full marks, and writes nothing", async () => {
    await expect(
      service.enterMarks(
        1,
        {
          entries: [{ studentId: 100, subjectId: 200, marksObtained: 150 }],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(marksRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it("rejects a student who is not in this exam's class", async () => {
    await expect(
      service.enterMarks(
        1,
        {
          entries: [{ studentId: 999, subjectId: 200, marksObtained: 10 }],
        },
        admin,
      ),
    ).rejects.toMatchObject({
      response: {
        errors: [
          {
            studentId: 999,
            subjectId: 200,
            message: expect.stringContaining('not in this exam'),
          },
        ],
      },
    });
  });

  it("rejects a subject that does not belong to this exam's class", async () => {
    await expect(
      service.enterMarks(
        1,
        {
          entries: [{ studentId: 100, subjectId: 999, marksObtained: 10 }],
        },
        admin,
      ),
    ).rejects.toMatchObject({
      response: {
        errors: [
          {
            studentId: 100,
            subjectId: 999,
            message: expect.stringContaining('does not belong'),
          },
        ],
      },
    });
  });

  it('collects every invalid row in one response instead of failing on the first', async () => {
    try {
      await service.enterMarks(
        1,
        {
          entries: [
            { studentId: 999, subjectId: 200, marksObtained: 10 },
            { studentId: 100, subjectId: 200, marksObtained: 150 },
          ],
        },
        admin,
      );
      fail('expected enterMarks to throw');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        errors: unknown[];
      };
      expect(response.errors).toHaveLength(2);
    }
  });

  it('rejects a teacher account with no linked teacher profile', async () => {
    usersService.findById.mockResolvedValue({ id: 5, teacherId: null });
    const teacher: MarksRequester = { userId: 5, role: Role.TEACHER };

    await expect(
      service.enterMarks(
        1,
        { entries: [{ studentId: 100, subjectId: 200, marksObtained: 90 }] },
        teacher,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(marksRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects a teacher entering marks for a subject they are not assigned to', async () => {
    usersService.findById.mockResolvedValue({ id: 5, teacherId: 50 });
    teacherClassSubjectsRepo.findOne.mockResolvedValue(null);
    const teacher: MarksRequester = { userId: 5, role: Role.TEACHER };

    await expect(
      service.enterMarks(
        1,
        { entries: [{ studentId: 100, subjectId: 200, marksObtained: 90 }] },
        teacher,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(teacherClassSubjectsRepo.findOne).toHaveBeenCalledWith({
      where: { teacherId: 50, classSubjectId: 200 },
    });
    expect(marksRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('allows a teacher entering marks for a subject they are assigned to', async () => {
    usersService.findById.mockResolvedValue({ id: 5, teacherId: 50 });
    teacherClassSubjectsRepo.findOne.mockResolvedValue({ id: 1, teacherId: 50, classSubjectId: 200 });
    const teacher: MarksRequester = { userId: 5, role: Role.TEACHER };

    const result = await service.enterMarks(
      1,
      { entries: [{ studentId: 100, subjectId: 200, marksObtained: 90 }] },
      teacher,
    );

    expect(result).toEqual({ saved: 1 });
    expect(marksRepo.manager.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('ExamsService.getCombinedResult', () => {
  const student = { id: 100, name: 'Alice', code: '1-A-1' };
  const classEntity = {
    id: 10,
    tutorialWeightPercent: 20,
    finalWeightPercent: 80,
  };
  const subjects = [
    { id: 200, name: 'Math', classId: 10, fullMarks: 100 },
    { id: 201, name: 'English', classId: 10, fullMarks: 100 },
  ];
  const tutorialExam = {
    id: 1,
    name: 'Tutorial 2026',
    classId: 10,
    academicYear: '2026',
    type: ExamType.TUTORIAL,
  } as Exam;
  const finalExam = {
    id: 2,
    name: 'Final 2026',
    classId: 10,
    academicYear: '2026',
    type: ExamType.FINAL,
  } as Exam;

  function buildService(opts: {
    examsFindOne: jest.Mock;
    marksFind: jest.Mock;
  }) {
    const subjectsRepo = { find: jest.fn().mockResolvedValue(subjects) };
    const examsRepo = { findOne: opts.examsFindOne };
    const marksRepo = { find: opts.marksFind };
    const teacherClassSubjectsRepo = { findOne: jest.fn() };
    const studentsService = { findById: jest.fn().mockResolvedValue(student) };
    const notificationsService = { sendMail: jest.fn() };
    const academicsService = {
      findClassById: jest.fn().mockResolvedValue(classEntity),
    };
    const subjectsService = { findById: jest.fn() };
    const usersService = { findById: jest.fn() };
    const attendanceService = {};

    return new ExamsService(
      subjectsRepo as never,
      examsRepo as never,
      marksRepo as never,
      teacherClassSubjectsRepo as never,
      studentsService as never,
      notificationsService as never,
      academicsService as never,
      subjectsService as never,
      usersService as never,
      attendanceService as never,
    );
  }

  it('blends tutorial and final marks per subject using the class weight split', async () => {
    const examsFindOne = jest
      .fn()
      .mockResolvedValueOnce(tutorialExam) // tutorial lookup
      .mockResolvedValueOnce(finalExam); // final lookup
    const marksFind = jest
      .fn()
      .mockResolvedValueOnce([
        { subjectId: 200, marksObtained: 60 },
        { subjectId: 201, marksObtained: 80 },
      ]) // tutorial marks
      .mockResolvedValueOnce([
        { subjectId: 200, marksObtained: 90 },
        { subjectId: 201, marksObtained: 70 },
      ]); // final marks

    const service = buildService({ examsFindOne, marksFind });
    const result = await service.getCombinedResult(10, 100, '2026', admin);

    // Math: 60*0.2 + 90*0.8 = 84; English: 80*0.2 + 70*0.8 = 72
    expect(
      result.subjects.find((s) => s.subjectId === 200)?.combinedMarks,
    ).toBeCloseTo(84);
    expect(
      result.subjects.find((s) => s.subjectId === 201)?.combinedMarks,
    ).toBeCloseTo(72);
    expect(result.totalFullMarks).toBe(200);
    expect(result.percentage).toBeCloseTo(78); // (84+72)/200*100
  });

  it('falls back to 100% weight on whichever exam exists when only one is present', async () => {
    const examsFindOne = jest
      .fn()
      .mockResolvedValueOnce(null) // no tutorial exam
      .mockResolvedValueOnce(finalExam);
    const marksFind = jest.fn().mockResolvedValueOnce([
      { subjectId: 200, marksObtained: 90 },
      { subjectId: 201, marksObtained: 70 },
    ]); // only the final-exam marks call happens

    const service = buildService({ examsFindOne, marksFind });
    const result = await service.getCombinedResult(10, 100, '2026', admin);

    expect(result.tutorialExam).toBeNull();
    expect(result.tutorialWeightPercent).toBe(0);
    expect(result.finalWeightPercent).toBe(100);
    expect(
      result.subjects.find((s) => s.subjectId === 200)?.combinedMarks,
    ).toBe(90);
  });

  it('throws NotFoundException when neither exam exists for the class/year', async () => {
    const examsFindOne = jest.fn().mockResolvedValue(null);
    const service = buildService({ examsFindOne, marksFind: jest.fn() });

    await expect(
      service.getCombinedResult(10, 100, '2026', admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ExamsService teacher class scope (F-08/F-32)', () => {
  const teacher: MarksRequester = { userId: 5, role: Role.TEACHER };
  const exam = { id: 1, classId: 10, sectionId: null } as Exam;

  function build(assignedClassIds: number[]) {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue(assignedClassIds.map((classId) => ({ classId }))),
    };
    const examsQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([exam]),
    };
    const examsRepo = {
      findOne: jest.fn().mockResolvedValue(exam),
      createQueryBuilder: jest.fn().mockReturnValue(examsQb),
    };
    const studentsService = {
      findById: jest.fn().mockResolvedValue({ id: 100, classId: 11 }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    const service = new ExamsService(
      {} as never,
      examsRepo as never,
      {} as never,
      { createQueryBuilder: jest.fn().mockReturnValue(qb) } as never,
      studentsService as never,
      {} as never,
      {} as never,
      {} as never,
      { findById: jest.fn().mockResolvedValue({ teacherId: 50 }) } as never,
      {} as never,
    );
    return { service, examsQb };
  }

  it("refuses another class's results and by-id exam fetch", async () => {
    const { service } = build([11]);
    await expect(service.getResultsForExam(1, teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.getStudentResultForRequester(1, 100, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findExamForRequester(1, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a student outside the exam's class even for an assigned class", async () => {
    const { service } = build([10]);
    await expect(
      service.getStudentResultForRequester(1, 100, teacher),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('limits the exam list to assigned classes, and returns nothing with none', async () => {
    const { service, examsQb } = build([10, 12]);
    await service.findExams(undefined, undefined, undefined, teacher);
    expect(examsQb.andWhere).toHaveBeenCalledWith(
      'exam.classId IN (:...classIds)',
      { classIds: [10, 12] },
    );
    const none = build([]);
    expect(
      await none.service.findExams(undefined, undefined, undefined, teacher),
    ).toEqual([]);
  });

  it('leaves admins unrestricted', async () => {
    const { service, examsQb } = build([]);
    await service.findExams(undefined, undefined, undefined, admin);
    expect(examsQb.andWhere).not.toHaveBeenCalled();
    await expect(service.findExamForRequester(1, admin)).resolves.toBe(exam);
  });
});
