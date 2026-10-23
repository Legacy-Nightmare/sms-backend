// Bangladesh NCTB-style grading scale (percentage -> letter grade + GPA).
const GRADE_SCALE: Array<{ min: number; grade: string; gpa: number }> = [
  { min: 80, grade: 'A+', gpa: 5.0 },
  { min: 70, grade: 'A', gpa: 4.0 },
  { min: 60, grade: 'A-', gpa: 3.5 },
  { min: 50, grade: 'B', gpa: 3.0 },
  { min: 40, grade: 'C', gpa: 2.0 },
  { min: 33, grade: 'D', gpa: 1.0 },
  { min: 0, grade: 'F', gpa: 0.0 },
];

export function gradeForPercentage(percentage: number): { grade: string; gpa: number } {
  const match = GRADE_SCALE.find((entry) => percentage >= entry.min);
  return match ? { grade: match.grade, gpa: match.gpa } : { grade: 'F', gpa: 0 };
}
