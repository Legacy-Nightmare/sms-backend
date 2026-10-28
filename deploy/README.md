# SMS Application — Production Deployment & Operations Guide

## 1. Project Overview

This repository contains the deployment setup for the SMS application.

| Component | Purpose |
|---|---|
| Frontend | Web application |
| Backend | NestJS API |
| PostgreSQL | Application database |
| RustFS | S3-compatible object storage for student profile images |
| Nginx | Reverse proxy and public file routing |
| Docker Compose | Container orchestration |
| GitHub Actions | Automated build and deployment |

### Production paths and configuration

| Item | Value |
|---|---|
| Server deployment directory | `/opt/sms` |
| Frontend repository | `shomvob/aphsmsp/sms-frontend` |
| Backend repository | `shomvob/aphsmsp/sms-backend` |
| Backend staging branch | `aphsmsp-stg` |
| Docker network | `sms_sms` |
| PostgreSQL container | `sms-postgres` |
| RustFS container | `sms-rustfs` |
| Nginx container | `sms-nginx` |
| Frontend container | `sms-frontend` |
| Backend container | `sms-backend` |
| RustFS bucket | `sms-uploads` |
| RustFS internal endpoint | `http://rustfs:9000` |
| Public asset base URL | `http://13.205.21.163` |

**Important:** The IP address above is the current known deployment address. Replace it with the production domain/IP when deploying to a different server. Configure HTTPS before exposing the application publicly.

---

## 2. Architecture

```text
Browser
   |
   | HTTP / HTTPS
   v
Nginx
   |
   |---- Frontend
   |
   |---- /api/... ----------> NestJS Backend
   |
   |---- /sms-uploads/... --> RustFS
                                  |
                                  v
                              sms-uploads
                              S3 bucket

NestJS Backend ------------> PostgreSQL
NestJS Backend ------------> RustFS S3 API
```

The backend stores application data in PostgreSQL and uploads profile images to RustFS.

Student profile images are served through Nginx using URLs such as:

`http://13.205.21.163/sms-uploads/students/example.png`

The frontend must not add `/api` to a complete image URL.

---

## 3. Requirements for a New VPS

Install the following on the new server:

- Ubuntu Server LTS
- Docker Engine
- Docker Compose plugin
- Git
- SSH access to the GitHub repositories
- Sufficient disk space for PostgreSQL, uploaded files, Docker images, and backups

Update the server:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ca-certificates
```

Install Docker using the official Docker Engine installation instructions:

https://docs.docker.com/engine/install/ubuntu/

Verify the installation:

```bash
docker --version
docker compose version
```

Enable Docker:

```bash
sudo systemctl enable --now docker
```

If your deployment user needs Docker access:

```bash
sudo usermod -aG docker "$USER"
```

Log out and log back in before using Docker without `sudo`.

---

## 4. Prepare the Deployment Directory

Create the deployment directory:

```bash
sudo mkdir -p /opt/sms
sudo chown "$USER":"$USER" /opt/sms
cd /opt/sms
```

Clone the repositories using your authorized GitHub access:

```bash
git clone git@github.com:shomvob/aphsmsp/sms-backend.git
git clone git@github.com:shomvob/aphsmsp/sms-frontend.git
```

If your deployment uses a separate deployment repository containing `compose.yaml`, Nginx configuration, or deployment scripts, clone or copy that repository as well.

**Do not create a new Compose file from this README alone.** Use the tested Compose configuration from the existing deployment. It contains the actual service definitions, volumes, networks, health checks, and environment variable names.

Check the files:

```bash
cd /opt/sms
ls -la
find . -maxdepth 3 \
  \( -name 'compose.yaml' -o -name 'compose.yml' \
     -o -name 'docker-compose.yml' -o -name 'Dockerfile' \)
```

---

## 5. Environment Configuration

Keep production secrets in a protected `.env` file or your deployment platform's secret store. Never commit real secrets to GitHub.

Typical settings include:

```dotenv
# PostgreSQL
POSTGRES_DB=your_database_name
POSTGRES_USER=your_database_user
POSTGRES_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD

# RustFS credentials
RUSTFS_ACCESS_KEY=CHANGE_ME
RUSTFS_SECRET_KEY=CHANGE_ME

# Backend S3 configuration
S3_ACCESS_KEY=CHANGE_ME
S3_SECRET_KEY=CHANGE_ME
S3_ENDPOINT=http://rustfs:9000
S3_BUCKET=sms-uploads

# Public asset URL
STORAGE_PUBLIC_URL_BASE=http://13.205.21.163

# Frontend public API URL
VITE_API_BASE_URL=http://13.205.21.163/api
```

These names are examples of the known configuration. Compare them with the variables actually referenced by your Compose file and application. Do not blindly replace a working production `.env` with this example.

In particular:

- `S3_ACCESS_KEY` and `S3_SECRET_KEY` must match the credentials accepted by RustFS.
- `S3_ENDPOINT` must use the internal Docker service name `rustfs`, not the public IP.
- `S3_BUCKET` must match the actual bucket name.
- `STORAGE_PUBLIC_URL_BASE` must match the public domain/IP used by Nginx.
- `VITE_API_BASE_URL` must match how the frontend and Nginx expose the API. Check `src/lib/api.ts` before changing the value.

Protect the environment file:

```bash
chmod 600 .env
```

Never paste production passwords, access keys, database dumps, or private environment values into tickets or public repositories.

---

## 6. Validate Docker Compose Before Deployment

A previous deployment encountered:

```text
service ... IMAGE is required
```

This can happen when a required image variable is missing or the wrong environment file is being loaded.

Check the Compose configuration:

```bash
cd /opt/sms
docker compose config --quiet
```

If this fails, inspect the relevant image references and environment variables:

```bash
grep -nE 'IMAGE|image:|env_file:|environment:' compose.yaml docker-compose.yml 2>/dev/null
```

Do not invent a value for a required image variable. Set it to the intended image/tag used by the tested deployment.

Once validation succeeds:

```bash
docker compose config
```

Review the rendered configuration privately. It may contain sensitive environment values; do not publish its output.

Start the application:

```bash
docker compose up -d
docker compose ps
```

Inspect logs:

```bash
docker compose logs --tail=100
```

If your deployment uses a different Compose filename, add `-f path/to/compose.yaml` to the commands.

---

## 7. RustFS Setup and Public Student Images

The object storage bucket used by the application is:

```text
sms-uploads
```

The backend uses the internal endpoint:

```text
http://rustfs:9000
```

The public file URL uses the Nginx public base URL:

```text
http://13.205.21.163/sms-uploads/students/<filename>
```

### Nginx configuration

The Nginx configuration must include the following location block, adapted to the actual Nginx configuration file:

```nginx
location /sms-uploads/ {
    proxy_pass http://rustfs:9000/sms-uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Validate and reload Nginx using the actual Nginx container/configuration:

```bash
docker exec sms-nginx nginx -t
docker exec sms-nginx nginx -s reload
```

If Nginx is configured through a mounted file, edit that source file—not only the running container.

### Set public read access for student profile images

The `students/` prefix was previously private, causing HTTP 403 errors. It was changed to `download`, and a test image subsequently returned HTTP 200.

Use this only if every object under `students/` is intended to be publicly readable.

The RustFS CLI command:

```bash
docker run --rm \
  --network sms_sms \
  -e RUSTFS_ACCESS_KEY \
  -e RUSTFS_SECRET_KEY \
  --entrypoint /bin/sh \
  rustfs/rc:latest \
  -c 'rc alias set local http://rustfs:9000 "$RUSTFS_ACCESS_KEY" "$RUSTFS_SECRET_KEY" &&
      rc bucket anonymous set download local/sms-uploads/students'
```

Verify the policy:

```bash
docker run --rm \
  --network sms_sms \
  -e RUSTFS_ACCESS_KEY \
  -e RUSTFS_SECRET_KEY \
  --entrypoint /bin/sh \
  rustfs/rc:latest \
  -c 'rc alias set local http://rustfs:9000 "$RUSTFS_ACCESS_KEY" "$RUSTFS_SECRET_KEY" &&
      rc bucket anonymous get local/sms-uploads/students'
```

Expected output:

```text
Anonymous access permission for 'local/sms-uploads/students' is 'download'
```

The credentials must be available in the shell environment for the `-e` flags above to pass them into the temporary CLI container. If they are only stored in `.env`, load the variables securely before running the command.

**Security:** Anyone who knows or discovers a public image URL can view/download that image. Never place private documents, identity documents, certificates, or confidential records under a publicly readable prefix.

### Test the public image URL

```bash
curl -I \
  "http://13.205.21.163/sms-uploads/students/1793132736371-309137556.png"
```

Expected response for an existing image:

```text
HTTP/1.1 200 OK
Content-Type: image/png
```

A `403` means the object/prefix policy or credentials need investigation. A `404` may mean the object key is incorrect or the object does not exist.

---

## 8. Frontend Student Image URL Fix

The frontend previously constructed a malformed URL similar to:

```text
http://13.205.21.163/apihttp:/13.205.21.163/sms-uploads/students/example.png
```

The issue was caused by concatenating `API_BASE_URL` with a photo URL that could already be absolute.

The relevant file is:

```text
src/lib/students-api.ts
```

The `studentPhotoUrl()` function must handle absolute URLs and RustFS paths separately:

```typescript
export function studentPhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;

  const path = photoUrl.trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/sms-uploads/")) {
    return path;
  }

  if (path.startsWith("sms-uploads/")) {
    return `/${path}`;
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const relativePath = path.replace(/^\/+/, "");

  return `${baseUrl}/${relativePath}`;
}
```

The existing `StudentAvatar` component calls `studentPhotoUrl(photoUrl)`, so this is the primary location to check.

After editing, build and test the frontend:

```bash
cd /shomvob/aphsmsp/sms-frontend
npm install
npm run build
```

If the lockfile is current and you want a reproducible install, use `npm ci` instead of `npm install`.

A previous build failed with:

```text
sh: 1: vite: not found
```

This indicates that the frontend dependencies were not installed correctly or `vite` was unavailable in the installed dependencies. Install from the project's package manifest/lockfile; do not install a random global Vite version to hide the issue.

Commit and push the fix:

```bash
git add src/lib/students-api.ts
git commit -m "Fix student profile image URLs"
git push
```

After the frontend deploys, hard-refresh the browser with `Ctrl + Shift + R`.

---

## 9. Database Backup

Database backups must be stored outside the container so they survive container replacement and can be copied off-server.

Before using the backup script below, confirm that:

- The PostgreSQL container is named `sms-postgres`.
- The container has `POSTGRES_USER` and `POSTGRES_DB` configured.
- The account can run `pg_dump`.
- The backup directory has sufficient disk space.

Create a backup directory:

```bash
sudo mkdir -p /opt/sms-backups/database
sudo chown "$USER":"$USER" /opt/sms-backups/database
chmod 700 /opt/sms-backups/database
```

Create `/opt/sms/backup-db.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="sms-postgres"
BACKUP_DIR="/opt/sms-backups/database"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/sms-db-${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL container '$CONTAINER' not found."
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]]; then
  echo "ERROR: PostgreSQL container is not running."
  exit 1
fi

echo "Creating database backup: $BACKUP_FILE"

docker exec "$CONTAINER" sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file is empty."
  rm -f "$BACKUP_FILE"
  exit 1
fi

gzip "$BACKUP_FILE"
chmod 600 "${BACKUP_FILE}.gz"

echo "Backup completed: ${BACKUP_FILE}.gz"
echo "Verify the file and copy it off-server."
```

Enable and run it:

```bash
chmod +x /opt/sms/backup-db.sh
/opt/sms/backup-db.sh
```

Check the output:

```bash
ls -lh /opt/sms-backups/database
gzip -t /opt/sms-backups/database/sms-db-YYYYMMDD_HHMMSS.sql.gz
```

Replace the example filename with the actual generated backup filename.

A successful gzip test checks compression integrity; it does not prove that a complete database restore will succeed. Perform regular test restores.

### Backup retention

A simple manual cleanup command for database backups older than 30 days:

```bash
find /opt/sms-backups/database \
  -type f -name 'sms-db-*.sql.gz' -mtime +30 -print
```

Review the listed files first. Only then delete the files you intend to remove.

Do not rely on the production server as the only backup location. Copy backups to a separate server or secure object storage.

---

## 10. RustFS Object Backup

PostgreSQL backups do not contain the actual image files stored in RustFS. Back up the bucket separately.

Use an S3-compatible client such as AWS CLI with the RustFS endpoint and credentials. First confirm that the client version, endpoint, credentials, and bucket access work in your environment.

Example command pattern:

```bash
aws --endpoint-url http://rustfs:9000 \
  s3 sync s3://sms-uploads /backup/location/sms-uploads
```

This command must run in an environment that can resolve the `rustfs` Docker hostname and has the appropriate S3 credentials configured. If it runs directly on the host, use a reachable host endpoint instead of `rustfs`.

For a host-side backup directory, create it first:

```bash
sudo mkdir -p /opt/sms-backups/rustfs
sudo chown "$USER":"$USER" /opt/sms-backups/rustfs
chmod 700 /opt/sms-backups/rustfs
```

A full bucket backup should include every object that must be retained. Keep the original object keys and verify that the backup contains the expected files.

For consistency, schedule a backup during a quiet period or otherwise ensure the database and object-storage backup represent a compatible recovery point. For stronger guarantees, pause writes during the backup or implement a coordinated backup process.

**Do not treat a database-only backup as a complete application backup.**

---

## 11. Database Restore on a New Production Server

### Critical warning

Restoring a backup into an existing database can overwrite or conflict with existing data. The restore process below is intended for a new or intentionally prepared target database.

Before restoring:

1. Confirm the target server and database.
2. Make a backup of the target database if it contains anything important.
3. Confirm the backup filename and integrity.
4. Confirm the target PostgreSQL version is compatible with the backup.
5. Restore the matching RustFS objects as well.
6. Never restore production data into a database that contains live data without an approved migration/recovery plan.

### Step A: Copy the backup to the new server

Copy the backup file from your secure backup location to:

```text
/opt/sms-backups/database/
```

Verify it:

```bash
gzip -t /opt/sms-backups/database/sms-db-YYYYMMDD_HHMMSS.sql.gz
```

### Step B: Start PostgreSQL

Use the tested Compose file and start the database service. The service name may differ from the container name.

```bash
cd /opt/sms
docker compose up -d
docker ps
```

Confirm that `sms-postgres` is healthy before restoring.

### Step C: Restore the SQL backup

For a new or intentionally emptied target database, the following restores a plain SQL dump:

```bash
gunzip -c \
  /opt/sms-backups/database/sms-db-YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i sms-postgres sh -c \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Replace the filename with the real backup file.

If the target database already contains tables or records, stop and plan the restore first. A plain `pg_dump` SQL file is not a safe automatic merge into an arbitrary existing database.

The command may fail if the target schema already exists. Do not repeatedly run it against the same database without understanding the error.

### Step D: Verify the database

Check PostgreSQL logs:

```bash
docker logs --tail=100 sms-postgres
```

Connect to the database and inspect its tables using the project's configured database tooling. Verify important record counts and relationships before opening the application to users.

### Step E: Restore RustFS objects

Restore the matching object backup into the target `sms-uploads` bucket, preserving the original object keys, such as:

```text
students/<filename>.png
```

Confirm that the bucket exists and that the backend's S3 configuration points to the correct RustFS instance.

Do not make a bucket public until its contents and intended exposure have been reviewed. Reapply the intended anonymous `download` policy for the public student-image prefix if required.

### Step F: Start backend and frontend

After verifying the database and storage:

```bash
cd /opt/sms
docker compose up -d
docker compose ps
docker compose logs --tail=100
```

Use the actual Compose service names and configuration.

Test login, student lists, profile images, and the important application workflows before announcing the production restore complete.

---

## 12. Restore Script — Guarded SQL Restore

The following script checks the input file and asks for confirmation before sending SQL into the configured PostgreSQL container.

Create `/opt/sms/restore-db.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="sms-postgres"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/database-backup.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ "$BACKUP_FILE" != *.sql.gz ]]; then
  echo "ERROR: Expected a compressed plain SQL dump ending in .sql.gz"
  exit 1
fi

if ! gzip -t "$BACKUP_FILE"; then
  echo "ERROR: Backup compression check failed."
  exit 1
fi

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL container '$CONTAINER' not found."
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]]; then
  echo "ERROR: PostgreSQL container is not running."
  exit 1
fi

echo "WARNING: This imports SQL into the configured target database."
echo "It is NOT a safe merge operation and may conflict with existing tables."
echo "Target container: $CONTAINER"
echo "Backup file: $BACKUP_FILE"
read -r -p "Type RESTORE to continue: " CONFIRM

if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

gunzip -c "$BACKUP_FILE" \
  | docker exec -i "$CONTAINER" sh -c \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "SQL restore command completed. Verify the application and database."
```

Enable it:

```bash
chmod +x /opt/sms/restore-db.sh
```

Run it only when you have intentionally prepared the target database:

```bash
/opt/sms/restore-db.sh \
  /opt/sms-backups/database/sms-db-YYYYMMDD_HHMMSS.sql.gz
```

**Important:** The confirmation prompt prevents accidental execution but does not make the restore safe for a live database. Prepare a clean target database or use a tested database-replacement procedure before running it.

---

## 13. GitHub Actions and Image Deployment

The project uses GitHub repositories for frontend/backend code and GitHub Actions for deployment.

Before enabling deployment to a new VPS, configure the repository secrets required by the actual workflow, such as:

- Deployment host/IP
- SSH deployment user
- SSH private key
- Deployment directory
- Registry credentials, if private images are used
- Required image tags and runtime environment settings

The exact secret names must match the checked-in workflow files.

Inspect workflows:

```bash
find .github/workflows -maxdepth 1 -type f -print
```

Review the deployment steps and ensure the workflow:

1. Checks out the intended branch.
2. Installs dependencies and builds successfully.
3. Builds or publishes the intended Docker image.
4. Deploys the correct image tag to the target server.
5. Restarts the relevant Compose services.
6. Fails if a deployment command fails.

Do not assume a successful image build means the application is running correctly. Check container health, logs, database connectivity, and public endpoints after deployment.

---

## 14. Production Verification Checklist

After a deployment or restore, verify the following.

### Containers

```bash
docker ps
docker compose ps
```

Confirm the frontend, backend, Nginx, PostgreSQL, and RustFS containers are running and healthy where health checks are configured.

### Logs

```bash
docker logs --tail=100 sms-backend
docker logs --tail=100 sms-frontend
docker logs --tail=100 sms-nginx
docker logs --tail=100 sms-rustfs
docker logs --tail=100 sms-postgres
```

### Public image URL

```bash
curl -I \
  "http://13.205.21.163/sms-uploads/students/1793132736371-309137556.png"
```

Expected: `200 OK` for an existing public image.

### Frontend

Open the frontend in a browser and verify:

- Login and authentication
- Student list and student details
- Student profile photos
- Image upload and update
- Relevant API requests
- No malformed URLs containing `/apihttp:/`
- No browser console errors related to image loading

### Database and storage

Verify that the restored records and their referenced object keys match. An existing database row does not prove the corresponding image exists in RustFS.

---

## 15. Troubleshooting

### A. `IMAGE is required`

**Cause:** A required Docker image variable may be missing from `.env`, or Compose is reading a different configuration file.

Check:

```bash
docker compose config --quiet
grep -nE 'IMAGE|image:' compose.yaml docker-compose.yml 2>/dev/null
```

Set the correct image/tag variable and validate again before deploying.

### B. `vite: not found`

**Cause:** Frontend dependencies are not installed or Vite is missing from the project dependencies.

Run from the frontend repository:

```bash
npm install
npm run build
```

If a valid lockfile exists, use `npm ci` for a reproducible install. Do not solve this by installing an arbitrary global version of Vite.

### C. RustFS image URL returns `403 AccessDenied`

**Cause:** Anonymous access to the relevant bucket prefix is private or the object request is unauthorized.

Check the policy:

```bash
docker run --rm \
  --network sms_sms \
  -e RUSTFS_ACCESS_KEY \
  -e RUSTFS_SECRET_KEY \
  --entrypoint /bin/sh \
  rustfs/rc:latest \
  -c 'rc alias set local http://rustfs:9000 "$RUSTFS_ACCESS_KEY" "$RUSTFS_SECRET_KEY" &&
      rc bucket anonymous get local/sms-uploads/students'
```

If the intended contents are all public profile images, set `download` on that prefix as described in Section 7.

### D. RustFS URL returns `404`

Check the actual object key and confirm that the object exists in the correct bucket. The URL path must match the key stored in RustFS.

### E. Image opens directly but not in the application

Check the browser's Network tab and inspect the exact image URL.

Incorrect:

```text
http://13.205.21.163/apihttp:/13.205.21.163/sms-uploads/students/example.png
```

Correct:

```text
http://13.205.21.163/sms-uploads/students/example.png
```

Check `studentPhotoUrl()` in `src/lib/students-api.ts`. Absolute URLs must be returned unchanged; `/sms-uploads/...` paths must not have the API base URL prefixed.

Rebuild and redeploy the frontend after the fix, then hard-refresh the browser.

### F. Nginx does not serve `/sms-uploads/`

Validate the Nginx configuration:

```bash
docker exec sms-nginx nginx -t
docker logs --tail=100 sms-nginx
```

Confirm that the Nginx container can resolve `rustfs` on the intended Docker network and that the location block points to `http://rustfs:9000/sms-uploads/`.

### G. Backend cannot upload files

Check backend logs and verify:

- `S3_ENDPOINT=http://rustfs:9000`
- Access key and secret match RustFS
- Bucket name is correct
- Backend and RustFS share a reachable Docker network
- RustFS is running and ready
- The application has permission to write objects

Do not grant anonymous upload permission to fix a backend upload error. Anonymous public access and authenticated backend writes are separate concerns.

### H. Database restore fails

Possible causes include:

- The target database already has tables
- The database user or database name is wrong
- PostgreSQL is not ready
- The dump format does not match the restore command
- The source and target PostgreSQL versions differ
- Required extensions or permissions are missing

Inspect the exact error before retrying. Do not repeatedly restore into a partially populated database.

### I. Containers are running but the application fails

Check:

```bash
docker compose ps
docker compose logs --tail=200
```

Verify `.env`, container health, internal network connectivity, API configuration, and database availability. Running containers alone do not prove the application is operational.

---

## 16. Operational Safety

- Keep `.env`, database backups, and storage backups private.
- Store at least one backup copy outside the production VPS.
- Regularly test database and object-storage restoration.
- Use HTTPS for production traffic.
- Restrict PostgreSQL and RustFS administration ports from public access.
- Keep public images separate from private documents.
- Do not use public bucket policies to fix authenticated upload failures.
- Never restore an old production backup over a live database without a recovery plan.
- Keep a record of the application version, database backup time, and object-storage backup time.
- Verify student records and images after every recovery operation.

---

## 17. Final New-Server Checklist

- [ ] Ubuntu and Docker installed
- [ ] Repositories cloned
- [ ] Correct Compose configuration available
- [ ] Production `.env` configured securely
- [ ] `docker compose config --quiet` succeeds
- [ ] PostgreSQL starts and is healthy
- [ ] RustFS starts and the `sms-uploads` bucket exists
- [ ] Database backup restored and verified
- [ ] RustFS object backup restored and verified
- [ ] Correct public-read policy configured for student images
- [ ] Nginx configuration validated
- [ ] Backend and frontend containers running
- [ ] Public API and image URLs tested
- [ ] Login and student workflows verified
- [ ] Backup scripts tested
- [ ] Off-server backup configured
- [ ] HTTPS and firewall rules configured

**A production deployment is complete only after the application, database, object storage, and public endpoints have all been verified.**
