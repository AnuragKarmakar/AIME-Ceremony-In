# AIME Ceremony-In — AWS Deployment

Single-EC2 deployment. **Live URL: http://3.217.19.123/** (plain HTTP, no domain/TLS yet).

## 1. Architecture

```
Internet
  │
  ├── :80  ──► Caddy ──┬─ /design/*  served directly from the build's public/ folder (images, videos)
  │                    └─ everything else ──► Frontend (Node/Nitro)  127.0.0.1:3000
  │                         │  server-side fetches only
  │                         ├──► Wagtail CMS (gunicorn)   127.0.0.1:8000 ──► RDS Postgres (private)
  │                         ├──► Airtable API (HTTPS) — submission storage, called directly
  │                         └──► Gemini API (HTTPS) — reflection evaluation
  │
  └── :8000 ─► Wagtail CMS directly (admin UI at /admin/)
```

The frontend writes completed submissions **directly to Airtable** from a TanStack Start server function ([submit.functions.ts](src/lib/submit.functions.ts)) — the Airtable token never reaches the browser. This replaced the standalone `aime-mdlwr` .NET middleware, which is **stopped and disabled** on the box (not uninstalled — see §3). All other service-to-service calls (frontend → CMS) are still loopback and server-side, so no CORS/public exposure is needed there either. Only ports 80 (site) and 8000 (CMS admin) are meant for the browser.

| Service | Repo / source | Runtime | Port | systemd unit | Run as | Status |
|---|---|---|---|---|---|---|
| Frontend | `AIME-Ceremony-In` | Node (Nitro `node-server` preset) | 3000 (loopback) | `aime-ceremony-in` | `aimefrontend` | enabled, active |
| CMS | `aime-ceremony-cms` | Python 3.14 venv, Django 5.2 + Wagtail 7.4, gunicorn (2 workers) | 8000 (public) | `aime-ceremony-cms` | `aimecms` | enabled, active |
| Middleware | `aime-mdlwr` | Self-contained .NET, installed via its own RPM | 5110 (loopback) | `aime-mdlwr` (shipped by the RPM) | `aime` | **stopped, disabled** — unused since submissions moved to direct Airtable writes; RPM still installed for a quick rollback |
| Reverse proxy | — | Caddy | 80 | `caddy` | caddy | enabled, active |

## 2. AWS resources (account 723414444862, us-east-1)

| Resource | Details |
|---|---|
| EC2 | `i-0d406909c59087ea8`, `t3.small`, Fedora 44, AZ `us-east-1d`, VPC `vpc-04c73cf32169089d8` |
| Elastic IP | `3.217.19.123` (stable across stop/start) |
| EC2 security group | `sg-05259cf83db5facb5` (`aime-mdlwr-ec2-sg`): inbound 80, 443, 8000 from anywhere; 22 from a single admin IP only |
| IAM instance profile | `aime-mdlwr-ec2-ssm-profile` — `AmazonSSMManagedInstanceCore` + scoped read of the Secrets Manager secrets + S3 access to the `ceremony-in` bucket |
| RDS | `aime-ceremony-cms-db`, PostgreSQL 17.11, `db.t4g.micro`, encrypted, **not publicly accessible**; SG `sg-04dddd3976cea2146` allows 5432 only from the EC2 SG |
| S3 | bucket `ceremony-in`: `cms-media/` (Wagtail uploads via django-storages), `deploy-src/` (source tarballs/scripts used to ship code to the box) |
| Secrets Manager | Gemini API key (`aime/gemini-api-key`), Airtable token (`aime/airtable-token` — **stale, see §5**), plus the CMS `SECRET_KEY` / `DATABASE_URL` values |
| SSM | Used for all remote administration — no SSH key needed (see §6) |
| Airtable | Base `app2XwRGGLogVCYNG`, table `tblMBYwYSE42x0rN1` — see §7 for the required schema |

App Runner was tried first and abandoned; no App Runner services remain. Leftovers that can be deleted if unused: the App Runner GitHub connection `aime-github-connection`, the VPC connector `aime-cms-vpc-connector`, and its SG `sg-08f81c759d110cf2b`.

## 3. On-box layout

| Path | Purpose |
|---|---|
| `/opt/aime-ceremony-in` | Frontend source + `.output/` build |
| `/opt/aime-ceremony-cms` | CMS source, `venv/`, collected static |
| `/opt/aime-mdlwr` | Middleware source (RPM built from here; app installed to `/usr/lib/aime-mdlwr`; service stopped/disabled) |
| `/etc/aime-ceremony-in/env` (600) | `NODE_ENV`, `PORT=3000`, `WAGTAIL_API_URL=http://127.0.0.1:8000`, `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE`, `GEMINI_API_KEY`, and the Golden Ticket check's `AIRTABLE_TICKETS_TOKEN`, `AIRTABLE_TICKETS_BASE_ID`, `AIRTABLE_TICKETS_TICKET_TABLE`, `AIRTABLE_TICKETS_APPLICANT_TABLE` |
| `/etc/aime-ceremony-cms/env` (600) | `DJANGO_SETTINGS_MODULE=ceremony_cms.settings.production`, `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS=3.217.19.123,127.0.0.1,localhost`, `CSRF_TRUSTED_ORIGINS`, `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME`, `DISABLE_HTTPS_REDIRECT=1`, and for the Admin Review section `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE` (same values as the frontend's) |
| `/etc/aime-mdlwr/aime-mdlwr.env` (640 root:aime) | Unused while the service is disabled; left in place in case of rollback |
| `/etc/caddy/Caddyfile` | `/design/*` is served by Caddy's `file_server` from `/opt/aime-ceremony-in/.output/public`; everything else is `reverse_proxy 127.0.0.1:3000`. Timestamped backups sit next to it (`Caddyfile.bak-*`) |
| `/etc/systemd/system/aime-ceremony-{in,cms}.service` | App units (`Restart=always`) |
| `/etc/systemd/system/aime-ceremony-in.service.d/order.conf` | Frontend `After=`/`Wants=` CMS |
| `/etc/systemd/system/caddy.service.d/order.conf` | Caddy `After=`/`Wants=` frontend |

Secrets are written to these env files at setup/update time; they are never committed to git.

## 4. Startup order

All units that should run are `enabled`, so they come back after a reboot (`aime-mdlwr` is deliberately disabled). Ordering (via systemd drop-ins):

1. `aime-ceremony-cms` — independent
2. `aime-ceremony-in` — `After=` + `Wants=aime-ceremony-cms.service`
3. `caddy` — `After=` + `Wants=aime-ceremony-in.service`

`Wants=` (not `Requires=`) is deliberate: the frontend has hardcoded fallbacks for visa paths/agreements, so a CMS outage degrades content but shouldn't take the site down. Likewise, an Airtable outage degrades to a failed-but-logged submission rather than blocking the applicant (see §5).

## 5. Configuration notes and gotchas

- **`ALLOWED_HOSTS` must include `127.0.0.1`.** The frontend calls the CMS at `http://127.0.0.1:8000`; without it Django returns HTTP 400 (`DisallowedHost`) and the frontend silently falls back to hardcoded content. This was the "CMS not working" bug.
- **Airtable field names must match exactly.** The table needs the columns listed in §7, spelled and cased exactly as listed. A missing or renamed column fails the whole submission with `422 UNKNOWN_FIELD_NAME` — this happened twice while migrating off the middleware, once for missing base access on the token and once for a table with no matching columns. The app also writes an `Agreements Accepted` column, so that one must exist too (see §7).
- **A submission failure never blocks the applicant, and never loses their answers.** `storeSubmission` in `src/routes/index.tsx` still lets the wizard continue to River Run if the Airtable write throws, but the applicant's saved progress is kept (it is only deleted once Airtable has the record) and River Run shows a "Try again" notice. The error is also logged; check `journalctl -u aime-ceremony-in` if submissions seem to be going missing.
- **Incomplete progress never reaches Airtable.** In-progress answers live only in the applicant's browser (`localStorage`). Airtable gets one record when the applicant finishes Agreements, or when a blocking verdict ends their journey. The table's `Status` and `Last Step` columns are left over from an earlier design and nothing writes them.
- **Gemini 401 "ACCESS_TOKEN_TYPE_UNSUPPORTED" means the key is invalid.** The app calls Gemini's OpenAI-compatible endpoint with `Authorization: Bearer <key>`; new-style `AQ.` keys work that way. If the site shows `AI gateway error 401`, replace `GEMINI_API_KEY` in `/etc/aime-ceremony-in/env` and `systemctl restart aime-ceremony-in` (env files are only read at start). Test a key from the box with a one-line `curl` and look at the HTTP status only; never print the key.
- **Videos need HTTP Range support, so Caddy serves `/design/*`.** The Node app's static handler ignores `Range` requests, and Safari (iPhone and Mac) will not play the quiz's transition videos without a `206 Partial Content` answer. Check with `curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-1023' http://3.217.19.123/design/transitions/imagine-bloom.mp4` (expect 206).
- **Never run a deploy script with `set -x` while it loads an env file.** Tracing prints every assignment, and an early CMS deploy printed the production `DATABASE_URL` into the SSM command output (visible to anyone with SSM read access for about 30 days). The scripts now switch tracing off around that step.
- **SSM command history keeps whatever you pass inline.** Secrets passed in `send-command` parameters (the documented way, see §6) stay in SSM history; rotate them if the account has other users.
- **The Golden Ticket check needs the four `AIRTABLE_TICKETS_*` variables.** If any is missing, tickets are simply not honoured (everyone is reviewed as a normal applicant).
- **Gemini 503 has a skip path.** If Gemini returns 503 (temporarily overloaded), the story screen offers "Skip and continue" instead of stranding the applicant — see `evaluate.functions.ts` / `index.tsx`. This is client-visible behavior, not a deploy concern, but worth knowing when diagnosing "why did this submission get an untouched verdict."
- **The `aime/airtable-token` secret in Secrets Manager is stale.** Session policy blocked writing to Secrets Manager during the Airtable migration, so the current working token was set directly in `/etc/aime-ceremony-in/env` and never mirrored back to the secret. If you rebuild this box from Secrets Manager alone, you'll get the old (revoked/never-updated) token. Update the secret manually before relying on it again.
- **`DISABLE_HTTPS_REDIRECT=1`** turns off `SECURE_SSL_REDIRECT`, secure cookies, and HSTS in `ceremony_cms/settings/production.py`. Remove it once real TLS is in place.
- **No HTTPS.** Let's Encrypt rejects `*.amazonaws.com` hostnames, and there is no domain. Browsers show "Not Secure"; the CMS admin login and session cookies travel unencrypted. Getting a domain, pointing it at `3.217.19.123`, changing the Caddyfile site address to the domain, and dropping `DISABLE_HTTPS_REDIRECT` gives automatic HTTPS.
- **SELinux (only relevant if the middleware is ever reactivated):** the RPM ships no policy, so its process was denied outbound HTTPS to Airtable. A minimal `audit2allow`-generated module (`aime-mdlwr-net`) is loaded. A rebuilt instance needs it again.
- **RDS access** is by security-group reference (EC2 SG → RDS SG on 5432). A replacement instance must be added to the RDS SG.
- **Django pinned to 5.2** (`Django>=5.2,<5.3`); Wagtail 7.4 supports it. Python 3.14 on the box.
- The frontend is built with Nitro's `node-server` preset (`vite.config.ts`), not the default Cloudflare preset.
- **npm cache ownership:** if `npm ci` run as `aimefrontend` fails with `EACCES` on `/opt/aime-ceremony-in/.npm`, something (usually a manual root SSM command) left that directory root-owned. Fix with `chown -R aimefrontend:aimefrontend /opt/aime-ceremony-in` before rerunning `npm ci` — always `chown` right after extracting a new tarball (which runs as root) and before running anything as `aimefrontend`.
- The stray `JM X AIME NATION/` folder in the frontend repo is untracked and must never be committed or shipped in a deploy tarball (use `--exclude`).

## 6. Operating the box

There is no SSH key dependency. Use SSM (IAM permissions required locally):

```bash
aws ssm send-command --instance-ids i-0d406909c59087ea8 \
  --document-name AWS-RunShellScript --region us-east-1 \
  --parameters 'commands=["systemctl is-active aime-ceremony-in aime-ceremony-cms caddy"]'
aws ssm get-command-invocation --command-id <id> --instance-id i-0d406909c59087ea8 --region us-east-1
```

Tips on Windows/Git Bash: prefix with `MSYS_NO_PATHCONV=1` if arguments start with `/`; set `PYTHONUTF8=1` to avoid console-encoding crashes; for multi-line scripts, upload to `s3://ceremony-in/deploy-src/` and download+run on the instance rather than inlining heredocs (an inline `\n`-escaped heredoc silently fails to terminate and swallows the following commands as file content — hit this once mid-migration). **Never write a secret value into a script that gets uploaded to S3** — pass secrets as inline exported env vars in the SSM command itself instead; a script containing a raw token gets blocked by this session's own credential-leakage guard.

Useful commands on the instance:

```bash
systemctl status aime-ceremony-in aime-ceremony-cms caddy
journalctl -u aime-ceremony-in -n 100 --no-pager     # check for Airtable submission errors here
journalctl -u aime-ceremony-cms -n 100 --no-pager
curl -sI http://127.0.0.1:8000/admin/          # CMS -> 302 to login
curl -sI http://127.0.0.1:3000/                # frontend -> 200
```

### Deploying an update

Code is shipped as tarballs via S3, not git-cloned on the box. Three scripts live in `s3://ceremony-in/deploy-src/` and are run over SSM; none contains a secret.

| Script | Does |
|---|---|
| `deploy-frontend.sh <tarball>` | Backs up `src/`, `public/` and the current build to `/var/tmp/aime-ceremony-in-backup-<time>.tgz`, replaces the sources, `npm ci`, stops the service, builds, starts it, checks ports 3000 and 80. Restores the backup automatically if any step fails. |
| `deploy-cms.sh <tarball>` | Backs up the CMS code to `/var/tmp/aime-ceremony-cms-backup-<time>.tgz`, then `pip install`, `migrate`, `create_initial_revisions`, `collectstatic`, restart, endpoint checks. Restores the code on failure but **cannot roll the database back**, so take an RDS snapshot first. |
| `caddy-media.sh` | One-off: switches Caddy to serve `/design/*` itself (see §5). Backs up the Caddyfile and restores it on any failed check. |

Windows/Git Bash: `export MSYS_NO_PATHCONV=1 PYTHONUTF8=1` first. With path conversion off, native `aws.exe` and `git.exe` cannot read `/c/...` paths, so use relative paths (for example `../file.tar.gz`) or `cygpath -w`.

**Frontend**, from the frontend repo on a committed `main`:

1. Package exactly what is committed (so `.env`, `node_modules` and `JM X AIME NATION/` cannot be included) and upload it under a new name, keeping older tarballs for rollback:

```bash
git archive --format=tar.gz -o ../aime-ceremony-in-main-NEW.tar.gz HEAD
```
```bash
aws s3 cp ../aime-ceremony-in-main-NEW.tar.gz s3://ceremony-in/deploy-src/ --region us-east-1
```

2. Run the script (prints a command ID), then read the result and look for `DEPLOY OK`:

```bash
aws ssm send-command --instance-ids i-0d406909c59087ea8 --region us-east-1 --document-name AWS-RunShellScript --timeout-seconds 900 --parameters 'commands=["aws s3 cp s3://ceremony-in/deploy-src/deploy-frontend.sh /tmp/d.sh --region us-east-1 >/dev/null && bash /tmp/d.sh aime-ceremony-in-main-NEW.tar.gz 2>&1 | tail -14"]' --query Command.CommandId --output text
```
```bash
aws ssm get-command-invocation --command-id <ID> --instance-id i-0d406909c59087ea8 --region us-east-1 --query "[Status,StandardOutputContent]" --output text
```

3. If env vars changed, update `/etc/aime-ceremony-in/env` first and make sure the service is restarted (the script restarts it). See §5 on passing secrets.

**CMS**, from the CMS repo: package with `git archive` the same way (a new tarball name each time), upload it, **create an RDS snapshot and wait for it to be `available`**, then run `deploy-cms.sh <tarball>` exactly as above:

```bash
aws rds create-db-snapshot --db-instance-identifier aime-ceremony-cms-db --db-snapshot-identifier cms-pre-deploy-NEW --region us-east-1
```

To run `manage.py` by hand on the box: `cd /opt/aime-ceremony-cms && set -a && . /etc/aime-ceremony-cms/env && set +a && sudo -E -u aimecms venv/bin/python manage.py <command>`.

**Rollback.** Frontend: run the same command with an older tarball name (for example `aime-ceremony-in-main-3b54273.tar.gz`), or restore the `/var/tmp` backup. CMS code: restore its `/var/tmp` backup; the database is restored from the snapshot.

**Middleware** is not part of normal deploys anymore (disabled). To reactivate: rebuild the RPM with `TMPDIR=/var/tmp ./packaging/build-rpm.sh <version-matching-spec>`, `dnf install` it, reload the SELinux module (§5), then `systemctl enable --now aime-mdlwr`.

**Verify** with the curl checks above and by loading the live site. A real submission through the site should return a record `id` (not an `error`) in the `submitCeremony` network response; it writes a real row to Airtable, so use an obviously fake applicant and delete the row afterwards.

## 7. Airtable schema

Table `tblMBYwYSE42x0rN1` in base `app2XwRGGLogVCYNG` must have these 30 columns, named exactly as listed (case- and space-sensitive — Airtable rejects anything it doesn't recognize with `422 UNKNOWN_FIELD_NAME`):

```
Name                  First Name            Last Name
Email                 Mother Tongue         City
Country               Story                 Path Id
Path                  Golden Ticket         Has Golden Ticket
Submitted At          Being 1 Name          Being 1 Note
Being 2 Name          Being 2 Note          Being 3 Name
Being 3 Note          Being 4 Name          Being 4 Note
Quiz Completed        Quiz Answers          Quiz Answer Count
Verdict               Headline              Reason
Can Proceed           Admin Review          Agreements Accepted
```

Only these need a specific field type — everything else can be Single line text / Long text:

| Column | Type |
|---|---|
| `Has Golden Ticket`, `Quiz Completed`, `Can Proceed`, `Admin Review` | Checkbox |
| `Quiz Answer Count` | Number (integer) |
| `Agreements Accepted` | Long text (holds JSON: per agreement, the revision shown, a sha256 of the text and the statement ids ticked) |
| `Submitted At` | Date, with time included (or Single line text if you'd rather skip Airtable's date parsing) |

`Name` is the table's primary field. `Path Id`, `Path`, and `Verdict` can be Single select — the app sends `typecast: true`, so Airtable auto-adds any option it hasn't seen yet.

The CMS's Admin Review section writes four more columns, which must exist: `Review Status` (single select), `Reviewed By` (single line text), `Reviewed At` (date and time) and `Review Note` (long text). The frontend never writes them.

The table also contains `Status` and `Last Step` columns from an earlier design; the app never writes them and they can be left alone or deleted.

The mapping lives in [submit.functions.ts](src/lib/submit.functions.ts) (`toAirtableFields`) — that function is the single source of truth if this list and the code ever disagree.

## 8. CMS admin

- URL: `http://3.217.19.123:8000/admin/`, superuser `admin`. The initial password was generated and shared in chat — **change it on first login** and prefer a personal account.
- Visa Paths and Agreements are edited here (models in `ceremony_content`) and are populated with real content already.
- **Editorial workflow.** Both are Wagtail snippets with drafts, revision history, locking and the "Moderators approval" workflow. The **Editors** group can draft, edit and submit for moderation; **Moderators** can also publish and unlock. Add people to these groups under Settings → Groups. Each applicant's stored consent records the published revision id they were shown, so published changes are traceable.
- Deploying the workflow applied migrations `0011` and `0012` and ran `create_initial_revisions` (safe to repeat). An RDS snapshot, `cms-pre-editorial-20261009`, was taken first and can be deleted once it is no longer needed.

## 9. Verified behavior

- **Last real end-to-end pass on the live site** (before the redesign): Welcome → Path → Identity → Story → real Gemini evaluation → Relational Check-in → real Agreement content from the CMS → River Run, with the `submitCeremony` response returning a real Airtable record id.
- **2026-10-20, redesign and save/resume**, exercised in a browser against the dev server with Airtable and Gemini calls stubbed (so no test rows were written): blocked verdict then revise and pass; all 61 quiz questions across 10 screens and 5 milestone screens; agreements; a failed submission keeping the saved answers and showing "Try again"; a successful retry clearing them; the Welcome-back prompt with Continue and Start fresh; no horizontal overflow at 375px. Not yet repeated with a real submission since the redesign.
- Production checks after that deploy: both services and Caddy active, `/design/*` assets return 200, a `Range` request on a video returns 206, the CMS API returns 200, and no warnings in the service logs.

## 10. Deployed state (as of 2026-10-20)

| Component | Version |
|---|---|
| Frontend | `main` at `b43d406` (redesign, save/resume, Golden Ticket validation, quiz transition videos). Previous: `3b54273`. |
| CMS | `main` at `cd9dc22` (editorial workflow, migrations through `0012`) |
| Caddy | `/design/*` served directly (see §5) |

## 11. Known limitations / suggested next steps

- Add a domain + HTTPS (highest-value follow-up); then close public port 8000 by proxying the CMS admin through Caddy on 443.
- Update the `aime/airtable-token` Secrets Manager secret to match what's actually in `/etc/aime-ceremony-in/env` (see §5) so a future rebuild doesn't silently regress to a dead token. The Gemini and Golden Ticket values were also set directly in the env file, so treat the file, not Secrets Manager, as the source of truth until the secrets are reconciled.
- Saved progress is per browser: an applicant who switches device starts again. A cross-device resume would need server-side storage and an identity check, which the app deliberately does not have.
- The RDS instance is single-AZ with default backups; no CloudWatch alarms or log shipping configured.
- Deploys are scripted but still manual, and the three scripts live only in S3. Keeping copies in the repo (for example a `scripts/` folder) would put them under review and version control.
- Branches `deploy/aws-app-runner` in both repos hold the abandoned App Runner history (`apprunner.yaml`, S3 storage and Django-version changes). The S3-storage, Django 5.2, and `DISABLE_HTTPS_REDIRECT` changes are still needed by the EC2 deployment and should be merged to `main`.
- The `aime-mdlwr` service and its RPM can be fully removed (`dnf remove`, delete the SELinux module, delete `/opt/aime-mdlwr`) once you're confident it won't be needed as a rollback path.
