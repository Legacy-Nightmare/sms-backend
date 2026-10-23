# School Management System — Backend

This file is auto-loaded by Claude Code at the start of every session in
this directory. It's the handoff from the session that built the MVP, so a
fresh session has full context without the original conversation.

## What this is

A minimalistic school management backend for a demo: student records
across classes 1–10, attendance fed directly from a ZKTeco biometric
device, exam results with guardian email notifications, and school
notices. Built with **NestJS 10 + TypeORM 1.x + PostgreSQL**.

This is a brand-new, standalone project — not related to the
`zkteco-integration-server` repo, though it reuses that project's
knowledge of the ZKTeco ADMS device protocol (the device-push attendance
mechanism) since the same kind of biometric devices feed this system too.

## Running it

```bash
docker compose up -d          # starts Postgres on localhost:5433
npm run start:dev             # dev server, reads .env (PORT=8082 by default)
npm run create-admin -- "Name" admin@example.com password123   # bootstrap first admin
```

Swagger UI is at `/docs` (e.g. `http://localhost:8082/docs`) once the
server is running — click "Authorize" and paste a JWT from `/auth/login`
to try protected routes directly from the browser. The `/iclock/*` device
endpoints are deliberately excluded from the docs (`@ApiExcludeEndpoint`)
since they're the raw ZKTeco wire protocol, not JSON REST.

`.env` is gitignored; copy `.env.example` and fill in real SMTP credentials
when you want guardian emails to actually send (see below).

## Key architectural decisions worth knowing the reasoning for

**ZKTeco device PINs are numeric-only — biometric ID vs. display code are
two different fields.** The user wanted each student identifiable by a
human-readable `class-section-roll` code like `1-RUP-56`. But ZKTeco
devices (and this project's sibling `zkteco-integration-server` repo's own
ADMS parser) only accept **numeric** user IDs/PINs — confirmed by that
repo's `LooksNumeric(empID)` check, which silently drops any non-numeric
line. So `Student` has two separate fields:
- `code` — the human-readable `"{classLevel}-{section}-{roll}"` string,
  for display/reports only. Never sent to the device.
- `biometricId` — an auto-incrementing numeric PIN (starts at 1000),
  generated at student creation and returned in the API response so an
  admin knows what to actually enroll on the physical device's keypad/
  fingerprint scanner.

Attendance punches from the device arrive keyed to `biometricId`, resolved
to a student via `StudentsService.findByBiometricId`.

**TypeORM 1.x, not 0.3.x.** `npm install typeorm` pulled `1.1.1` (a real,
current major version as of late 2026, not a typo) — paired with
`@nestjs/typeorm@^12`. One breaking change from the 0.3.x docs/tutorials
you'll find online: `relations` in `find`/`findOne` options must be an
**object**, not a string array — `{ relations: { guardians: true } }`, not
`{ relations: ['guardians'] }`. Every service in this repo already uses
the object form; keep doing that for new queries.

**NestJS pinned to v10, not latest.** The `@nestjs/cli` latest tag
currently scaffolds Nest 12 (beta) with TypeScript 6 and vitest, which hit
a real `npm install` bug (`Cannot read properties of null (reading
'edgesOut')`, an npm arborist peer-dependency resolution crash around
`@vitest/browser-playwright`). Don't `npm install -g @nestjs/cli@latest`
or bump past v10 here without checking that's actually fixed upstream.
Same reasoning applies to `@nestjs/swagger` — pinned to `^8.1.1`, the last
major whose peer deps accept `@nestjs/common@^10`; `npm install
@nestjs/swagger` with no version pin pulls a v12 that requires Nest 12 and
fails to resolve, same ERESOLVE pattern.

**Swagger docs are auto-generated from DTOs, not hand-annotated.** The
`@nestjs/swagger` CLI plugin (`"plugins": ["@nestjs/swagger"]` in
`nest-cli.json`) introspects `class-validator` decorators and TS types at
build time, so every DTO/entity's fields, types, and enums show up in
`/docs` without manually adding `@ApiProperty()` everywhere. Only
hand-added decorators are `@ApiTags`/`@ApiBearerAuth` per controller (for
grouping + the lock icon) and `@ApiExcludeEndpoint` on the four `/iclock/*`
handlers (raw-text wire protocol, not real JSON endpoints) and
`@ApiHideProperty` on `User.passwordHash` (already `select: false` at the
DB level, but the Swagger schema is generated from the TS class alone and
doesn't know that, so it needed hiding explicitly too).

**Raw-text body parsing for ZKTeco device routes.** ZKTeco devices POST
attendance data as plain text, sometimes with no `Content-Type` header at
all, which Nest's default JSON/urlencoded body parsers silently ignore
(`req.body` ends up empty, not an error). `main.ts` disables Nest's
automatic body parser (`bodyParser: false`) and manually registers
`express.text({ type: () => true })` scoped to `/iclock/*` ahead of the
normal `express.json()` / `express.urlencoded()` for everything else. If
you add another device-facing endpoint outside `/iclock`, it needs the
same treatment or its body will silently be empty.

**Guardian emails degrade to logging, not failure, when SMTP isn't
configured.** `NotificationsService` checks for `SMTP_HOST`/`SMTP_USER`/
`SMTP_PASSWORD` at startup; if any are missing it logs what *would* have
been sent instead of calling nodemailer. This means the whole app (exam
publishing, notices) works end-to-end in a fresh checkout with zero SMTP
setup — useful for demos, but means "I published results" isn't proof
guardians actually got anything until SMTP is configured for real.

**Grading scale is Bangladesh NCTB-style** (`src/exams/grading.ts`):
A+ ≥80, A ≥70, A- ≥60, B ≥50, C ≥40, D ≥33, F <33, with matching GPA
points (5.0 down to 0.0). Chosen based on context (Bangladesh-based
company), not explicitly requested — revisit if that's wrong.

**No audit trail, no soft deletes, `synchronize: true`.** Deliberately
minimal for a demo-stage MVP, matching the "minimalistic for now, we'll
improve later" framing the whole project was scoped under. Switch
`synchronize` to proper TypeORM migrations before this ever holds real
student data.

## Module layout

```
src/
  academics/      - ClassEntity (level 1-10) + Section, CRUD
  students/       - Student (code + biometricId) + Guardian (1:many), CRUD
  users/          - staff accounts (admin/teacher), used by auth
  auth/           - JWT login (/auth/login), Passport JWT strategy
  attendance/     - ADMS protocol endpoints (/iclock/*) + attendance query
  exams/          - Subject, Exam, Mark entities; result calc + grading;
                    publish-exam sends guardian emails
  notices/        - school/class-wide notices; publish sends guardian emails
  notifications/  - nodemailer wrapper, degrades to logging w/o SMTP
  common/         - Role enum, JWT/Roles guards, @Roles decorator
  bootstrap-admin.ts - standalone script to create the first admin user
```

## API surface

```
POST /auth/login                        - public

GET/POST    /classes                     - admin write, any authed read
GET/POST    /sections                    - admin write, any authed read
GET/POST    /students                    - admin write, any authed read
GET/DELETE  /students/:id

POST /users                              - admin only (create teacher/admin)
GET  /users                              - admin only
DELETE /users/:id                        - admin only

GET  /iclock/cdata        (device, no auth) - ADMS init handshake
POST /iclock/cdata        (device, no auth) - ATTLOG punch upload
GET  /iclock/getrequest   (device, no auth) - heartbeat (always "OK", no
                                               remote command queue yet)
POST /iclock/devicecmd    (device, no auth) - command ack (unused, no-op)
GET  /attendance?studentId=&from=&to=    - any authed

GET/POST /subjects                       - admin write, any authed read
GET/POST /exams                          - admin write, any authed read
POST /exams/:id/marks                    - admin or teacher
GET  /exams/:id/results                  - any authed (whole class)
GET  /exams/:id/results/:studentId       - any authed (one student)
POST /exams/:id/publish                  - admin only, emails guardians

GET/POST /notices                        - admin or teacher
POST /notices/:id/publish                - admin or teacher, emails guardians
```

## What's NOT built yet

- No frontend — API-only so far.
- No `user`-role self-lookup endpoint (same gap pattern as the sibling
  `zkteco-integration-server` project).
- No remote command queue for the ADMS heartbeat (`/iclock/getrequest`
  always replies plain "OK" — can't push "sync device" style commands to
  hardware yet, only receive its pushes).
- No per-student attendance percentage/summary endpoint yet, only raw log
  listing.
- No fee/finance module (explicitly deferred per the original feature
  scoping conversation).
- Dashboard/KPI endpoints.
- Teacher-to-class assignment (the `User` entity has no link to which
  class/section a teacher owns yet — every teacher can touch every class).
