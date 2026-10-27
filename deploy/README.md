# SMS Backend — EC2 Staging Deployment & Production Migration

This document explains how to set up the SMS application on a new Ubuntu EC2/VPS server, configure GitHub Actions CI/CD, manage persistent data, create backups, and migrate staging data to a client's production VPS.

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

## 1. Architecture

```text
Users
  |
  v
Public EC2/VPS :80
  |
  v
Nginx
  |-------------------|-------------------|
  v                   v                   v
Frontend :3000     Backend :8082      RustFS :9000
                       |                   |
                       v                   v
                  PostgreSQL          Object storage
                    :5432              sms-uploads
```

### Services

| Service | Purpose | Exposure |
|---|---|---|
| `nginx` | Reverse proxy | Public port 80 |
| `frontend` | Web application | Internal port 3000 |
| `backend` | API and application logic | Internal port 8082 |
| `postgres` | Application database | Internal port 5432 |
| `rustfs` | S3-compatible object storage | Internal port 9000 |
| RustFS console | Storage administration | Host localhost port 9001 |

### Persistent Docker volumes

The current setup uses these volume names:

- `sms_pgdata` — PostgreSQL database data
- `sms_rustfs_data` — RustFS object data and metadata
- `sms_uploads` — backend local uploads, if used by the application

Confirm actual volume names with `docker volume ls`. Compose project names and volume configuration can affect the final names.

**Never delete persistent volumes during a normal deployment.** Do not run `docker compose down -v` or `docker volume prune` as a routine troubleshooting or deployment command.

---

## 2. Prerequisites

- Ubuntu EC2 instance or compatible Ubuntu VPS
- SSH access
- GitHub access to `sms-backend` and `sms-frontend`
- Docker Engine and Docker Compose plugin
- Sufficient disk space for the application, database, object storage, and backups
- A domain name for production HTTPS, recommended

The current staging branch is:

```text
aphsmsp-stg
```

Verify the branch and image names against the current GitHub Actions workflows before setting up a new environment.

---

## 3. Create and Secure the Server

Create an Ubuntu EC2 instance and configure its security group.

| Port | Source | Purpose |
|---|---|---|
| 22 | Trusted administrator IP/CIDR | SSH |
| 80 | Public, if the site is public | HTTP |
| 443 | Public, after TLS configuration | HTTPS |

Do not expose PostgreSQL `5432`, backend `8082`, or RustFS API `9000` directly to the public Internet.

Keep the RustFS console restricted to localhost. Do not add a public security-group rule for port `9001`.

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

Old documentation also referenced `STG_MINIO_ROOT_USER` and `STG_MINIO_ROOT_PASSWORD`. These names are MinIO-specific and must not be assumed to match the current RustFS configuration.

Inspect `sms-backend/.github/workflows/deploy.yml` and use the exact names that the workflow reads. Make sure the workflow maps GitHub secrets to the environment variables expected by the current Compose file and backend.

---

## 7. Configure the Server `.env`

The current Compose configuration expects these variables:

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

These values are examples only. Generate unique credentials for each environment.

Keep all other application variables required by the backend, including JWT, SMTP, and any additional configuration referenced by the application.

Set restrictive permissions:

```bash
chmod 600 /opt/sms/.env
```

Do not print or paste secret values into GitHub issues, logs, or chat.

### Environment separation

Use separate credentials and configuration for staging and production.

| Setting | Staging | Production |
|---|---|---|
| Database | Staging database | Production database |
| Database password | Staging-only | Production-only |
| JWT secret | Staging-only | Production-only |
| RustFS credentials | Staging-only | Production-only |
| Public URL | Staging URL | Client domain |
| Image tag | Staging image | Approved release |

Never point staging at the production database.

---

## 8. First Deployment — Backend First

Deploy the backend first because the backend deployment workflow is expected to provide the shared Compose and Nginx configuration.

### Step 1 — Trigger backend deployment

1. Confirm the backend workflow is configured for `aphsmsp-stg`.
2. Configure the required GitHub Actions secrets.
3. Push or merge the intended backend commit into `aphsmsp-stg`.
4. Open GitHub Actions and inspect the workflow run.
5. Confirm the image build, GHCR push, SSH connection, and deployment steps succeed.

### Step 2 — Verify files on the server

```bash
cd /opt/sms
ls -la
```

Confirm `docker-compose.yml`, `nginx.conf`, and `.env` exist.

### Step 3 — Validate Compose

```bash
docker compose config -q
```

Resolve missing environment variables and configuration errors before starting the stack.

Avoid publishing the output of `docker compose config`, because resolved configuration may contain secrets.

### Step 4 — Start services

Avoid sharing the output of `docker compose config` publicly because resolved configuration can contain secrets.

### Step 4 — Start the stack

Only do this after verifying the Compose file and `.env`:

```bash
docker compose up -d
docker compose ps
```

Inspect logs if any service fails:

```bash
docker compose logs --tail=100 postgres
docker compose logs --tail=100 rustfs
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 nginx
```

### Step 5 — Deploy frontend

Once the shared stack exists, push or merge the intended frontend commit into `aphsmsp-stg`.

Confirm the frontend workflow builds and publishes its image and successfully updates the frontend service on the staging server.

---

## 9. Nginx and RustFS Configuration

The Compose service names in the current setup are:

```text
postgres
rustfs
backend
frontend
nginx
```

Nginx must use service names that actually exist on the shared Compose network.

### Storage route

The RustFS S3 API is available internally at:

```text
http://rustfs:9000
```

Example Nginx route:

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

This example strips the `/storage/` prefix when forwarding requests. Verify the backend's generated file URLs and the actual bucket/object key structure before relying on this route.

Do not use `http://minio:9000` when the Compose service is named `rustfs`.

### Test Nginx

Run from `/opt/sms`:

```bash
docker compose run --rm --no-deps nginx nginx -t
docker compose up -d --no-deps --force-recreate nginx
docker compose ps
docker compose logs --tail=50 nginx
```

Fix configuration errors before recreating Nginx.

---

## 10. Verify Staging

Test the public application using the EC2 IP or configured domain.

Run:

```bash
cd /opt/sms
docker compose ps
curl -I http://localhost/
```

Verify:

- [ ] Frontend loads.
- [ ] Login and authentication work.
- [ ] Backend API endpoints work.
- [ ] Database reads and writes work.
- [ ] File uploads work.
- [ ] Existing uploaded files can be opened.
- [ ] Generated file URLs are correct.
- [ ] Email works, if applicable.
- [ ] Data persists after restarting services.

## 9. Verify Staging

Run:

```bash
ssh -i /path/to/key.pem \
  -L 9001:127.0.0.1:9001 \
  ubuntu@YOUR_EC2_PUBLIC_IP
```

Then open:

```text
http://localhost:9001
```

Use the correct SSH username and key. Do not expose the console publicly for convenience.

---

## 11. Routine Deployment

When code is pushed to the configured staging branch:

1. GitHub Actions runs the configured checks.
2. The workflow builds and publishes the Docker image.
3. The deployment connects to the server.
4. The server pulls the image and recreates the relevant service.
5. Logs and service status are checked.

Useful commands:

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

### Deployment safety rules

- Never run `docker compose down -v` during routine deployment.
- Never delete database or RustFS volumes to fix an image problem.
- Do not change the production `.env` casually.
- Keep the deployment files in Git synchronized with the files deployed to `/opt/sms`.
- Record the deployed image tag or commit SHA for rollback.
- Confirm backup availability before risky database or storage changes.

---

## 12. Backup Strategy

The staging server contains application data. Back up both the database and uploaded objects.

Required backup items:

1. PostgreSQL database.
2. RustFS data and metadata.
3. Local uploads in `sms_uploads`, if the application uses that volume.
4. Required configuration, stored securely.
5. Deployed image tags and commit SHAs.

Store backups off the server and protect them with appropriate access controls and encryption.

### Consistency requirement

A database backup and object-storage backup must represent a compatible point in time. If database rows refer to files that are missing from storage, the application can become inconsistent.

Before the final migration backup:

1. Stop new application writes and uploads.
2. Stop all other writers.
3. Back up PostgreSQL.
4. Back up RustFS.
5. Back up local uploads if required.
6. Copy the backups off-server.
7. Resume staging only after verification.

---

## 13. PostgreSQL Backup

The current project includes `pg-backup.sh` and `pg-restore.sh`. Verify those scripts against the current Compose configuration before relying on them.

PostgreSQL custom-format backup can be created with `pg_dump -Fc`.

Example command from `/opt/sms`:

```bash
mkdir -p backups
chmod 700 backups

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

docker compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/postgres-$STAMP.dump"

test -s "backups/postgres-$STAMP.dump"
```

A non-empty file is only an initial check. For important data, verify the dump and perform a test restore in a separate database or environment.

Official references:

- https://www.postgresql.org/docs/current/app-pgdump.html
- https://www.postgresql.org/docs/current/app-pgrestore.html

---

## 14. RustFS Backup

The current RustFS container is expected to be named:

```text
sms-rustfs
```

The Compose service is:

```text
rustfs
```

The data directory inside the container is:

```text
/data
```

The project script should be named:

```text
rustfs-backup.sh
```

The backup archive naming convention is:

```text
rustfs-YYYYMMDDTHHMMSSZ.tar.gz
```

Example:

```text
backups/rustfs-20261027T120000Z.tar.gz
```

### Important

A filesystem-level backup of RustFS `/data` is different from copying objects through the S3 API. It includes RustFS's internal data and metadata.

A cold filesystem backup should be performed only after RustFS and other storage writers have stopped. Verify the actual volume/container name and ensure the archive can be read.

Do not assume an archive is restorable across every RustFS version. Test restoration in an isolated environment first.

If the application uses local backend uploads, back up that volume separately.

---

## 15. RustFS Restore

The restore script is named:

```text
rustfs-restore.sh
```

Example invocation:

```bash
cd /opt/sms
chmod +x rustfs-restore.sh
./rustfs-restore.sh backups/rustfs-20261027T120000Z.tar.gz
```

Use the actual archive filename.

### Destructive operation warning

The restore process replaces the contents of the target RustFS data directory. It can destroy existing storage data.

Before restoring:

- [ ] Confirm the target server.
- [ ] Confirm the archive is correct and readable.
- [ ] Back up the existing target storage if it contains important data.
- [ ] Stop the backend and all other writers.
- [ ] Verify the RustFS container and volume names.
- [ ] Prefer testing on an empty, separate volume first.

The current restore script uses `--volumes-from sms-rustfs` to reuse the container's `/data` mount. The stopped container must still exist. Do not remove it during the restore process.

After restoring, inspect logs and verify bucket contents and application file access.

```bash
docker compose ps
docker compose logs --tail=100 rustfs
docker compose logs --tail=100 backend
```

Do not run a destructive restore against production until the procedure has been rehearsed successfully.

---

## 16. RustFS Bucket Policy

The policy file is named:

```text
rustfs-policy.json
```

The existing policy allows anonymous users to read objects in the `sms-uploads` bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["*"]
      },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::sms-uploads/*"]
    }
  ]
}
```

This makes matching objects publicly readable if the policy is applied successfully.

Use this only if public access is an intentional application requirement. Do not use an anonymous read policy for private or sensitive uploads.

The bucket policy must be applied using a RustFS-compatible S3 administration method supported by the deployed version. Verify that method before documenting or running a policy command.

The bucket name in the policy must match the configured bucket:

```text
sms-uploads
```

---

## 17. Copy Backups to the Client VPS

Copy the database and RustFS backups securely to the production server.

Example from your local computer:

```bash
scp -i /path/to/key.pem \
  ubuntu@YOUR_EC2_PUBLIC_IP:/opt/sms/backups/postgres-YYYYMMDDTHHMMSSZ.dump \
  ./

scp -i /path/to/key.pem \
  ubuntu@YOUR_EC2_PUBLIC_IP:/opt/sms/backups/rustfs-YYYYMMDDTHHMMSSZ.tar.gz \
  ./
```

Replace the example filenames with the actual backup names. Use the correct SSH username and key.

Then copy the files to the production server:

```bash
scp -i /path/to/client-key.pem \
  postgres-YYYYMMDDTHHMMSSZ.dump \
  CLIENT_SSH_USER@CLIENT_VPS_HOST:/secure/backup/path/

scp -i /path/to/client-key.pem \
  rustfs-YYYYMMDDTHHMMSSZ.tar.gz \
  CLIENT_SSH_USER@CLIENT_VPS_HOST:/secure/backup/path/
```

Restrict access to the backup directory. Do not upload backups to a public web directory.

For ongoing backups, use encrypted off-server storage and define a retention policy.

---

## 18. Staging to Production Migration

Treat this as a controlled migration, not just a new deployment.

### Phase A — Prepare production

1. Provision the client's Ubuntu VPS or EC2.
2. Install Docker and Compose.
3. Configure SSH and firewall rules.
4. Configure production `.env` with production-only credentials.
5. Deploy the verified Compose and Nginx configuration.
6. Confirm production can pull the required GHCR images.
7. Prepare production database and RustFS volumes.
8. Ensure enough disk space is available.
9. Plan DNS and HTTPS.
10. Confirm a recovery backup exists.

### Phase B — Freeze staging writes

At the agreed cutover time:

1. Put staging into maintenance mode or block new writes.
2. Stop the backend and other database/storage writers.
3. Take the final PostgreSQL backup.
4. Take the final RustFS backup.
5. Back up local uploads if needed.
6. Copy backups to production.
7. Verify archive integrity.

Do not let users continue uploading files during a backup intended to represent the final migration state.

### Phase C — Restore production

1. Verify the target server and target database.
2. Restore PostgreSQL.
3. Restore RustFS into the intended storage volume.
4. Restore local uploads if needed.
5. Confirm the bucket and policy configuration.
6. Set the correct production storage URL configuration.
7. Start the services.
8. Inspect logs and verify application connectivity.

Never restore over existing production data without an approved plan and a separate backup of that data.

### Phase D — Validate production

- [ ] Frontend loads through the production domain.
- [ ] Login and authentication work.
- [ ] Expected users and database records exist.
- [ ] Important records match the final staging backup.
- [ ] Existing uploaded files open.
- [ ] New uploads work.
- [ ] Generated object URLs are correct.
- [ ] Email works, if required.
- [ ] No repeated errors appear in application logs.
- [ ] A new production backup is created.

### Phase E — Switch traffic

After validation:

1. Point the domain or traffic to production.
2. Verify HTTPS and API requests.
3. Monitor logs and user reports.
4. Keep staging available for a planned rollback period.
5. Prevent staging and production from accepting separate writes if you expect to switch back without reconciling data.

Once production receives new writes, switching back to staging can lose those records. The rollback plan must account for both application code and data.

---

## 19. Troubleshooting

### GitHub Actions SSH failure

Check:

- `STG_EC2_HOST`
- `STG_EC2_SSH_USER`
- `STG_EC2_SSH_KEY`
- Security-group port 22
- SSH username and private key
- Deployment-directory and Docker permissions

### GHCR image pull failure

Check:

- `STG_GHCR_USERNAME` is set.
- `STG_GHCR_READ_TOKEN` has package-read permission.
- The token owner can access the private package.
- Image name and tag match Compose.
- The workflow logs identify the failing step.

### Nginx startup failure

```bash
docker compose logs --tail=100 nginx
docker compose run --rm --no-deps nginx nginx -t
```

Check upstream names, Compose network membership, and configuration syntax. Use `rustfs` rather than `minio` when referring to the current storage service.

### PostgreSQL connection failure

```bash
docker compose logs --tail=100 postgres
docker compose logs --tail=100 backend
docker compose ps
```

Check the database credentials, `DB_HOST=postgres`, port `5432`, and database health.

### RustFS connection failure

Verify:

```text
S3_ENDPOINT=http://rustfs:9000
```

Also check the credentials, bucket name, service health, and storage permissions.

### Website returns 502

Inspect Nginx logs and verify the backend/frontend services are running and reachable over the Compose network.

### Disk space problem

```bash
df -h
docker system df
docker volume ls
```

Do not delete persistent volumes to reclaim disk space. Identify old images and backup retention needs first, and remove only items known to be safe.

---

## 20. Final Checklist

### Before staging goes live

- [ ] Docker and Rootless Docker startup configured.
- [ ] GitHub secrets set.
- [ ] Backend deployed first.
- [ ] Frontend deployed successfully.
- [ ] Compose and Nginx configuration validated.
- [ ] Database and uploads tested.
- [ ] Storage endpoint and URL generation tested.
- [ ] Backups stored outside the EC2 instance.

### Before production migration

- [ ] Production credentials are separate.
- [ ] Production deployment works with the approved images.
- [ ] Staging writes are frozen.
- [ ] PostgreSQL backup verified.
- [ ] RustFS backup verified.
- [ ] Local uploads backed up if needed.
- [ ] Restore tested on an isolated environment.
- [ ] Production database and storage restored.
- [ ] Application validated before traffic switch.
- [ ] Rollback plan documented.
- [ ] Production backup taken after migration.

---

## Official Documentation

- Docker Engine: https://docs.docker.com/engine/install/ubuntu/
- Docker Rootless mode: https://docs.docker.com/engine/security/rootless/
- Docker Compose: https://docs.docker.com/compose/
- GitHub Actions secrets: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
- GitHub Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- PostgreSQL backup: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL restore: https://www.postgresql.org/docs/current/app-pgrestore.html
- RustFS documentation: https://docs.rustfs.com/

---

## Operational Rule

**Staging deployment updates application code. Production migration transfers application code, database data, object storage, configuration, and validated backups.**

Never consider the migration complete until the restored database and uploaded objects have been tested together on production.

