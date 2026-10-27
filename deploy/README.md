# EC2 deploy — one-time setup

This is the only manual setup. After this, every push to `aphsmsp-stg` in
either repo (`sms-backend`, `sms-frontend`) auto-deploys via GitHub Actions.

## 1. EC2 instance

- Ubuntu Server (22.04/24.04 LTS), SSH user `ubuntu`.
- Security group: allow inbound **22** (SSH, ideally restricted to your IP)
  and **80** (HTTP, open).
- Start small and watch it — this is the sizing test before the client VPS.
  Try **t3.small** (2 GB RAM) first: Postgres + Node backend + Node SSR
  frontend + nginx all idle-fit comfortably, but watch `docker stats` and
  `free -h` under real usage before deciding it's enough. If it swaps or
  OOM-kills under load, step up to **t3.medium** (4 GB). Don't start below
  2 GB — Postgres alone wants headroom for shared_buffers, and the frontend's
  SSR process plus backend both need their own Node heap.

## 2. Install Docker on the instance

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# log out and back in for the group change to apply
sudo mkdir -p /opt/sms
sudo chown ubuntu:ubuntu /opt/sms
```

Confirm `docker compose version` reports v2.10+ (needed for `--wait`).

## 3. GitHub Secrets

Both repos are separate GitHub repos under the same org — add these as
**repository secrets** in each (Settings → Secrets and variables → Actions).
If the org allows it, adding the shared ones as **organization secrets**
instead avoids duplicating them.

All secret *names* carry an `STG_` prefix — this is the staging/EC2
environment; when the client's VPS gets its own branch + workflow later,
that one uses a different prefix (e.g. `PROD_`) so both can coexist as
secrets on the same repos without colliding. The prefix is only on the
GitHub Secret name — the actual app env vars on the server (`DB_USERNAME`,
`JWT_SECRET`, etc.) stay unprefixed, since that's what the app code reads.

**Shared (add to both `sms-backend` and `sms-frontend`):**

| Secret | Value |
|---|---|
| `STG_EC2_HOST` | the EC2 instance's public IP |
| `STG_EC2_SSH_USER` | `ubuntu` |
| `STG_EC2_SSH_KEY` | full contents of your `.pem` private key |

**`sms-backend` only** (becomes the container's `.env` on the server):

| Secret | Notes |
|---|---|
| `STG_DB_USERNAME` | e.g. `sms_admin` — not `postgres`, pick something specific |
| `STG_DB_PASSWORD` | strong, random |
| `STG_DB_DATABASE` | e.g. `school_management` |
| `STG_JWT_SECRET` | long random string |
| `STG_JWT_EXPIRES_IN` | e.g. `7d` |
| `STG_SMTP_HOST`, `STG_SMTP_PORT`, `STG_SMTP_USER`, `STG_SMTP_PASSWORD`, `STG_SMTP_FROM` | leave blank to let guardian emails degrade to logging (see backend CLAUDE.md) |
| `STG_MINIO_ROOT_USER` | pick any username, e.g. `sms-minio-admin` |
| `STG_MINIO_ROOT_PASSWORD` | strong, random |

`sms-frontend` needs no app secrets — it calls the backend via the
same-origin `/api` path through nginx, so there's no per-environment URL or
CORS config to inject at build time.

### Object storage: MinIO instead of Supabase

Staging has no Supabase project, so `STG_MINIO_ROOT_USER`/`STG_MINIO_ROOT_PASSWORD`
above stand in for it — `deploy/docker-compose.yml` runs a self-hosted MinIO
container (S3-compatible, ~100–150MB RAM idle) and maps those same
credentials onto the app's `SUPABASE_S3_ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`
env vars. `StorageService`'s code is unchanged — same AWS SDK calls work
against either provider. The endpoint, region, and bucket name are fixed
values in `docker-compose.yml`, not secrets (nothing sensitive in them).

A one-shot `minio-init` container creates the bucket and grants anonymous
**read-only, single-object** access (not MinIO's `download` preset, which
also allows listing every filename in the bucket) on every deploy — see
`deploy/minio-policy.json`. nginx exposes reads at `/storage/<bucket>/<key>`;
writes/deletes only ever happen from the backend container using the real
credentials.

When the client's real Supabase project exists (VPS phase), swap
`STG_MINIO_ROOT_USER`/`PASSWORD` back out for real `SUPABASE_S3_*` secrets
and point the backend's `.env`/compose config at Supabase instead — no code
change needed either way.

No GHCR secret is needed anywhere: the backend's own `GITHUB_TOKEN` (minted
per workflow run) pushes images, and the EC2 deploy step uses that same
token — passed through for that one job run — to `docker login` and pull.

## 4. First deploy

Deploy **`sms-backend`'s `aphsmsp-stg` branch first.** Its workflow is the
one that copies `deploy/docker-compose.yml` and `deploy/nginx.conf` onto the
server (`/opt/sms`) and writes `/opt/sms/.env` from secrets — the frontend's
workflow assumes that's already in place and only touches its own container.

```bash
git push origin aphsmsp-stg   # in sms-backend
# wait for it to go green in the Actions tab
git push origin aphsmsp-stg   # in sms-frontend
```

Then visit `http://<EC2_IP>/` for the app and `http://<EC2_IP>/docs` for the
API's Swagger UI.

### Bootstrap the first admin user

The database starts empty — no login exists until you create one:

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
cd /opt/sms
docker compose run --rm backend node dist/bootstrap-admin.js "Admin Name" admin@example.com "a-real-password"
```

(`bootstrap-admin.ts` compiles to `dist/bootstrap-admin.js` the same way
`main.ts` does — no separate build step needed.)

## How a deploy works

Each repo's workflow: run its tests → build a Docker image → push to GHCR
(`ghcr.io/<org>/<repo>:stg`, private) → SSH to EC2 → pull the new image →
recreate just that one container. The backend's deploy additionally runs
`typeorm migration:run` against the compiled `dist/data-source.js` before
restarting, so schema changes land before the new code that needs them goes
live.

## Backups, and the later move to the client's VPS

There are two independent data stores to carry over — Postgres (database
rows) and MinIO (uploaded files) — each with its own backup/restore script.
Both are **cold-cutover restores** (they wipe the target first), fine for a
planned migration, not zero-downtime failover. This whole flow was tested
end-to-end against a real stack (seeded data → backup → fresh volumes →
restore → confirmed byte-for-byte back, including the MinIO anonymous-read
policy surviving the restore) before being written down here.

### Taking backups (on EC2, before the move)

```bash
cd /opt/sms
./pg-backup.sh      # writes ./backups/sms-pg-<timestamp>.sql.gz    (pg_dump)
./minio-backup.sh   # writes ./backups/minio-<timestamp>.tar.gz     (tar of MinIO's /data)
```

`minio-backup.sh` tars MinIO's *entire* data directory, not just the files —
that includes its internal `.minio.sys` metadata, which is what remembers
the bucket and its read-only anonymous policy. Restoring it brings that
policy back automatically; you don't need to re-run `minio-init`'s setup by
hand.

Copy both archives to the VPS, e.g.:

```bash
scp -i your-key.pem /opt/sms/backups/sms-pg-<timestamp>.sql.gz ubuntu@<VPS_IP>:/opt/sms/backups/
scp -i your-key.pem /opt/sms/backups/minio-<timestamp>.tar.gz ubuntu@<VPS_IP>:/opt/sms/backups/
```

### Setting up the VPS

Run through steps 1–3 above on the VPS (Docker install, `/opt/sms`, GitHub
Secrets) — likely under a new prefix (e.g. `PROD_`) rather than reusing
`STG_`, so both environments' secrets can coexist on the same repos. Deploy
both repos' branches once first, the normal way (push → Actions deploys) —
this creates fresh, *empty* Postgres and MinIO on the VPS, which the restore
below then overwrites. Don't bootstrap an admin user on the VPS; the restored
Postgres dump already has one.

### Restoring (on the VPS)

```bash
cd /opt/sms
./pg-restore.sh backups/sms-pg-<timestamp>.sql.gz
./minio-restore.sh backups/minio-<timestamp>.tar.gz
```

`pg-restore.sh` drops and recreates the database before loading the dump.
`minio-restore.sh` stops the `minio` container, wipes its data directory
(including the empty bucket the VPS's own first deploy just created), untars
the backup in its place, then restarts it. Order between the two doesn't
matter — they're independent stores.

Verify before pointing real traffic at the VPS: log in with a restored
account, and check a known student's photo actually loads.
