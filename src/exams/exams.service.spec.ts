import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { Exam, ExamType } from './entities/exam.entity';

describe('ExamsService.enterMarks', () => {
  let service: ExamsService;
  let marksRepo: { manager: { transaction: jest.Mock } };
  let studentsService: { findAll: jest.Mock };

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
    const notificationsService = { sendMail: jest.fn() };
    const academicsService = { findClassById: jest.fn() };

    // Constructed directly (no Nest TestingModule/DI) — this is a plain unit
    // test of the validation + transaction logic, not of Nest wiring, and
    // @nestjs/typeorm's ESM build currently breaks ts-jest if imported just
    // for getRepositoryToken().
    service = new ExamsService(
      subjectsRepo as never,
      examsRepo as never,
      marksRepo as never,
      studentsService as never,
      notificationsService as never,
      academicsService as never,
    );
  });

  it('saves every row inside a transaction when the whole batch is valid', async () => {
    const result = await service.enterMarks(1, {
      entries: [
        { studentId: 100, subjectId: 200, marksObtained: 90 },
        { studentId: 101, subjectId: 200, marksObtained: 45 },
      ],
    });

    expect(result).toEqual({ saved: 2 });
    expect(marksRepo.manager.transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a mark above the subject's full marks, and writes nothing", async () => {
    await expect(
      service.enterMarks(1, {
        entries: [{ studentId: 100, subjectId: 200, marksObtained: 150 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(marksRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it("rejects a student who is not in this exam's class", async () => {
    await expect(
      service.enterMarks(1, {
        entries: [{ studentId: 999, subjectId: 200, marksObtained: 10 }],
      }),
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
      service.enterMarks(1, {
        entries: [{ studentId: 100, subjectId: 999, marksObtained: 10 }],
      }),
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
      await service.enterMarks(1, {
        entries: [
          { studentId: 999, subjectId: 200, marksObtained: 10 },
          { studentId: 100, subjectId: 200, marksObtained: 150 },
        ],
      });
      fail('expected enterMarks to throw');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        errors: unknown[];
      };
      expect(response.errors).toHaveLength(2);
    }
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
    const studentsService = { findById: jest.fn().mockResolvedValue(student) };
    const notificationsService = { sendMail: jest.fn() };
    const academicsService = {
      findClassById: jest.fn().mockResolvedValue(classEntity),
    };

    return new ExamsService(
      subjectsRepo as never,
      examsRepo as never,
      marksRepo as never,
      studentsService as never,
      notificationsService as never,
      academicsService as never,
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
    const result = await service.getCombinedResult(10, 100, '2026');

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
    const result = await service.getCombinedResult(10, 100, '2026');

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
      service.getCombinedResult(10, 100, '2026'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
