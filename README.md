# Attendance Management System

A small, fast, mobile-friendly web application for recording and reviewing daily
staff attendance. An employee enters their computer code, sees their own monthly
calendar, marks each day Present or Absent (with an optional reason), and can
download their record as Excel, CSV or PDF. Administrators sign in separately to
manage staff, import the existing employee spreadsheet, correct attendance and
export reports.

> **Branding notice**
> `public/logo.svg` is a **neutral placeholder**. It is not the emblem of any
> government body and must not be presented as one. Replace that single file
> with your organisation's authorised logo and every screen updates. This is an
> internal tool; it is not an official government website.

---

## Contents

1. [Tech stack](#1-tech-stack)
2. [Project structure](#2-project-structure)
3. [Supabase setup](#3-supabase-setup)
4. [Environment variables](#4-environment-variables)
5. [Running locally](#5-running-locally)
6. [Creating an administrator account](#6-creating-an-administrator-account)
7. [Importing your existing employee spreadsheet](#7-importing-your-existing-employee-spreadsheet)
8. [Deploying to GitHub and Vercel](#8-deploying-to-github-and-vercel)
9. [Security model — and its limits](#9-security-model--and-its-limits)
10. [Configuration switches](#10-configuration-switches)
11. [Dates and the Nepal timezone](#11-dates-and-the-nepal-timezone)
12. [Tests](#12-tests)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase PostgreSQL |
| File storage | Supabase Storage (`employee-photos` bucket) |
| Admin auth | Supabase Auth (email + password) |
| Excel | ExcelJS (import and export) |
| PDF | jsPDF + jspdf-autotable |
| Validation | Zod |
| Icons | Lucide React |
| Notifications | Sonner |
| Hosting | Vercel (recommended) |

---

## 2. Project structure

```text
app/
  layout.tsx                        Root layout, metadata, toaster
  page.tsx                          Landing page — computer code lookup
  robots.ts                         Blocks all crawlers (internal tool)
  not-found.tsx
  employee/[computerCode]/page.tsx  Employee dashboard (session-guarded)
  admin/
    login/page.tsx                  Administrator sign in
    (protected)/                    Route group: everything below is gated
      layout.tsx                    Admin gate + shell
      page.tsx                      Dashboard tiles
      employees/page.tsx            Employee management
      employees/import/page.tsx     Excel import wizard
      attendance/page.tsx           Attendance management + export
  api/
    session/route.ts                Code -> signed session cookie
    attendance/route.ts             Read a month / mark a day (session-scoped)
    profile/photo/route.ts          Employee photo upload
    export/route.ts                 Employee's own xlsx / csv / pdf
    admin/
      employees/route.ts            List, create
      employees/[id]/route.ts       Edit, deactivate, delete
      employees/import/route.ts     Commit a previewed import
      employees/import/preview/     Parse + classify, writes nothing
      employees/photo/route.ts      Admin sets any employee's photo
      attendance/route.ts           Query / correct any employee's attendance
      export/route.ts               Multi-sheet workbook or CSV
      stats/route.ts                Dashboard counts

components/
  Header.tsx  Logo.tsx  LoadingState.tsx
  CodeLookupForm.tsx
  EmployeeDashboard.tsx             Client orchestrator for the employee page
  EmployeeProfile.tsx  ProfilePhoto.tsx
  AttendanceCalendar.tsx  AttendanceModal.tsx  MonthlySummary.tsx
  DownloadAttendance.tsx
  ui/Button.tsx  ui/Input.tsx  ui/Modal.tsx  ui/StatusBadge.tsx
  admin/AdminLoginForm.tsx  admin/AdminShell.tsx  admin/NoAdminAccess.tsx
  admin/EmployeeManager.tsx  admin/EmployeeFormModal.tsx
  admin/ImportWizard.tsx  admin/AttendanceManager.tsx  admin/ExportPanel.tsx

lib/
  config.ts                         Organisation switches read from env
  errors.ts                         AppError + safe DB error messages
  http.ts                           JSON responses, route error handling
  rate-limit.ts
  auth/session-token.ts             HMAC sign/verify (no framework imports)
  auth/employee-session.ts          Cookie layer for the above
  auth/admin.ts                     Supabase Auth + role resolution
  supabase/admin.ts                 Service-role client (server only)
  supabase/server.ts                RLS-respecting client for admins
  supabase/client.ts                Browser client (sign in/out only)
  employees/queries.ts  employees/photos.ts
  attendance/queries.ts  attendance/summary.ts
  excel/import.ts  excel/export.ts  excel/filenames.ts
  pdf/report.ts
  date/nepal.ts                     Timezone-safe calendar helpers
  validation/schemas.ts             Zod schemas

types/employee.ts  types/attendance.ts
proxy.ts                            Session refresh + admin route guard
supabase/migrations/0001_init.sql   Tables, indexes, constraints, RLS
supabase/migrations/0002_storage.sql Photo bucket + storage policies
supabase/seed.sql                   Fictional demo employees (dev only)
tests/                              Node test-runner suites
```

---

## 3. Supabase setup

### 3.1 Create the project

1. Sign in at <https://supabase.com> and create a new project.
2. Choose a region close to your users (Singapore or Mumbai for Nepal).
3. Save the database password somewhere safe.

### 3.2 Create the database tables

Open **SQL Editor** in the Supabase dashboard and run these two files, in order:

1. `supabase/migrations/0001_init.sql` — tables, indexes, constraints, triggers
   and all Row Level Security policies.
2. `supabase/migrations/0002_storage.sql` — the `employee-photos` bucket and its
   storage policies.

Both scripts are safe to run more than once.

What `0001_init.sql` creates:

- **`employees`** — `id`, `computer_code` (unique), `full_name`, `rank`,
  `department`, `office`, `phone`, `email`, `profile_photo_url`, `is_active`,
  `created_at`, `updated_at`.
- **`attendance`** — `id`, `employee_id` (FK, cascade delete), `attendance_date`,
  `status` (`present` | `absent`), `remark`, `created_at`, `updated_at`, with a
  **unique index on `(employee_id, attendance_date)`**. This is what guarantees
  one record per employee per day: the application upserts on that pair, so
  changing a status updates the row in place instead of creating a duplicate.
- **`profiles`** — one row per Supabase Auth user, holding `role`
  (`admin` | `employee`). A trigger creates a row for every new auth user with
  the non-admin default.
- Indexes on `computer_code`, `employee_id`, `attendance_date`,
  `(status, attendance_date)`, `department`, `is_active` and `lower(full_name)`.

### 3.3 Verify the storage bucket

Go to **Storage** and confirm a bucket named `employee-photos` exists, is public
for reads, and is limited to 5 MB and JPEG/PNG/WebP. `0002_storage.sql` sets all
of this; the dashboard is just a sanity check.

### 3.4 (Optional) load demo data

`supabase/seed.sql` inserts five **fictional** employees (`NP10001`–`NP10005`)
for testing. They are invented people, not real individuals. Remove them before
real use:

```sql
delete from public.employees where computer_code like 'NP1000%';
```

---

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where it comes from | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Sent to the browser. Fine. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Sent to the browser. Safe **because** RLS is enabled. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **Server only.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. |
| `EMPLOYEE_SESSION_SECRET` | You generate it | Signs the employee session cookie. 32+ characters. |
| `EMPLOYEE_SESSION_TTL_SECONDS` | Optional | Default `43200` (12 hours). |
| `NEXT_PUBLIC_ORG_NAME` | You choose | Shown in headers and on the PDF. |
| `ATTENDANCE_EDIT_ENABLED` | You choose | `true` (default) lets employees correct an entry. |
| `ALLOW_FUTURE_ATTENDANCE` | You choose | `false` (default) blocks marking dates that have not happened. |

Generate a session secret:

```bash
openssl rand -base64 48
```

`.env.local` is in `.gitignore` and must never be committed. `.env.example`
contains placeholders only and is safe to commit.

---

## 5. Running locally

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

Other commands:

```bash
npm run build
```

```bash
npm run start
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run lint
```

---

## 6. Creating an administrator account

There is no hard-coded admin password anywhere in this codebase. Admins are real
Supabase Auth users whose `profiles.role` is `admin`.

1. In the Supabase dashboard go to **Authentication → Users → Add user**.
2. Enter an email and password, and tick **Auto Confirm User**.
3. The `handle_new_user` trigger creates a `profiles` row with role `employee`.
4. Promote that user in the **SQL Editor**:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

5. Sign in at `/admin/login`.

To revoke access later, set the role back to `employee` — the person is
immediately shown an "Administrator access required" page instead of the
dashboard.

---

## 7. Importing your existing employee spreadsheet

1. Sign in as an administrator and go to **Import**.
2. Upload your `.xlsx` or `.xls` file (10 MB maximum).
3. Review the preview. Nothing is written to the database until you confirm.
4. Press **Confirm Import**.

**Expected column headers** (the first row):

```text
Computer Code | Name | Rank | Department | Office | Phone | Email
```

Only **Computer Code** and **Name** are required. Common alternative spellings
are accepted — `Code`, `Full Name`, `Designation`, `Dept`, `Mobile` and so on.

The preview classifies every row and reports:

```text
Total Rows | New Employees | Updated Employees | Duplicate Codes | Invalid Rows
```

- **New** — the computer code is not yet in the database.
- **Update** — the code already exists, so the record is **updated in place**.
  The employee keeps their id, their photo and their full attendance history.
- **Duplicate** — the same code appears twice in the file. Skipped.
- **Invalid** — a validation failure, with the reason shown. Skipped.

Blank rows are ignored. Computer codes are normalised to upper case, so
`np10001` and `NP10001` are the same employee.

Excel is for import, export and backup. **The database is the source of truth** —
the application never reads or writes a spreadsheet as live storage.

---

## 8. Deploying to GitHub and Vercel

### 8.1 Push to GitHub

```bash
git add -A && git commit -m "Attendance management system"
```

```bash
gh repo create attendance --private --source=. --push
```

(Or create the repository in the GitHub UI and `git push -u origin main`.)

Confirm `.env.local` is **not** in the commit:

```bash
git ls-files | grep -c "^\.env\.local$"
```

That must print `0`.

### 8.2 Deploy on Vercel

1. <https://vercel.com> → **Add New → Project** → import the repository.
2. Framework preset: **Next.js** (detected automatically).
3. Add the environment variables from section 4. Add
   `SUPABASE_SERVICE_ROLE_KEY` as a normal (non-public) variable.
4. **Deploy.**

```text
GitHub → Vercel → Supabase (PostgreSQL + Storage + Auth)
```

### 8.3 A note on GitHub Pages

**GitHub Pages will not run this application.** Pages serves static files only,
and this app relies on server-side code for every security guarantee: the
computer-code lookup, the signed session cookie, the service-role database
access and the Excel/PDF generation all run on the server.

Deploying the frontend statically would force the Supabase anon key to talk to
the database directly from the browser, which would mean opening RLS policies to
anonymous users — and anyone could then download the entire staff list. **Use
Vercel** (or any Node host: Netlify, Render, Fly.io, a VPS).

---

## 9. Security model — and its limits

### How an employee is identified

1. The code is posted to `/api/session`. The lookup happens **on the server**
   with the service-role key, so the browser never gets a queryable handle on
   the employees table.
2. On success the server sets `emp_session`: an **HttpOnly, SameSite=Lax**
   cookie holding the employee's id, signed with **HMAC-SHA256**.
3. Every later request reads the id **from that cookie** — never from the URL or
   the request body.

This means:

- Changing `/employee/NP10001` to another code in the address bar redirects to
  the landing page. No data is served.
- Adding `"employeeId": "..."` to an attendance request body is ignored; the
  write lands on the session owner.
- Editing or re-signing the cookie fails verification and is rejected.

### Row Level Security

RLS is **deny by default**. Enabling it with no matching policy blocks
everything, so:

| Who | `employees` / `attendance` |
| --- | --- |
| Anonymous (the public anon key) | No access at all — cannot list staff or enumerate computer codes |
| Signed-in non-admin | No access; can read only their own `profiles` row |
| Signed-in admin | Full access, via explicit policies |
| Server routes | Use the service-role key, scoped to the session's employee id |

`employees` and `attendance` also have `FORCE ROW LEVEL SECURITY`, so even the
table owner is subject to the policies.

The admin area is checked three separate times — in `proxy.ts`, again in the
admin layout, and a third time by RLS inside the database. A bypass of any one
of them grants nothing on its own.

### ⚠️ The honest limitation

**A computer code is an identifier, not a password.** Anyone who learns a
colleague's code can mark that colleague's attendance. This version is built for
an internal, trusted setting where that trade-off is acceptable in exchange for
a login an employee can complete in three seconds.

Mitigations already in place: the lookup endpoint is rate limited (10 attempts
per minute per IP), failures return one generic message so codes cannot be
probed, and the employee list can never be downloaded.

**To add a second factor**, change one function — `verifyEmployeeCode` in
`lib/employees/queries.ts`. It is the single place where "who is this person?"
is decided. Add a PIN column and check it there, or verify an OTP, and the rest
of the application keeps working unchanged: sessions, the calendar, the API
routes and the admin area all already assume identity is settled before a cookie
is issued.

The in-memory rate limiter in `lib/rate-limit.ts` is per server instance. On
serverless hosting each instance keeps its own counters, so treat it as a speed
bump. For a hard limit, back it with Upstash Redis or Vercel KV.

### Other measures

- Uploaded photos are checked by **magic number**, not by filename or the
  declared MIME type, so an executable renamed to `.png` is rejected.
- CSV exports prefix `=`, `+`, `-` and `@` with an apostrophe to defuse
  spreadsheet formula injection.
- Raw database errors are logged server-side and replaced with friendly messages.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and a restrictive
  `Permissions-Policy` are set in `next.config.ts`.
- `robots.ts` and `X-Robots-Tag` keep every page out of search engines.

---

## 10. Configuration switches

Set these in `.env.local` (or in Vercel's environment variables) and redeploy.

**`ATTENDANCE_EDIT_ENABLED`** — default `true`.
Employees may change an entry they already saved. Set to `false` to lock
attendance once submitted; employees then see "already submitted and can no
longer be changed", but can still fill in days they never marked. Administrators
can always correct any record.

**`ALLOW_FUTURE_ATTENDANCE`** — default `false`.
Future dates are shown dimmed and cannot be marked. Set to `true` if your
organisation records attendance in advance.

---

## 11. Dates and the Nepal timezone

Nepal is **UTC+05:45**, an offset that breaks naive date handling. Between 18:15
and 24:00 UTC it is already the next day in Kathmandu, so
`new Date().toISOString().slice(0, 10)` — the usual shortcut — silently records
attendance against the wrong day every evening.

This application avoids that completely:

- Attendance dates are stored as PostgreSQL `date` and handled everywhere as
  plain `"YYYY-MM-DD"` strings. No `Date` object is ever converted between UTC
  and local time.
- "Today" is derived with `Intl.DateTimeFormat` pinned to `Asia/Kathmandu`, so
  it is correct regardless of where the server runs.
- Day-of-week is computed with `Date.UTC`, which is deterministic on every
  machine.

All of this lives in `lib/date/nepal.ts` and is covered by tests.

---

## 12. Tests

```bash
npm test
```

Runs on Node's built-in test runner — no extra dependencies. Coverage includes
calendar arithmetic and leap years, the UTC+05:45 boundary, monthly summaries
(future days are never counted as absent), report rows, export filenames, CSV
formula-injection escaping, session-token signing and tamper/expiry rejection,
every Zod schema, spreadsheet parsing with real `.xlsx` files, import
classification, and image magic-number sniffing.

---

## 13. Troubleshooting

**"Supabase is not configured"** — `.env.local` is missing or incomplete.
Restart the dev server after editing it; Next.js only reads env files at startup.

**"Computer code not found" for a code you know exists** — check the employee is
`is_active = true`, and that the code has no trailing space in the database.
Codes are compared in upper case.

**Admin sign-in works but you see "Administrator access required"** — the auth
user exists but `profiles.role` is still `employee`. Run the `update` in
section 6.

**Redirected to `/admin/login` in a loop** — this was a real bug and is fixed; a
signed-in non-admin now gets an explanatory page. If you still see it, clear
cookies for the site and sign in again.

**Photo upload fails** — confirm the `employee-photos` bucket exists (run
`0002_storage.sql`), and that the file is JPEG/PNG/WebP under 5 MB. Large photos
are shrunk to 512 px WebP in the browser before upload.

**Excel import says a column is missing** — the header must be in the **first
row** of the **first sheet**. Merged title rows above the headers will break it.

**Exports time out on a large date range** — the range cap is 24 months
(`MAX_EXPORT_MONTHS` in `lib/config.ts`). On Vercel's free tier, export routes
are given 60 seconds via `maxDuration`.
