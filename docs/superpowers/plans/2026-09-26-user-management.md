# Gestión de usuarios (fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin "Usuarios" page to create/edit users, set temporary passwords, deactivate (with reassignment) and reactivate them; deactivated users are locked out within 60 s; public registration closed; payroll employee list becomes dynamic (`in_payroll`).

**Architecture:** Backend adds `is_active`, `must_change_password`, `in_payroll`, `deactivated_at` to `users`; `authenticate` checks status through a 60 s per-user cache (invalidated on admin changes); new `/api/admin/users…` endpoints backed by `User` model methods (deactivation runs in one transaction). Frontend adds a `Usuarios` page, a forced "Crea tu contraseña" gate in `ProtectedRoute`, and replaces the hardcoded `USER_COLUMNS` with a list computed from the user directory.

**Tech Stack:** Backend Node 20 / Express 4 / pg / `node:test` (local Postgres `guru_test`). Frontend React 19 / Vite 7 / TS / Tailwind v4 / vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-26-user-management-design.md` (repo `guru-frontend-dev`). Owner-facing PDF: `~/Desktop/Gurú - Gestión de usuarios (diseño).pdf`.

**Repos / branches:**
- Backend `BE = /Users/jay/Documents/W/guru-soluciones/guruweb-backend`, branch `feat/user-management` from `main` (dd87739).
- Frontend `FE = /Users/jay/Documents/W/guru-soluciones/guru-frontend-dev/apps/dashboard/src`, repo branch `feat/user-management` (already created from `main`).

## Global Constraints

- Roles: `admin`, `digitador`, `auxiliar` (legacy `employee` still accepted on read, never created).
- Never delete users. Deactivate = `is_active=false`, `deactivated_at=NOW()`, `color=NULL`, `avatar=NULL`, reassign `clients.assigned_to` and `cases.user_id` to `reassign_to` (active user ≠ target) or NULL — all in ONE transaction.
- Status cache TTL: 60 s per user; invalidated immediately by any admin mutation of that user and by change-password.
- Error codes / copy (Spanish, exact):
  - login inactive → `403 { error: "Usuario desactivado. Contacta al administrador.", code: "USER_INACTIVE" }`
  - request with inactive session → `401 { error: "Usuario desactivado. Contacta al administrador.", code: "USER_INACTIVE" }`
  - must change password → `403 { error: "Debes cambiar tu contraseña para continuar", code: "PASSWORD_CHANGE_REQUIRED" }`; allowed while pending: `GET /api/auth/me`, `PUT /api/auth/change-password`, `POST /api/auth/logout`
  - `409 USERNAME_TAKEN` "Ese usuario ya existe"; `400 INVALID_ROLE` "Rol no válido"; `400 PASSWORD_TOO_SHORT` "La contraseña debe tener al menos 6 caracteres"; `400 CANNOT_DEACTIVATE_SELF` "No puedes desactivarte a ti mismo"; `400 LAST_ADMIN` "Debe quedar al menos un administrador activo"; `400 CANNOT_DEMOTE_SELF` "No puedes quitarte el rol de administrador"; `400 INVALID_REASSIGN` "Elige un usuario activo distinto para reasignar"; `404 USER_NOT_FOUND` "Usuario no encontrado"; `400 NAME_REQUIRED` "Nombre y usuario son obligatorios".
- Username unique case-insensitive; `data_column` generated only when `in_payroll` and none exists: uppercase, accents stripped, non-alphanumerics → `_`, collapse `_`, trim; add `_2`, `_3`… if taken (case-insensitive).
- Migration seeds `in_payroll = TRUE` where `UPPER(data_column) IN ('HENGI','MARLENI','ISRAEL','THAICAR','AUXILIAR_I','AUXILIAR_II')`.
- `/api/auth/register` becomes admin-only.
- Backward compatibility: the production frontend (no panel) must keep working after the backend deploy (only additive fields; status codes for existing flows unchanged except inactive users).
- Tests only against local DB (existing guard in `test/helpers/db.js`).

## Review Focus

- Deactivated user with an open "recuérdame" session keeps clicking → every request 401 `USER_INACTIVE` within 60 s and the UI sends them to login with the message (Task 3 test + Task 10 interceptor test).
- Admin deactivates the only other admin / themselves / demotes themselves → blocked with the Spanish message, nothing changed (Task 5 tests).
- Deactivation fails midway (e.g. invalid `reassign_to`) → no partial reassignment (Task 4 transaction test).
- User created with a temporary password tries to skip the "Crea tu contraseña" screen by calling APIs → 403 `PASSWORD_CHANGE_REQUIRED` (Task 3 test).
- New employee named "José Peña" → `data_column` `JOSE_PENA`, appears in payroll cards; deactivated Marleni appears only when she has services in the filtered range, marked "Desactivado" (Task 4 + Task 7 tests).

---

## Task 0: Setup (no commit)

- [ ] `pg_ctl -D /opt/homebrew/var/postgresql@14 -l /tmp/pg14.log start || true; createdb guru_test 2>/dev/null || true`
- [ ] `cd BE && git checkout main && git pull --ff-only && git checkout -b feat/user-management`

## Task 1: Migration

**Files:** Create `BE/migrations/20260926_user_management.sql`; Create `BE/test/user-management-migration.test.js`.

**Interfaces:** Produces columns `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `must_change_password BOOLEAN NOT NULL DEFAULT FALSE`, `in_payroll BOOLEAN NOT NULL DEFAULT FALSE`, `deactivated_at TIMESTAMPTZ`, index `users_username_lower_unique`.

- [ ] **Step 1: failing test**

```js
const { pool, runSqlFile, resetDb } = require('./helpers/db');
const test = require('node:test');
const assert = require('node:assert/strict');

const MIG = 'migrations/20260926_user_management.sql';

test.beforeEach(async () => {
  await resetDb();
  await pool.query(`INSERT INTO users (username, password_hash, name, role, data_column) VALUES
    ('admin','x','Admin','admin',NULL), ('hengi','x','Hengi','digitador','Hengi'),
    ('aux1','x','Aux I','auxiliar','AUXILIAR_I'), ('administracion','x','Administracion','digitador',NULL)`);
});
test.after(async () => { await pool.end(); });

test('adds status columns with safe defaults', async () => {
  await runSqlFile(MIG);
  const { rows } = await pool.query('SELECT username, is_active, must_change_password, deactivated_at FROM users ORDER BY id');
  assert.ok(rows.every((r) => r.is_active === true && r.must_change_password === false && r.deactivated_at === null));
});

test('in_payroll seeded only for the six current payroll columns', async () => {
  await runSqlFile(MIG);
  const { rows } = await pool.query('SELECT username FROM users WHERE in_payroll ORDER BY id');
  assert.deepEqual(rows.map((r) => r.username), ['hengi', 'aux1']);
});

test('idempotent', async () => {
  await runSqlFile(MIG);
  await runSqlFile(MIG);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE in_payroll');
  assert.equal(rows[0].n, 2);
});

test('username unique ignoring case', async () => {
  await runSqlFile(MIG);
  await assert.rejects(
    pool.query(`INSERT INTO users (username, password_hash, role) VALUES ('HENGI','x','digitador')`),
    { code: '23505', constraint: 'users_username_lower_unique' }
  );
});
```

- [ ] **Step 2:** `npm test` → FAIL (ENOENT migration).
- [ ] **Step 3: migration**

```sql
-- User management: active flag, forced password change, payroll membership. Idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS in_payroll BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

UPDATE users SET in_payroll = TRUE
WHERE UPPER(data_column) IN ('HENGI','MARLENI','ISRAEL','THAICAR','AUXILIAR_I','AUXILIAR_II')
  AND in_payroll = FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT LOWER(username) FROM users WHERE username IS NOT NULL
    GROUP BY LOWER(username) HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate usernames (ignoring case) must be fixed before creating users_username_lower_unique';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (LOWER(username)) WHERE username IS NOT NULL;
```

Note: the idempotency test expects `in_payroll` count stays 2 on re-run (the UPDATE only flips FALSE rows of the six columns).

- [ ] **Step 4:** `npm test` → PASS. **Step 5:** commit `feat(users): migration for is_active, must_change_password, in_payroll`.

## Task 2: Status cache + gate in `authenticate`

**Files:** Modify `BE/src/middleware/auth.js`; Create `BE/test/auth-status.test.js`.

**Interfaces:** Produces `getUserStatus(id) → Promise<{ is_active: boolean, must_change_password: boolean }>`, `invalidateUserStatus(id)`, exported from `src/middleware/auth.js`; `authenticate` becomes async and enforces the gate.

- [ ] **Step 1: failing test** (`auth-status.test.js`)

```js
const { pool, runSqlFile, resetDb } = require('./helpers/db');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const { generateToken, authenticate, invalidateUserStatus } = require('../src/middleware/auth');

let server, base, tok = {};

test.before(async () => {
  await resetDb();
  await pool.query(`INSERT INTO users (username, email, password_hash, name, role) VALUES
    ('ana','ana@x.com','x','Ana','digitador'), ('temp','temp@x.com','x','Temp','digitador')`);
  await runSqlFile('migrations/20260926_user_appearance.sql');
  await runSqlFile('migrations/20260926_user_management.sql');
  await pool.query(`UPDATE users SET must_change_password = TRUE WHERE username = 'temp'`);
  for (const u of (await pool.query('SELECT id, username, email, role FROM users')).rows) tok[u.username] = { id: u.id, t: generateToken(u) };

  const app = express();
  app.use(cookieParser());
  app.get('/api/auth/me', authenticate, (req, res) => res.json({ ok: true }));
  app.put('/api/auth/change-password', authenticate, (req, res) => res.json({ ok: true }));
  app.get('/api/things', authenticate, (req, res) => res.json({ ok: true }));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.close(); await pool.end(); });

const get = (path, who, method = 'GET') => fetch(base + path, { method, headers: { Authorization: `Bearer ${tok[who].t}` } });

test('active user passes', async () => {
  assert.equal((await get('/api/things', 'ana')).status, 200);
});

test('deactivated user is rejected with USER_INACTIVE once cache is invalidated', async () => {
  await pool.query(`UPDATE users SET is_active = FALSE WHERE username = 'ana'`);
  invalidateUserStatus(tok.ana.id);
  const res = await get('/api/things', 'ana');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'USER_INACTIVE');
  await pool.query(`UPDATE users SET is_active = TRUE WHERE username = 'ana'`);
  invalidateUserStatus(tok.ana.id);
});

test('pending password change blocks other endpoints', async () => {
  const res = await get('/api/things', 'temp');
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'PASSWORD_CHANGE_REQUIRED');
});

test('pending password change still allows /me and change-password', async () => {
  assert.equal((await get('/api/auth/me', 'temp')).status, 200);
  assert.equal((await get('/api/auth/change-password', 'temp', 'PUT')).status, 200);
});
```

- [ ] **Step 2:** `npm test` → FAIL (`invalidateUserStatus` undefined / 200 instead of 401).
- [ ] **Step 3: implement** in `src/middleware/auth.js`:

```js
// Per-user status cache so a deactivated user is cut off within STATUS_TTL_MS
const STATUS_TTL_MS = 60_000;
const statusCache = new Map(); // userId → { status, at }

const PASSWORD_CHANGE_ALLOWED = [
  ['GET', '/api/auth/me'],
  ['PUT', '/api/auth/change-password'],
  ['POST', '/api/auth/logout'],
];

async function getUserStatus(id) {
  const hit = statusCache.get(id);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit.status;
  let status = { is_active: true, must_change_password: false };
  try {
    const { rows } = await pool.query('SELECT is_active, must_change_password FROM users WHERE id = $1', [id]);
    if (rows[0]) status = { is_active: rows[0].is_active !== false, must_change_password: rows[0].must_change_password === true };
    else status = { is_active: false, must_change_password: false };
  } catch (err) {
    // 42703 = column missing (migration not run yet): treat as active
    if (err.code !== '42703') throw err;
  }
  statusCache.set(id, { status, at: Date.now() });
  return status;
}

function invalidateUserStatus(id) {
  statusCache.delete(Number(id));
}
```

Rewrite `authenticate` as `async function authenticate(req, res, next)`: keep token extraction and `jwt.verify` (inside try → 401 on failure), set `req.user`/`req.auth`, keep `last_seen` throttle, then:

```js
  let status;
  try {
    status = await getUserStatus(req.user.id);
  } catch (err) {
    console.error('[auth] status lookup failed:', err.message);
    return res.status(503).json({ error: 'Servicio no disponible, intenta de nuevo' });
  }
  if (!status.is_active) {
    return res.status(401).json({ error: 'Usuario desactivado. Contacta al administrador.', code: 'USER_INACTIVE' });
  }
  if (status.must_change_password) {
    const path = (req.originalUrl || '').split('?')[0];
    const allowed = PASSWORD_CHANGE_ALLOWED.some(([m, p]) => m === req.method && path === p);
    if (!allowed) {
      return res.status(403).json({ error: 'Debes cambiar tu contraseña para continuar', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
  }
  next();
```
Export `getUserStatus, invalidateUserStatus` alongside existing exports.

- [ ] **Step 4:** `npm test` → all PASS (existing 36 + new). **Step 5:** commit `feat(auth): cut off deactivated users and enforce pending password change`.

## Task 3: Login / me / change-password / register

**Files:** Modify `BE/src/models/User.js` (`toPublicUser`), `BE/src/routes/auth.js`; Create `BE/test/auth-lifecycle.test.js`; update `BE/test/user-appearance.test.js` `toPublicUser shape` expectation.

**Interfaces:** `toPublicUser(user)` adds `isActive: user.is_active !== false`, `mustChangePassword: user.must_change_password === true`, `inPayroll: user.in_payroll === true`.

- [ ] **Step 1: failing tests** (`auth-lifecycle.test.js`): build app with `/api/auth` router (same harness as `session.test.js`), users `admin` (admin), `ana` (digitador), `temp` (digitador, `must_change_password=true`), `gone` (digitador, `is_active=false`), all password `secret1`, both appearance + management migrations applied.
  - login `gone` → 403 `{ error: 'Usuario desactivado. Contacta al administrador.', code: 'USER_INACTIVE' }`
  - login `temp` → 200 and `user.mustChangePassword === true`
  - `temp` `PUT /change-password` `{currentPassword:'secret1', newPassword:'nueva123'}` → 200; then `GET /me` → `user.mustChangePassword === false`; then a gated call would pass (assert DB `must_change_password=false`)
  - `POST /register` without token → 401; with `ana` token → 403; with `admin` token and valid body → 201
  - update `user-appearance.test.js` `toPublicUser shape` expected object to include `isActive: true, mustChangePassword: false, inPayroll: false`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: implement**
  - `toPublicUser` add the three fields.
  - login: after password check, `if (user.is_active === false) return res.status(403).json({ error: 'Usuario desactivado. Contacta al administrador.', code: 'USER_INACTIVE' });`
  - change-password success: `await pool.query('UPDATE users SET must_change_password = FALSE WHERE id = $1', [user.id])` via new `User.clearMustChangePassword(id)`; then `invalidateUserStatus(user.id)` (import from middleware).
  - register: `router.post('/register', authenticate, requireRole('admin'), registerLimiter, …)` unchanged body.
- [ ] **Step 4:** `npm test` → PASS. **Step 5:** commit `feat(auth): inactive login blocked, password-change flag, admin-only register`.

## Task 4: User model — admin operations

**Files:** Modify `BE/src/models/User.js`; Create `BE/test/user-admin-model.test.js`.

**Interfaces (all on `User`):**
- `slugDataColumn(name) → string` (pure) e.g. `'José Peña' → 'JOSE_PENA'`
- `uniqueDataColumn(base) → Promise<string>`
- `adminList(status: 'active'|'inactive'|'all') → rows` (`id, name, username, email, role, data_column, color, avatar, is_active, in_payroll, must_change_password, last_seen, created_at, deactivated_at`)
- `adminCreate({ name, username, email, role, in_payroll, temp_password }) → row` (bcrypt; `must_change_password=TRUE`; color auto; `data_column` when `in_payroll`)
- `adminUpdate(id, { name, username, email, role, in_payroll }) → row` (generates `data_column` if `in_payroll` and missing)
- `setTempPassword(id, password) → row` (`must_change_password=TRUE`)
- `clearMustChangePassword(id)`
- `countAssignments(id) → { clients: number, cases: number }`
- `countActiveAdmins(excludeId?) → number`
- `deactivate(id, reassignTo|null) → row` (transaction)
- `reactivate(id) → row` (`is_active=TRUE`, `deactivated_at=NULL`, then `assignFirstFreeColor`)

- [ ] **Step 1: failing test** — fixture: extend `test/fixtures/users_schema.sql`? No: create in the test `beforeEach` minimal `clients (id SERIAL PRIMARY KEY, phone TEXT, assigned_to INT)` and `cases (id SERIAL PRIMARY KEY, title TEXT, user_id INT)` tables after `resetDb()` (`DROP TABLE IF EXISTS clients, cases` first). Tests:
  - `slugDataColumn('José Peña') === 'JOSE_PENA'`, `slugDataColumn('  Ana  María ') === 'ANA_MARIA'`
  - `adminCreate({name:'José Peña', username:'jose', role:'digitador', in_payroll:true, temp_password:'temp123'})` → `data_column 'JOSE_PENA'`, `must_change_password true`, color set, password verifies with bcrypt
  - second `adminCreate` name 'Jose Pena' username 'jose2' → `data_column 'JOSE_PENA_2'`
  - `adminCreate` username 'JOSE' → rejects `23505`
  - `deactivate(marleniId, hengiId)` with 2 clients + 1 case of marleni → those now `assigned_to/user_id = hengi`, marleni `is_active false`, `color null`, `avatar null`, `deactivated_at` set
  - `deactivate(marleniId, null)` → assignments NULL
  - `deactivate(marleniId, 99999)` rejects and marleni still active, assignments unchanged (transaction)
  - `countAssignments` returns `{clients:2, cases:1}`
  - `reactivate` → active, color not null
  - `countActiveAdmins()` / with exclude
- [ ] **Step 2:** FAIL. **Step 3: implement**

```js
  slugDataColumn(name) {
    return (name || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  },

  async uniqueDataColumn(base) {
    const root = base || 'EMPLEADO';
    let candidate = root;
    for (let n = 2; ; n++) {
      const { rows } = await pool.query('SELECT 1 FROM users WHERE UPPER(data_column) = $1', [candidate]);
      if (!rows.length) return candidate;
      candidate = `${root}_${n}`;
    }
  },
```
`deactivate`:
```js
  async deactivate(id, reassignTo) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (reassignTo != null) {
        const { rows } = await client.query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND id <> $2', [reassignTo, id]);
        if (!rows.length) { const e = new Error('INVALID_REASSIGN'); e.code = 'INVALID_REASSIGN'; throw e; }
      }
      await client.query('UPDATE clients SET assigned_to = $1 WHERE assigned_to = $2', [reassignTo ?? null, id]);
      await client.query('UPDATE cases SET user_id = $1 WHERE user_id = $2', [reassignTo ?? null, id]);
      const { rows } = await client.query(
        `UPDATE users SET is_active = FALSE, deactivated_at = NOW(), color = NULL, avatar = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING *`, [id]);
      await client.query('COMMIT');
      return rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
```
`countAssignments`: `SELECT (SELECT COUNT(*) FROM clients WHERE assigned_to=$1)::int AS clients, (SELECT COUNT(*) FROM cases WHERE user_id=$1)::int AS cases`. Others straightforward SQL with `RETURNING *`.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(users): admin model operations (create, update, temp password, deactivate with reassignment, reactivate)`.

## Task 5: Admin routes + directory fields

**Files:** Modify `BE/src/routes/admin.js` (replace `GET /users`, add routes), `BE/src/models/User.js` `listDirectory` (+`is_active, in_payroll`); Create `BE/test/admin-users.test.js`; update `listDirectory` key test in `user-appearance.test.js`.

**Interfaces (HTTP, all admin-only):** `GET /api/admin/users?status=`, `POST /api/admin/users`, `PUT /api/admin/users/:id`, `POST /api/admin/users/:id/temp-password`, `GET /api/admin/users/:id/assignments`, `POST /api/admin/users/:id/deactivate` `{reassign_to}`, `POST /api/admin/users/:id/reactivate`. Responses `{ user }`, `{ users }`, `{ clients, cases }`; errors `{ error, code }` per Global Constraints. Every mutation calls `invalidateUserStatus(id)`.

- [ ] **Step 1: failing tests** — harness mounts `/api/admin` router; creates `clients`/`cases` tables as in Task 4; users `admin`(admin), `boss2`(admin), `hengi`, `marleni` (digitadores). Cases:
  - non-admin → 403 on `GET /api/admin/users`
  - create → 201 with `must_change_password true`; duplicate username → 409 `USERNAME_TAKEN`; role `superuser` → 400 `INVALID_ROLE`; short password → 400 `PASSWORD_TOO_SHORT`
  - update role/name → 200; admin demoting self → 400 `CANNOT_DEMOTE_SELF`
  - temp-password → 200; the user's next gated request → 403 `PASSWORD_CHANGE_REQUIRED` (proves cache invalidation)
  - assignments counts
  - deactivate self → 400 `CANNOT_DEACTIVATE_SELF`; deactivate marleni reassign to hengi → 200 and marleni's token → 401 `USER_INACTIVE` immediately; reassign to inactive/self → 400 `INVALID_REASSIGN`
  - with only `admin` + `boss2`: deactivate `boss2` ok; then (as a third admin created for the test) deactivating `admin` when it is the last active admin → 400 `LAST_ADMIN`; demoting last admin via PUT → 400 `LAST_ADMIN`
  - reactivate → 200, color set
  - `status=inactive` lists only deactivated
- [ ] **Step 2:** FAIL. **Step 3: implement** routes with a local `sendError(res, status, code, error)` helper; map `23505` on `users_username_lower_unique` → 409 `USERNAME_TAKEN`; map thrown `INVALID_REASSIGN` → 400. Validation order for deactivate: target exists (404) → not self (400) → if target is admin and `countActiveAdmins(targetId) === 0` → `LAST_ADMIN` → reassign validity inside model. For PUT: if changing an admin's role away from admin: self → `CANNOT_DEMOTE_SELF`, last active admin → `LAST_ADMIN`. `listDirectory` adds `is_active, in_payroll`.
- [ ] **Step 4:** full `npm test` PASS; smoke `JWT_SECRET=x DATABASE_URL=postgresql://localhost:5432/guru_test node -e "require('./src/routes/admin');require('./src/routes/auth')"`. **Step 5:** commit `feat(admin): user management endpoints`.

## Task 6: Frontend API client + directory types

**Files:** Modify `FE/services/api.ts` (add `adminUsersAPI`), `FE/lib/userColors.ts` (`DirectoryUser` gains `is_active: boolean; in_payroll: boolean`), `FE/context/AuthContext.tsx` (`User` gains `mustChangePassword?: boolean; isActive?: boolean; inPayroll?: boolean`); fix `FE/lib/userColors.test.ts` fixtures (add the two fields).

```ts
export interface AdminUser {
  id: number; name: string | null; username: string; email: string | null;
  role: "admin" | "digitador" | "auxiliar" | "employee";
  data_column: string | null; color: string | null; avatar: string | null;
  is_active: boolean; in_payroll: boolean; must_change_password: boolean;
  last_seen: string | null; created_at: string; deactivated_at: string | null;
}
export interface AdminUserInput { name: string; username: string; email?: string; role: "admin" | "digitador" | "auxiliar"; in_payroll: boolean }

export const adminUsersAPI = {
  list: (status: "active" | "inactive" | "all" = "active") => api.get<{ users: AdminUser[] }>("/admin/users", { params: { status } }),
  create: (data: AdminUserInput & { temp_password: string }) => api.post<{ user: AdminUser }>("/admin/users", data),
  update: (id: number, data: AdminUserInput) => api.put<{ user: AdminUser }>(`/admin/users/${id}`, data),
  setTempPassword: (id: number, temp_password: string) => api.post(`/admin/users/${id}/temp-password`, { temp_password }),
  assignments: (id: number) => api.get<{ clients: number; cases: number }>(`/admin/users/${id}/assignments`),
  deactivate: (id: number, reassign_to: number | null) => api.post<{ user: AdminUser }>(`/admin/users/${id}/deactivate`, { reassign_to }),
  reactivate: (id: number) => api.post<{ user: AdminUser }>(`/admin/users/${id}/reactivate`),
};
```
- [ ] tests + build green; commit `feat(dashboard): admin users API client and status fields`.

## Task 7: Dynamic payroll list (pure + wiring)

**Files:** Create `FE/lib/payroll.ts`, `FE/lib/payroll.test.ts`; Modify `FE/services/excelService.ts` (`WorkerKey = string`, keep `USER_COLUMNS` as `LEGACY_PAYROLL_COLUMNS` fallback export alias), `FE/pages/Dashboard.tsx`, `FE/components/dashboard/AdminDataTable.tsx`, `FE/components/dashboard/DataModificationForm.tsx`.

**Interfaces:** `payrollColumns(users: DirectoryUser[], services: { data_column?: string | null }[]) → { columns: string[]; inactive: Set<string> }`
- active & `in_payroll` users' `data_column` (uppercased, non-empty), ordered by `id`
- plus inactive `in_payroll` users whose uppercased `data_column` appears in `services` (added to `inactive`)
- if `users` is empty → `{ columns: [...USER_COLUMNS], inactive: new Set() }` (directory not loaded yet)

- [ ] **Step 1: failing tests** covering: order by id; excludes `in_payroll=false`; excludes users without data_column; inactive only when present in services (case-insensitive); empty users → legacy six.
- [ ] **Step 2:** FAIL. **Step 3:** implement; then wire:
  - `Dashboard.tsx`: `const { users } = useUserColors(); const payroll = useMemo(() => payrollColumns(users, services), [users, services]);` replace every `USER_COLUMNS` with `payroll.columns` and drop `as WorkerKey` casts; card label `worker.replace("_"," ") + (payroll.inactive.has(worker) ? " (Desactivado)" : "")`; pass `workers={payroll.columns}` and `inactiveWorkers={payroll.inactive}` to both `<AdminDataTable>` and `workers={payroll.columns.filter(c => !payroll.inactive.has(c))}` to `<DataModificationForm>`.
  - `AdminDataTable.tsx`: props `workers: string[]; inactiveWorkers?: Set<string>`; replace internal `USER_COLUMNS` with `workers`; `pageByUser` initial `{}`; `groupedData` memo deps `[data, workers]`; guard `groupedData[user] ?? []`; header appends a small "Desactivado" badge when `inactiveWorkers?.has(user)`.
  - `DataModificationForm.tsx`: prop `workers: string[]`; `useState(workers[0] ?? "")`, sync with `useEffect` when `workers` changes and current value missing; map `workers` in the select.
  - `excelService.ts`: functions that iterate `USER_COLUMNS` take an optional `columns: string[] = USER_COLUMNS` parameter; callers pass `payroll.columns` where available.
- [ ] **Step 4:** tests + build green; **Step 5:** commit `feat(dashboard): payroll employees come from the user directory`.

## Task 8: "Usuarios" page

**Files:** Create `FE/pages/Usuarios.tsx`, `FE/components/users/UserFormModal.tsx`, `FE/components/users/TempPasswordModal.tsx`, `FE/components/users/DeactivateModal.tsx`; Modify `FE/pages/Dashboard.tsx` (route `/usuarios`, admin-only like `/settings`), `FE/components/dashboard/DashboardLayout.tsx` (admin `NavItem` "Usuarios" with `Users` icon — reuse import — placed before "Configuración").

Behavior (from spec §3): table/cards with `UserAvatar`, name, username, role label (`admin`→Admin, `digitador`/`employee`→Digitador, `auxiliar`→Auxiliar), ganancias Sí/No, status pill (Activo / Desactivado / Debe cambiar contraseña), last connection (`es-DO` relative: "Ahora", "Hace N min", "Hace N h", "Hace N días", "—"); filter chips Activos/Desactivados/Todos; actions Editar, Contraseña, Desactivar (active) / Reactivar (inactive). Hide Desactivar for the current user. Modals:
- `UserFormModal` (create/edit): fields per spec; `in_payroll` default true for digitador/auxiliar, false for admin when role changes (only while creating); temp password with "Generar" (8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789` via `crypto.getRandomValues`); shows backend `error` on failure; on success shows the temporary password once with "Copiar".
- `TempPasswordModal`: same generator, success message "Deberá cambiarla al entrar".
- `DeactivateModal`: loads `assignments`, text "{name} tiene {clients} clientes/chats y {cases} casos asignados.", select of active users except target (+ "Sin asignar"), red "Desactivar" button; shows backend error.
After any mutation: reload list and `useUserColors().refresh()`.

- [ ] **Step 1: failing RTL test** `FE/pages/Usuarios.test.tsx` (mock `adminUsersAPI`, `useAuth` → admin id 1, `useUserColors` → `{ appearanceOf: () => toAppearance(undefined), refresh: vi.fn(), users: [] }`): renders rows from `list`; "Desactivar" hidden on own row; clicking "Desactivar" on Marleni shows assignment counts from `assignments` mock and calls `deactivate(3, 2)` after choosing Hengi and confirming; backend 400 `LAST_ADMIN` message is displayed.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** tests + build. **Step 5:** commit `feat(dashboard): Usuarios admin page`.

## Task 9: Forced password change + inactive handling

**Files:** Create `FE/components/ForcePasswordChange.tsx`, `FE/components/ForcePasswordChange.test.tsx`; Modify `FE/context/AuthContext.tsx` (`ProtectedRoute`), `FE/services/api.ts` (response interceptor), `FE/pages/Login.tsx` (inactive notice), `FE/context/UserColorsContext.tsx` (skip polling while `user.mustChangePassword`).

- `ProtectedRoute`: `if (user.mustChangePassword) return <ForcePasswordChange />;`
- `ForcePasswordChange`: branded card "Crea tu contraseña" (fields: contraseña temporal, nueva, confirmar; same client validation as MiCuenta), calls `authAPI.changePassword`, then `refreshUser()`; "Cerrar sesión" link calls `logout`.
- `api.ts` response interceptor: if `error.response?.data?.code === "USER_INACTIVE"` → remove `token` from both storages and `rememberMe`, then `window.location.assign("/login?inactive=1")` (guard: not already on `/login`).
- `Login.tsx`: if `new URLSearchParams(location.search).get("inactive")` show error "Usuario desactivado. Contacta al administrador." on mount.

- [ ] **Step 1: failing tests**: ProtectedRoute with `mustChangePassword` renders "Crea tu contraseña" and not children; submitting mismatched confirmation shows error without calling API; success calls `changePassword` then `refreshUser`; Login with `?inactive=1` shows the message (wrap in `MemoryRouter initialEntries={["/login?inactive=1"]}`).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** tests + build. **Step 5:** commit `feat(dashboard): forced password change screen and deactivated-session handling`.

## Task 10: Final review + release (owner approval at each outward step)

- [ ] Whole-branch review (fresh reviewer) → fix Critical/Important with RED→GREEN.
- [ ] Backend phase 1: migration-only branch from `main` → owner pushes → owner runs migrations in Configuración.
- [ ] Backend phase 2: merge `feat/user-management` into `main` locally, full tests → owner pushes.
- [ ] Frontend dev: merge into `main`, tests + build, push (Netlify `guruweb-development`).
- [ ] QA on dev with owner: create test user → forced password screen → deactivate with reassignment → login blocked → reactivate.
- [ ] Production frontend: port colors/avatars + user management to `guruweb-frontend` with owner approval; owner deploys.
- [ ] Admin guide PDF on Desktop with real screenshots.
