export interface ParsedPunch {
  biometricId: number;
  punchTime: Date;
}

// Parses ZKTeco's ATTLOG upload body (POST /iclock/cdata?table=ATTLOG).
// Each real punch is one line: "<PIN> <date> <time> <status> <verify> <workcode> ...".
// Lines containing "=" are handshake/option lines, not punches, and OPLOG
// lines are operation logs (user enrolled/deleted etc.), not attendance —
// both are skipped.
export function parseAttendancePunches(payload: string): ParsedPunch[] {
  const punches: ParsedPunch[] = [];

  for (const rawLine of payload.split('\n')) {
    let line = rawLine.trim();
    if (!line || line.includes('=') || line.startsWith('OPLOG ')) {
      continue;
    }
    line = line.replace(/\r/g, '').replace(/\t/g, ' ').replace(/\s+/g, ' ');

    const parts = line.split(' ');
    if (parts.length < 3) {
      continue;
    }

    const [pinStr, datePart, timePart] = parts;
    if (!/^\d+$/.test(pinStr)) {
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      continue;
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(timePart)) {
      continue;
    }

    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    const punchTime = new Date(year, month - 1, day, hour, minute, second);

    punches.push({ biometricId: parseInt(pinStr, 10), punchTime });
  }

  return punches;
}
