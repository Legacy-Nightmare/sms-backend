# SMS Application — EC2 Staging, CI/CD, Backup & Production Migration

> **Purpose:** Ei document follow kore notun developer Ubuntu EC2 server setup korte parbe, GitHub Actions diye staging deploy korte parbe, data backup nite parbe, ebong staging-er database o uploaded files client-er production VPS-e migrate korte parbe.
>
> **Current architecture:** Docker Compose + PostgreSQL 16 + RustFS (S3-compatible object storage) + Backend + Frontend + Nginx.
>
> **Important:** Ei project-er current server-e RustFS use hocche. Purono MinIO-specific instruction/script verify na kore use kora jabe na.

---

## 1. Architecture Overview

```text
                         Users
                           |
                           v
                    EC2 / VPS :80
                           |
                           v
                         Nginx
                     /     |      \
                    /      |       \
                   v       v        v
              Frontend   Backend   RustFS
                :3000     :8082    :9000
                            |          |
                            v          v
                       PostgreSQL   Object files
                         :5432      sms-uploads
```

### Docker Compose services

| Service | Purpose | Port |
|---|---|---|
| `nginx` | Public HTTP reverse proxy | Host port `80` |
| `frontend` | Web application | Internal `3000` |
| `backend` | API server | Internal `8082` |
| `postgres` | Application database | Internal `5432` |
| `rustfs` | S3-compatible file storage | Internal `9000` |
| RustFS console | Storage administration | Host `127.0.0.1:9001` only |

### Persistent data

- `sms_pgdata` — PostgreSQL database files
- `sms_rustfs_data` — RustFS objects and metadata
- `sms_uploads` — Backend local uploads, if the application uses them

**Deployment must not delete these volumes.** Never run `docker compose down -v` or `docker volume prune` as part of a routine deployment.

---

## 2. Requirements

### AWS / server

- Ubuntu EC2 instance or compatible Ubuntu VPS
- Recommended starting size: at least 2 vCPU and 4 GB RAM; increase according to traffic and database size
- Enough disk space for the application, uploaded files, and backups
- SSH access
- A domain name is recommended for production HTTPS

### GitHub repositories

- `sms-backend`
- `sms-frontend`

Current staging branch:

```text
aphsmsp-stg
```

The branch and image tags in this document must match the GitHub Actions workflow configuration.

### GitHub Actions deployment flow

1. Developer pushes code to `aphsmsp-stg`.
2. GitHub Actions runs the configured checks and builds a Docker image.
3. The image is pushed to GitHub Container Registry (GHCR).
4. GitHub Actions connects to the staging server using SSH.
5. The server pulls the new image and recreates the relevant service.

Frontend and backend deployments are separate workflows. The exact workflow files in each repository are the source of truth for the triggers, secret names, image tags, and commands.

---

## 3. Create the EC2 Instance

1. Create an Ubuntu EC2 instance.
2. Configure its security group.

Recommended inbound rules:

| Port | Source | Purpose |
|---|---|---|
| `22` | Your trusted IP/CIDR | SSH administration |
| `80` | `0.0.0.0/0` | HTTP |
| `443` | `0.0.0.0/0` | HTTPS, after TLS is configured |

Do not expose PostgreSQL port `5432`, backend port `8082`, or RustFS port `9000` directly to the Internet.

RustFS console port `9001` should remain bound to localhost. Do not add a public security-group rule for it.

Connect to the server:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Use the actual SSH username and key for your instance. Some AMIs use a different username.

Update Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git
```

---

## 4. Install Docker

Install Docker Engine and the Docker Compose plugin using the official Docker instructions for Ubuntu:

https://docs.docker.com/engine/install/ubuntu/

Verify the installation:

```bash
docker --version
docker compose version
```

### Rootless Docker note

The current staging setup uses Rootless Docker. Run Docker commands as the account that owns the Rootless Docker daemon. Do not randomly switch between `docker` and `sudo docker`; those can use different Docker daemons and different volumes.

Verify which daemon is being used:

```bash
docker info
docker context show
docker volume ls
```

If this is a fresh server, configure and start Rootless Docker according to the official instructions:

https://docs.docker.com/engine/security/rootless/

Make sure the Docker daemon starts after a server reboot. Follow the official Rootless Docker systemd/user-service instructions for the chosen account.

### Allowing host port 80 with Rootless Docker

The existing staging setup has used this sysctl setting:

```bash
sudo tee /etc/sysctl.d/99-rootless-ports.conf <<'EOF'
net.ipv4.ip_unprivileged_port_start=80
EOF

sudo sysctl --system
```

This permits unprivileged processes to bind ports starting at 80. Review this security trade-off before applying it to a new production server.

An alternative is to keep the application on a high port such as `8080` and use a host-level reverse proxy for public ports `80` and `443`.

---

## 5. Prepare the Application Directory

The deployment workflows currently expect the application stack under:

```text
/opt/sms
```

Create the directory and assign it to the account that runs Rootless Docker and deployment commands.

```bash
sudo mkdir -p /opt/sms
sudo chown -R "$USER":"$(id -gn)" /opt/sms
cd /opt/sms
```

**Important:** The backend deployment workflow is expected to copy its deployment files into this directory. Confirm that the workflow uses the same path before running the first deployment.

Expected files:

```text
/opt/sms/
├── docker-compose.yml
├── nginx.conf
├── .env
└── backups/
```

Do not commit `.env`, private keys, database passwords, JWT secrets, or storage credentials to Git.

---

## 6. Configure GitHub Actions Secrets

Open each repository:

**GitHub → Repository → Settings → Secrets and variables → Actions**

Create the secrets required by that repository's actual workflow.

### Shared staging deployment secrets

| Secret | Purpose |
|---|---|
| `STG_EC2_HOST` | Staging server public IP or hostname |
| `STG_EC2_SSH_USER` | SSH account used by the deployment workflow |
| `STG_EC2_SSH_KEY` | Private SSH key used by GitHub Actions |

Use the private key content expected by the SSH action. Do not upload the `.pem` file to the repository.

### Frontend workflow secrets

The current frontend workflow uses:

| Secret | Purpose |
|---|---|
| `STG_GHCR_USERNAME` | GitHub username that can read the private package |
| `STG_GHCR_READ_TOKEN` | Token with permission to read the required GHCR package |

The username must not be blank. The token must be authorized to access the private image package.

The frontend image name currently used by the setup is:

```text
ghcr.io/legacy-nightmare/sms-frontend
```

Confirm this matches `.github/workflows/frontend.yml`.

### Backend application secrets

The older setup documentation lists these backend secrets:

- `STG_DB_USERNAME`
- `STG_DB_PASSWORD`
- `STG_DB_DATABASE`
- `STG_JWT_SECRET`
- `STG_JWT_EXPIRES_IN`
- SMTP-related secrets required by the application

The old documentation also mentions `STG_MINIO_ROOT_USER` and `STG_MINIO_ROOT_PASSWORD`. Those are MinIO-specific names and must not be assumed correct for the current RustFS setup.

**Before adding or renaming secrets:** inspect `.github/workflows/` in `sms-backend`. Use the exact names referenced by the workflow's `secrets.*` expressions. The workflow must map the GitHub secret values to the environment variable names required by the Compose file and backend.

For the current Compose configuration, the server `.env` needs at least the variables below, in addition to the backend's application-specific variables.

```dotenv
DB_USERNAME=your_database_user
DB_PASSWORD=replace_with_a_strong_unique_password
DB_DATABASE=your_database_name

RUSTFS_ACCESS_KEY=your_storage_access_key
RUSTFS_SECRET_KEY=replace_with_a_long_random_secret

STORAGE_BUCKET=sms-uploads
STORAGE_PUBLIC_URL_BASE=

BACKEND_IMAGE=ghcr.io/legacy-nightmare/sms-backend:stg
FRONTEND_IMAGE=ghcr.io/legacy-nightmare/sms-frontend:stg
```

These are examples, not production credentials. Generate unique credentials for every environment.

Keep the existing JWT, SMTP, and other backend-specific variables required by the application's `.env` configuration. Do not replace a working application `.env` with only the example variables above.

Set appropriate file permissions:

```bash
chmod 600 /opt/sms/.env
```

---

## 7. First Deployment — Backend First

The backend repository's deployment workflow is expected to provide the Compose and Nginx configuration files. The frontend deployment expects the shared stack to exist already.

### Step 1 — Deploy the backend

1. Confirm the backend workflow is configured for `aphsmsp-stg`.
2. Confirm the GitHub secrets are configured.
3. Push or merge the intended backend commit into `aphsmsp-stg`.
4. Open **GitHub → Actions** and inspect the backend workflow run.
5. Confirm the image build, GHCR push, SSH connection, and deployment steps all succeed.

### Step 2 — Verify the server files

SSH into the server:

```bash
cd /opt/sms
ls -la
```

Confirm these files exist:

```text
docker-compose.yml
nginx.conf
.env
```

Check that `.env` contains the required variables without printing its secret values into logs or chat.

### Step 3 — Validate Compose configuration

```bash
cd /opt/sms
docker compose config -q
```

If the command reports missing variables or invalid configuration, fix those before starting the stack.

Avoid sharing the output of `docker compose config` publicly because resolved configuration can contain secrets.

### Step 4 — Start the stack

Only do this after verifying the Compose file and `.env`:

```bash
docker compose up -d
docker compose ps
```

Inspect service logs if a container fails:

```bash
docker compose logs --tail=100 postgres
docker compose logs --tail=100 rustfs
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 nginx
```

### Step 5 — Deploy the frontend

Once the backend workflow has created the shared stack, push or merge the intended frontend commit into `aphsmsp-stg`.

Inspect the frontend workflow in GitHub Actions. Confirm that the image is pushed to GHCR and that the server successfully pulls and recreates the frontend service.

---

## 8. Compose and Nginx Configuration

The source deployment files should be maintained in the backend repository, where the deployment workflow expects to find them.

Expected source locations in the existing project:

```text
sms-backend/deploy/docker-compose.yml
sms-backend/deploy/nginx.conf
```

Confirm these paths in the workflow before changing them. The deployed copies are expected at:

```text
/opt/sms/docker-compose.yml
/opt/sms/nginx.conf
```

### Important service names

The current Compose service names are:

```text
postgres
rustfs
backend
frontend
nginx
```

Inside the Compose network, Nginx should route to `backend`, `frontend`, and `rustfs`. It should not reference `minio` unless a service with that name actually exists.

### Nginx storage route

For the current RustFS service, the storage route should target the RustFS S3 API on port `9000`, not a nonexistent `minio` hostname.

Example:

```nginx
location /storage/ {
    proxy_pass http://rustfs:9000/;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**URL mapping must be verified against the backend code.** With this example, Nginx strips the `/storage/` prefix before forwarding the request. Confirm that the backend generates object URLs that match this behavior and the actual bucket/object key layout.

Do not assume that changing the Nginx route alone fixes public file URLs.

### Test and reload Nginx

```bash
cd /opt/sms

docker compose run --rm --no-deps nginx nginx -t
docker compose up -d --no-deps --force-recreate nginx

docker compose ps
docker compose logs --tail=50 nginx
```

If the Nginx test fails, fix the configuration before recreating the service.

---

## 9. Verify Staging

Run:

```bash
cd /opt/sms
docker compose ps
```

Check each service's logs and health status.

Test the HTTP endpoint locally on the server:

```bash
curl -I http://localhost/
```

Test the public website from a browser using the EC2 public IP or configured domain.

Also verify:

- Frontend loads successfully.
- Login and authentication work.
- Backend API routes respond correctly.
- Database reads and writes work.
- File uploads work.
- Uploaded files can be retrieved through the intended public URL.
- Email/SMTP features work, if used.
- A server restart does not lose database records or uploaded files.

Use the actual API health endpoint documented by the backend; do not assume that `/health` or `/api/health` exists.

### RustFS console

The current Compose setup binds the console to:

```text
127.0.0.1:9001
```

To access it through an SSH tunnel from your own computer:

```bash
ssh -i /path/to/key.pem \
  -L 9001:127.0.0.1:9001 \
  ubuntu@YOUR_EC2_PUBLIC_IP
```

Then open:

```text
http://localhost:9001
```

Use the actual SSH username and key. Do not expose the console publicly just to make it easier to access.

---

## 10. Routine Deployment

When a developer pushes to the configured staging branch:

1. GitHub Actions runs the configured workflow.
2. The workflow builds and publishes the relevant image.
3. The server pulls the image.
4. The relevant application service is recreated.
5. The deployment is checked through service status and logs.

For manual inspection:

```bash
cd /opt/sms
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

If the workflow fails, inspect the failed step in GitHub Actions first. Do not immediately delete volumes or reset the server.

### Important deployment rules

- Never run `docker compose down -v` for a routine deployment.
- Never remove `sms_pgdata`, `sms_rustfs_data`, or `sms_uploads` to fix an image problem.
- Do not manually change `.env` without documenting the change.
- Keep the source Compose and Nginx files in Git synchronized with the deployment workflow.
- Use a tested image tag or commit SHA when rolling back, rather than assuming that `latest` points to a known version.

---

## 11. Backup Policy

The staging server contains real application data. Treat backups as essential before production migration.

Back up these items:

1. PostgreSQL database.
2. RustFS data and metadata.
3. Backend local uploads, if the application stores files in `/app/uploads`.
4. Required environment configuration, stored securely and separately from public code.
5. The exact application image tags/commit SHAs and deployment configuration.

Store backups outside the server being backed up. Prefer encrypted storage with restricted access.

**A database backup alone is not sufficient if database rows refer to uploaded files in RustFS or local uploads.**

### Before starting a backup

- Confirm there is enough disk space.
- Confirm the target backup directory is protected.
- Plan a maintenance window.
- Stop application writes/uploads during the backup to reduce the risk of database/object-store inconsistency.
- Confirm the backup will not overwrite an existing backup.

Create a backup directory:

```bash
cd /opt/sms
mkdir -p backups
chmod 700 backups
```

### Step 1 — Pause application writes

During the planned backup window:

```bash
cd /opt/sms
docker compose stop backend
```

This prevents the backend from accepting new writes through that service. Confirm there are no other processes writing directly to the database or object store.

### Step 2 — Back up PostgreSQL

The following uses PostgreSQL's custom dump format, which can later be restored with `pg_restore`.

```bash
cd /opt/sms

BACKUP_DIR="$PWD/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

docker compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$BACKUP_DIR/postgres-$STAMP.dump"

test -s "$BACKUP_DIR/postgres-$STAMP.dump"
```

Check the backup file:

```bash
ls -lh "$BACKUP_DIR"
```

A non-empty file is only an initial check. For important backups, validate the dump with PostgreSQL tools and perform a test restore in a separate database or test environment.

### Step 3 — Back up RustFS

RustFS uses its own data directory, mounted at `/data` in the current Compose configuration.

For a cold filesystem backup, stop RustFS first:

```bash
cd /opt/sms
docker compose stop rustfs
```

Find the actual Docker volume name:

```bash
docker volume ls
```

The current expected name is `sms_rustfs_data`, but the actual name can differ if the Compose project or volume configuration changes. Verify it before proceeding.

**Only continue after confirming the actual volume name.** The following example assumes the volume really is named `sms_rustfs_data`:

```bash
cd /opt/sms

BACKUP_DIR="$PWD/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

docker run --rm \
  -v sms_rustfs_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:3.20 \
  tar -czf "/backup/rustfs-$STAMP.tar.gz" -C /data .
```

Verify that the archive exists:

```bash
ls -lh "$BACKUP_DIR"
tar -tzf "$BACKUP_DIR/rustfs-$STAMP.tar.gz" | head
```

This is a **cold filesystem backup**, not a guarantee of compatibility across all RustFS versions. Test restoring it into a separate environment before relying on it for production migration.

If the application uses the `sms_uploads` volume, back that volume up separately using the same general cold-backup method, after confirming the actual volume name and stopping all writers.

### Step 4 — Resume staging

Once the backups are complete:

```bash
cd /opt/sms
docker compose up -d
docker compose ps
```

Verify the application and uploads before ending the maintenance window.

### Step 5 — Copy backups off the EC2 server

For example, from your own computer:

```bash
scp -i /path/to/key.pem \
  ubuntu@YOUR_EC2_PUBLIC_IP:/opt/sms/backups/postgres-YYYYMMDDTHHMMSSZ.dump \
  ./

scp -i /path/to/key.pem \
  ubuntu@YOUR_EC2_PUBLIC_IP:/opt/sms/backups/rustfs-YYYYMMDDTHHMMSSZ.tar.gz \
  ./
```

Replace the filenames with the actual generated filenames and use the correct SSH username.

For ongoing operations, automate off-server backups to encrypted storage with restricted access and a documented retention policy.

---

## 12. Restore PostgreSQL on Production

**Warning: Database restoration can overwrite production data.** Confirm the target server, database, backup file, and maintenance window before executing any restore command.

On the production server:

1. Install and configure Docker.
2. Deploy the production Compose configuration.
3. Create the production `.env` with production-specific credentials.
4. Start PostgreSQL and wait until it is healthy.
5. Copy the selected database backup to the production server.
6. Stop application writes before restoring.

Example:

```bash
cd /opt/sms
docker compose ps
```

Verify the correct PostgreSQL container and target database before continuing.

For a restore into an existing target database, the following example removes conflicting objects in the target database before restoring. Use it only after verifying the target and preserving any data that must not be lost:

```bash
BACKUP_FILE="/opt/sms/backups/postgres-YYYYMMDDTHHMMSSZ.dump"

test -s "$BACKUP_FILE"

docker compose stop backend

docker compose exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < "$BACKUP_FILE"
```

Check the command's exit status and inspect the output. Review extension requirements, database roles, ownership, and application migrations. `pg_dump` does not automatically recreate every server-level role or configuration.

After restoring:

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend
```

Verify application login, important database records, and any expected migrations. For a first-time production migration, restoring into a fresh, correctly configured database is often easier to reason about than merging with an existing live database.

---

## 13. Restore RustFS on Production

The RustFS archive must be restored to the correct RustFS data volume. **Do not extract it into a running RustFS data directory.**

Before restoration:

1. Confirm the production server and RustFS version.
2. Confirm the intended target volume.
3. Back up any existing production storage.
4. Stop RustFS and all application writers.
5. Prefer restoring into a new, empty volume or a disposable test environment first.

Example below assumes the target volume is named `sms_rustfs_data`, the archive is present in `/opt/sms/backups`, and the target volume is intentionally empty.

```bash
cd /opt/sms
docker compose stop backend rustfs
docker volume ls
```

Verify the actual target volume name. Then restore:

```bash
BACKUP_FILE="/opt/sms/backups/rustfs-YYYYMMDDTHHMMSSZ.tar.gz"

test -s "$BACKUP_FILE"

docker run --rm \
  -v sms_rustfs_data:/data \
  -v "$PWD/backups:/backup:ro" \
  alpine:3.20 \
  sh -ec 'tar -xzf "/backup/'"$(basename "$BACKUP_FILE")"'" -C /data'
```

This example is for an **empty target volume**. Do not use it blindly against a volume containing existing files. If the target volume is not empty, stop and plan a safe migration rather than mixing old and restored storage data.

Start RustFS:

```bash
docker compose up -d rustfs
docker compose logs --tail=100 rustfs
docker compose ps
```

Confirm that the expected buckets and objects are available through the S3 API and that the application can retrieve existing files.

RustFS's internal data layout and metadata can be version-sensitive. A cold volume archive should be treated as a recovery method that must be tested, not as a universal cross-version migration format.

---

## 14. Staging → Client Production Migration

This is a **migration**, not simply a new deployment. It moves real data and application configuration to another environment.

### Phase A — Prepare production

- Provision the client's VPS/EC2.
- Install Docker and Compose.
- Configure the firewall and SSH access.
- Configure a domain and HTTPS plan.
- Create a production `.env`.
- Use unique production database, JWT, SMTP, and RustFS credentials.
- Deploy and test the production Compose and Nginx configuration.
- Confirm the correct production image tags are available in GHCR.
- Ensure production storage has enough disk space.
- Confirm that backups are stored off-server.

Never copy staging secrets into production just to make deployment easier.

### Phase B — Freeze staging writes

At the agreed cutover time:

1. Put the application into maintenance mode, or otherwise prevent new writes and uploads.
2. Stop backend services and any other processes that write to the database or storage.
3. Confirm users can no longer submit changes.
4. Take the final database backup.
5. Take the final RustFS backup.
6. Back up the local uploads volume too, if it contains application data.
7. Copy the backups securely to production.

Do not take a database backup at one time and an unrelated storage backup hours later while uploads continue. That can leave database records pointing to missing objects, or storage objects with no corresponding records.

### Phase C — Restore production

1. Verify the backup filenames and integrity.
2. Restore PostgreSQL into the intended production database.
3. Restore RustFS data into the intended production volume.
4. Restore local uploads if required.
5. Confirm bucket names, access credentials, policies, and public URL configuration.
6. Start the backend and frontend.
7. Check logs and health status.

### Phase D — Validate before switching traffic

Use a checklist:

- [ ] Frontend opens through the production domain.
- [ ] Login and authentication work.
- [ ] Existing users and important records exist.
- [ ] Critical database records match staging.
- [ ] Existing uploaded files open.
- [ ] New uploads work.
- [ ] The application generates correct file URLs.
- [ ] Email works if required.
- [ ] No unexpected database migration errors appear.
- [ ] Logs do not contain repeated connection or permission errors.
- [ ] A new production backup has been taken.

### Phase E — Switch traffic

Once production validation passes:

1. Point the domain or traffic to production.
2. Confirm HTTPS and API requests.
3. Monitor logs and user reports.
4. Keep staging available for a planned rollback period.
5. Do not allow staging and production to accept independent writes if you expect to switch back without reconciling their data.

If production receives new writes, switching back to staging can lose those new records. A rollback plan must cover both application code and data.

---

## 15. Environment Separation

Maintain separate configuration and credentials for each environment.

| Setting | Staging | Production |
|---|---|---|
| Host | Staging EC2/VPS | Client VPS/EC2 |
| Database | Staging database | Production database |
| JWT secret | Staging-only secret | Production-only secret |
| Database password | Staging-only | Production-only |
| RustFS credentials | Staging-only | Production-only |
| Public URL/domain | Staging URL | Production domain |
| Image tag | Staging image/tag | Approved production tag |
| Backups | Staging backup destination | Production backup destination |

Do not point staging at the production database. Do not reuse JWT secrets between environments.

The image tags and branch names are examples from the current staging setup; define a separate, controlled production release process.

---

## 16. Troubleshooting

### A. GitHub Actions cannot connect through SSH

Check:

- `STG_EC2_HOST`
- `STG_EC2_SSH_USER`
- `STG_EC2_SSH_KEY`
- EC2 security-group port `22`
- The key corresponds to the selected SSH user
- The SSH user can access the deployment directory and Docker daemon

### B. GHCR login or image pull fails

Check:

- `STG_GHCR_USERNAME` is not blank.
- `STG_GHCR_READ_TOKEN` is valid and has package-read access.
- The token's account has access to the private image package.
- The image name and tag match the Compose file.
- The image package visibility and repository permissions are correct.

### C. Nginx fails to start

Inspect:

```bash
cd /opt/sms
docker compose logs --tail=100 nginx
docker compose run --rm --no-deps nginx nginx -t
```

Check that:

- The upstream service names are correct.
- `backend`, `frontend`, and `rustfs` are on the same Compose network.
- Nginx configuration syntax is valid.
- The storage route does not reference a nonexistent `minio` service.

### D. Backend cannot connect to PostgreSQL

Inspect:

```bash
docker compose logs --tail=100 postgres
docker compose logs --tail=100 backend
docker compose ps
```

Check database credentials, `DB_HOST=postgres`, port `5432`, and the PostgreSQL health status.

### E. Backend cannot connect to RustFS

Check:

```text
S3_ENDPOINT=http://rustfs:9000
```

Confirm that:

- RustFS is healthy.
- The backend and RustFS share a Docker network.
- The access key and secret match.
- The bucket exists.
- The bucket policy and object permissions match the application's requirements.

### F. Website returns 502 Bad Gateway

Check backend and frontend status, Nginx logs, upstream service names, and whether the relevant services are attached to the expected Compose network.

### G. Server rebooted and services are unavailable

Check the Rootless Docker daemon and its startup configuration, then inspect:

```bash
docker info
docker compose ps
```

Follow the documented systemd/user-service setup for Rootless Docker. Do not delete volumes as a reboot troubleshooting step.

---

## 17. Security Checklist

- [ ] SSH is restricted to trusted IPs where practical.
- [ ] Only intended public ports are open.
- [ ] PostgreSQL is not exposed publicly.
- [ ] RustFS API and console are not exposed publicly unless explicitly required and secured.
- [ ] `.env` is not committed to Git.
- [ ] Production secrets differ from staging secrets.
- [ ] GHCR tokens have only the permissions they need.
- [ ] Backups are stored off-server and protected.
- [ ] Restore procedures have been tested.
- [ ] Production uses HTTPS.
- [ ] Disk space and backup retention are monitored.
- [ ] Deployment never deletes persistent volumes.
- [ ] Database and object storage are backed up as a coordinated set.

---

## 18. Useful Commands

Run these from `/opt/sms`:

```bash
# Check services
docker compose ps

# Inspect logs
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 postgres
docker compose logs --tail=100 rustfs
docker compose logs --tail=100 nginx

# Validate Compose
docker compose config -q

# Validate Nginx
docker compose run --rm --no-deps nginx nginx -t

# Restart only the frontend
docker compose up -d --no-deps frontend

# Restart only the backend
docker compose up -d --no-deps backend

# Check disk usage
df -h

# List Docker volumes
docker volume ls
```

Do not use a destructive database restore command until the target server, database, and backup have been verified.

---

## 19. Project-Specific Items to Verify Before Calling This Runbook Complete

The following depend on the current source code and workflow files. Verify them in the repositories and update this document accordingly.

1. **Backend workflow:** Exact secret names, deployment path, environment-variable mapping, image tags, and Compose commands.
2. **Frontend workflow:** Exact branch trigger, package-read secret names, image name, and deployment commands.
3. **Compose source:** Confirm that `sms-backend/deploy/docker-compose.yml` matches the live Compose file in `/opt/sms`.
4. **Nginx source:** Confirm that `sms-backend/deploy/nginx.conf` matches the live Nginx configuration.
5. **Application environment:** List all required backend variables without publishing their secret values.
6. **Admin bootstrap:** Confirm the actual bootstrap command in the current backend repository. Do not assume an old `node dist/bootstrap-admin.js` command is still valid if the backend runtime or implementation has changed.
7. **RustFS backup/restore:** Perform a test restore into an isolated environment before relying on cold filesystem archives for production.
8. **Local uploads:** Confirm whether `/app/uploads` contains files that must be migrated, or whether all uploads are stored in RustFS.
9. **Public file URLs:** Confirm the actual URL format generated by the backend and how Nginx forwards storage requests.
10. **Production HTTPS:** Document the actual certificate and reverse-proxy setup used by the client's server.

---

## 20. Official References

- Docker Engine installation: https://docs.docker.com/engine/install/ubuntu/
- Docker Rootless mode: https://docs.docker.com/engine/security/rootless/
- Docker Compose: https://docs.docker.com/compose/
- GitHub Actions secrets: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
- GitHub Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- PostgreSQL `pg_dump`: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL `pg_restore`: https://www.postgresql.org/docs/current/app-pgrestore.html
- RustFS documentation: https://docs.rustfs.com/

---

## Final operational rule

**Staging deploy = code/image update. Production migration = code + database + object storage + configuration + validation.**

Keep those as two separate procedures. Before migrating real client data, complete at least one full backup-and-restore rehearsal on an isolated server. Update this README with the exact tested commands and actual workflow secret names once the repository files have been verified.
