# Colores y avatares por usuario + "Mi cuenta" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each dashboard user picks a unique color (12-color palette) and a unique animal avatar (🦉 reserved for admin), both visible to every user wherever the dashboard shows who owns/was assigned something, plus a "Mi cuenta" page to change color, avatar and password.

**Architecture:** Backend stores `users.color` / `users.avatar` (palette keys, unique indexes) and exposes them through existing user payloads plus `PUT /api/auth/me/appearance`. Frontend loads the user directory once (`GET /api/dashboard/users`) into a `UserColorsContext` that polls every 60 s; all screens resolve color/avatar by `user_id` or `data_column` through that context and render via `UserAvatar` / `UserBadge`.

**Tech Stack:** Backend: Node 20, Express 4, `pg`, `node:test` (built-in). Frontend: React 19, Vite 7, TypeScript, Tailwind v4, axios, vitest (new devDependency).

**Spec:** `docs/superpowers/specs/2026-09-26-user-colors-settings-design.md` (repo `guru-frontend-dev`). PDF for the owner: `~/Desktop/Gurú - Colores, avatares y Mi cuenta.pdf`.

**Repos:**
- Backend: `/Users/jay/Documents/W/guru-soluciones/guruweb-backend` (branch `main`, Railway deploys from it — **shared by dev and prod frontends and the production DB**).
- Frontend: `/Users/jay/Documents/W/guru-soluciones/guru-frontend-dev` (branch `main`, Netlify test site). Dashboard app at `apps/dashboard`, source root `apps/dashboard/src` (abbreviated `FE/` below; backend root abbreviated `BE/`).

## Global Constraints

- Palette keys (order matters for auto-assignment): `green, yellow, red, purple, orange, pink, teal, cyan, blue, indigo, lime, brown`.
- Palette hex / text: green `#22c55e`/`#ffffff`, yellow `#facc15`/`#000000`, red `#ef4444`/`#ffffff`, purple `#9333ea`/`#ffffff`, orange `#f97316`/`#ffffff`, pink `#ec4899`/`#ffffff`, teal `#14b8a6`/`#ffffff`, cyan `#06b6d4`/`#000000`, blue `#3b82f6`/`#ffffff`, indigo `#6366f1`/`#ffffff`, lime `#84cc16`/`#000000`, brown `#92400e`/`#ffffff`.
- Avatar keys → emoji: cow 🐄, cat 🐈, dog 🐕, horse 🐎, pig 🐖, sheep 🐑, goat 🐐, rooster 🐓, duck 🦆, rabbit 🐇, turtle 🐢, dolphin 🐬, lion 🦁, tiger 🐯, bear 🐻, panda 🐼, fox 🦊, frog 🐸, penguin 🐧, parrot 🦜, bee 🐝, butterfly 🦋, elephant 🐘, giraffe 🦒, **owl 🦉 (admin only)**.
- DB stores keys (`"green"`, `"cow"`), never hex or emoji.
- Seed: HENGI→green, MARLENI→yellow, ISRAEL→red, THAICAR→purple, AUXILIAR_I→orange, AUXILIAR_II→pink (by `UPPER(data_column)`); other users get first free color by `id`; `owl` → lowest-`id` user with `role='admin'`.
- Uniqueness: no two users share a color or an avatar (DB unique partial indexes `users_color_unique`, `users_avatar_unique`).
- User-facing copy is Spanish: `"Ese color lo acaba de tomar otro usuario"`, `"Ese animal lo acaba de tomar otro usuario"`, `"Reservado para el admin"`, `"La contraseña actual es incorrecta"`.
- Password min length 6 (existing backend rule).
- Wrong current password must return **400** (not 401) — the frontend axios interceptor wipes the session token on any 401 when "remember me" is off (`FE/services/api.ts:44-59`).
- Directory refresh: every 60 s and on window focus / tab visible.
- All backend changes are additive; the current production frontend must keep working unchanged.
- Backend tests must only ever touch a **local** Postgres DB (guard refuses any `DATABASE_URL` not on localhost/127.0.0.1).
- Out of scope: making `USER_COLUMNS` dynamic; photo uploads; custom colors.

## Review Focus

- A user types the wrong current password in "Mi cuenta" → sees "La contraseña actual es incorrecta" and **stays logged in** (Task 4 test asserts 400; Task 8 handles 400).
- Two users pick the same color/animal at nearly the same time → the loser gets 409 with the Spanish message, never a 500 (Task 3 test hits the unique index; Task 4 test asserts 409).
- An employee calls the API directly with `avatar: "owl"` → 403, and the owl picker tile is disabled for them in the UI (Task 1 + Task 4 tests; Task 8 UI).
- A record references a user id that is not in the directory (deleted user, directory not loaded yet) or a user with no avatar → gray fallback + initial letter, no crash (Task 5 tests `toAppearance` fallback).
- `data_column` casing differs (`"hengi"` vs `"HENGI"`) between services rows and users → same color resolved (Task 5 test `findUserByColumn` case-insensitive).

---

## File Structure

**Backend (`guruweb-backend`)**
| File | Responsibility |
|------|----------------|
| Create `src/config/appearance.js` | Palette + avatar key lists, `validateAppearance()` (pure) |
| Create `migrations/20260926_user_appearance.sql` | Columns, unique indexes, seeding |
| Modify `src/models/User.js` | `updateAppearance`, `listDirectory`, `assignFirstFreeColor`, `toPublicUser`; `create` auto-assigns color |
| Modify `src/routes/auth.js` | login/me use `toPublicUser`; `PUT /me/appearance`; change-password wrong-current → 400 |
| Modify `src/routes/dashboard.js:103-111` | `/users` returns directory fields |
| Modify `src/routes/admin.js:56-70` | `/users` adds `color, avatar, data_column` |
| Create `test/helpers/db.js`, `test/fixtures/users_schema.sql` | Local-only test DB setup |
| Create `test/appearance.test.js`, `test/migration.test.js`, `test/user-appearance.test.js`, `test/auth-appearance.test.js` | Tests |
| Modify `package.json` | `"test": "node --test test/"` |

**Frontend (`guru-frontend-dev/apps/dashboard`)**
| File | Responsibility |
|------|----------------|
| Create `src/lib/userColors.ts` | Palette, avatars, `resolveColor`, `resolveAvatar`, `initialOf`, `findUserByColumn`, `toAppearance` (pure) |
| Create `src/lib/userColors.test.ts` | vitest unit tests |
| Create `src/context/UserColorsContext.tsx` | Directory fetch + polling; `appearanceOf`, `appearanceOfColumn` |
| Create `src/components/UserAvatar.tsx`, `src/components/UserBadge.tsx` | Rendering |
| Create `src/pages/MiCuenta.tsx` | Avatar/color picker + password form |
| Modify `src/context/AuthContext.tsx` | `User` type + `refreshUser()` |
| Modify `src/services/api.ts` | `authAPI.updateAppearance`, `authAPI.changePassword` |
| Modify `src/main.tsx` | Mount `UserColorsProvider` |
| Modify `src/pages/Dashboard.tsx` | `/mi-cuenta` route; stats cards use accent |
| Modify `src/components/dashboard/StatsCard.tsx` | `accent` + `icon` props |
| Modify `src/components/dashboard/DashboardLayout.tsx` | Nav item + sidebar avatar |
| Modify `src/components/dashboard/AdminDataTable.tsx` | Replace hardcoded worker styles |
| Modify `src/components/dashboard/DataCharts.tsx` | Per-employee colors |
| Modify `src/pages/BotMessages.tsx`, `BotClients.tsx`, `Cotizaciones.tsx`, `Cases.tsx`, `src/services/botApi.ts` | Assignee/creator badges |
| Modify `package.json` (dashboard) | vitest + `"test"` script |

---

## Task 0: Local test database (one-time setup, no commit)

- [ ] **Step 1: Start local Postgres 14 and create the test DB**

```bash
pg_ctl -D /opt/homebrew/var/postgresql@14 -l /tmp/pg14.log start || true
createdb guru_test 2>/dev/null || true
psql -d guru_test -c "select 1"
```
Expected: `?column? 1`. Stop it at the end of the work with `pg_ctl -D /opt/homebrew/var/postgresql@14 stop`.

---

## Task 1: Backend appearance catalog + validation (pure)

**Files:**
- Create: `BE/src/config/appearance.js`
- Create: `BE/test/appearance.test.js`
- Modify: `BE/package.json` (scripts)

**Interfaces:**
- Produces: `COLOR_KEYS: string[]`, `AVATAR_KEYS: string[]`, `ADMIN_ONLY_AVATAR = 'owl'`, `SEED_COLORS: Record<string,string>`, `validateAppearance({ role, color, avatar }) → { ok: true } | { ok: false, status: 400|403, code: string, error: string }`. `color`/`avatar` `undefined` = "not changing"; `avatar: null` = clear avatar; `color: null` is invalid.

- [ ] **Step 1: Add test script** — in `BE/package.json` `"scripts"` add `"test": "node --test test/"`.

- [ ] **Step 2: Write the failing test** `BE/test/appearance.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { COLOR_KEYS, AVATAR_KEYS, ADMIN_ONLY_AVATAR, validateAppearance } = require('../src/config/appearance');

test('palette has 12 colors in fixed order', () => {
  assert.deepEqual(COLOR_KEYS, ['green','yellow','red','purple','orange','pink','teal','cyan','blue','indigo','lime','brown']);
});

test('avatars: 24 animals + owl', () => {
  assert.equal(AVATAR_KEYS.length, 25);
  assert.ok(AVATAR_KEYS.includes('cow'));
  assert.equal(ADMIN_ONLY_AVATAR, 'owl');
});

test('requires at least one field', () => {
  const r = validateAppearance({ role: 'digitador' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
});

test('valid color and avatar', () => {
  assert.deepEqual(validateAppearance({ role: 'digitador', color: 'teal', avatar: 'cow' }), { ok: true });
});

test('unknown color → 400 INVALID_COLOR', () => {
  const r = validateAppearance({ role: 'digitador', color: '#ff0000' });
  assert.equal(r.status, 400);
  assert.equal(r.code, 'INVALID_COLOR');
});

test('null color → 400', () => {
  assert.equal(validateAppearance({ role: 'admin', color: null }).status, 400);
});

test('unknown avatar → 400 INVALID_AVATAR', () => {
  assert.equal(validateAppearance({ role: 'digitador', avatar: 'unicorn' }).code, 'INVALID_AVATAR');
});

test('avatar null clears → ok', () => {
  assert.deepEqual(validateAppearance({ role: 'digitador', avatar: null }), { ok: true });
});

test('owl for non-admin → 403 OWL_RESERVED', () => {
  const r = validateAppearance({ role: 'digitador', avatar: 'owl' });
  assert.equal(r.status, 403);
  assert.equal(r.code, 'OWL_RESERVED');
  assert.equal(r.error, 'Reservado para el admin');
});

test('owl for admin → ok', () => {
  assert.deepEqual(validateAppearance({ role: 'admin', avatar: 'owl' }), { ok: true });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd BE && npm test`
Expected: FAIL — `Cannot find module '../src/config/appearance'`.

- [ ] **Step 4: Implement** `BE/src/config/appearance.js`

```js
// Keys only — hex values and emoji live in the frontend (FE/src/lib/userColors.ts).
const COLOR_KEYS = ['green', 'yellow', 'red', 'purple', 'orange', 'pink', 'teal', 'cyan', 'blue', 'indigo', 'lime', 'brown'];

const AVATAR_KEYS = [
  'cow', 'cat', 'dog', 'horse', 'pig', 'sheep', 'goat', 'rooster', 'duck', 'rabbit', 'turtle', 'dolphin',
  'lion', 'tiger', 'bear', 'panda', 'fox', 'frog', 'penguin', 'parrot', 'bee', 'butterfly', 'elephant', 'giraffe',
  'owl',
];

const ADMIN_ONLY_AVATAR = 'owl';

// Current hardcoded dashboard colors, keyed by users.data_column
const SEED_COLORS = {
  HENGI: 'green',
  MARLENI: 'yellow',
  ISRAEL: 'red',
  THAICAR: 'purple',
  AUXILIAR_I: 'orange',
  AUXILIAR_II: 'pink',
};

function fail(status, code, error) {
  return { ok: false, status, code, error };
}

function validateAppearance({ role, color, avatar }) {
  if (color === undefined && avatar === undefined) {
    return fail(400, 'NOTHING_TO_UPDATE', 'Debes enviar color o avatar');
  }
  if (color !== undefined && !COLOR_KEYS.includes(color)) {
    return fail(400, 'INVALID_COLOR', 'Color no válido');
  }
  if (avatar !== undefined && avatar !== null && !AVATAR_KEYS.includes(avatar)) {
    return fail(400, 'INVALID_AVATAR', 'Avatar no válido');
  }
  if (avatar === ADMIN_ONLY_AVATAR && role !== 'admin') {
    return fail(403, 'OWL_RESERVED', 'Reservado para el admin');
  }
  return { ok: true };
}

module.exports = { COLOR_KEYS, AVATAR_KEYS, ADMIN_ONLY_AVATAR, SEED_COLORS, validateAppearance };
```

- [ ] **Step 5: Run tests** — `npm test` → all 10 PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json src/config/appearance.js test/appearance.test.js
git commit -m "feat(users): appearance catalog and validation (colors, avatars, owl reserved)"
```

---

## Task 2: Migration — columns, unique indexes, seeding

**Files:**
- Create: `BE/migrations/20260926_user_appearance.sql`
- Create: `BE/test/fixtures/users_schema.sql`, `BE/test/helpers/db.js`, `BE/test/migration.test.js`

**Interfaces:**
- Consumes: key lists from Task 1 (duplicated as SQL literals — keep in sync).
- Produces: `users.color VARCHAR(20)`, `users.avatar VARCHAR(20)`, indexes `users_color_unique`, `users_avatar_unique`. Test helpers `resetDb()`, `pool`, `runSqlFile(path)` used by Tasks 3–4.

- [ ] **Step 1: Test helper** `BE/test/helpers/db.js` (must be required **first** in every DB test so env is set before `src/db/pool` loads)

```js
const fs = require('fs');
const path = require('path');

const url = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/guru_test';
if (!/@?(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  throw new Error(`Refusing to run tests against non-local database: ${url}`);
}
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const pool = require('../../src/db/pool');

async function runSqlFile(relPath) {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');
  await pool.query(sql);
}

async function resetDb() {
  await pool.query('DROP TABLE IF EXISTS users CASCADE');
  await runSqlFile('test/fixtures/users_schema.sql');
}

module.exports = { pool, runSqlFile, resetDb };
```

- [ ] **Step 2: Fixture** `BE/test/fixtures/users_schema.sql` (mirrors production columns)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  email VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'digitador',
  data_column VARCHAR(50),
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 3: Write the failing test** `BE/test/migration.test.js`

```js
const { pool, runSqlFile, resetDb } = require('./helpers/db');
const test = require('node:test');
const assert = require('node:assert/strict');

const MIGRATION = 'migrations/20260926_user_appearance.sql';

async function seedUsers() {
  await pool.query(`
    INSERT INTO users (username, password_hash, name, role, data_column) VALUES
      ('admin',   'x', 'Admin',   'admin',     NULL),
      ('hengi',   'x', 'Hengi',   'digitador', 'HENGI'),
      ('marleni', 'x', 'Marleni', 'digitador', 'marleni'),
      ('israel',  'x', 'Israel',  'digitador', 'ISRAEL'),
      ('thaicar', 'x', 'Thaicar', 'digitador', 'THAICAR'),
      ('aux1',    'x', 'Aux I',   'auxiliar',  'AUXILIAR_I'),
      ('aux2',    'x', 'Aux II',  'auxiliar',  'AUXILIAR_II'),
      ('admin2',  'x', 'Admin 2', 'admin',     NULL)`);
}

test.beforeEach(async () => { await resetDb(); await seedUsers(); });
test.after(async () => { await pool.end(); });

test('seeds current colors by data_column (case-insensitive) and first free for the rest', async () => {
  await runSqlFile(MIGRATION);
  const { rows } = await pool.query('SELECT username, color FROM users ORDER BY id');
  const byName = Object.fromEntries(rows.map((r) => [r.username, r.color]));
  assert.equal(byName.hengi, 'green');
  assert.equal(byName.marleni, 'yellow');
  assert.equal(byName.israel, 'red');
  assert.equal(byName.thaicar, 'purple');
  assert.equal(byName.aux1, 'orange');
  assert.equal(byName.aux2, 'pink');
  assert.equal(byName.admin, 'teal');   // first free, lowest id
  assert.equal(byName.admin2, 'cyan');  // next free
});

test('owl goes to the lowest-id admin only; others have no avatar', async () => {
  await runSqlFile(MIGRATION);
  const { rows } = await pool.query('SELECT username, avatar FROM users WHERE avatar IS NOT NULL');
  assert.deepEqual(rows, [{ username: 'admin', avatar: 'owl' }]);
});

test('is idempotent (runs twice without error or changes)', async () => {
  await runSqlFile(MIGRATION);
  const before = (await pool.query('SELECT id, color, avatar FROM users ORDER BY id')).rows;
  await runSqlFile(MIGRATION);
  const after = (await pool.query('SELECT id, color, avatar FROM users ORDER BY id')).rows;
  assert.deepEqual(after, before);
});

test('unique indexes reject duplicate color and avatar', async () => {
  await runSqlFile(MIGRATION);
  await assert.rejects(pool.query(`UPDATE users SET color = 'green' WHERE username = 'israel'`), { code: '23505', constraint: 'users_color_unique' });
  await assert.rejects(pool.query(`UPDATE users SET avatar = 'owl' WHERE username = 'hengi'`), { code: '23505', constraint: 'users_avatar_unique' });
});
```

- [ ] **Step 4: Run to verify it fails** — `npm test` → FAIL (`ENOENT ... 20260926_user_appearance.sql`).

- [ ] **Step 5: Implement** `BE/migrations/20260926_user_appearance.sql`

```sql
-- Per-user color + avatar (keys; see src/config/appearance.js). Idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS users_color_unique ON users (color) WHERE color IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_avatar_unique ON users (avatar) WHERE avatar IS NOT NULL;

-- 1) Keep today's hardcoded colors
UPDATE users u SET color = s.color
FROM (VALUES ('HENGI','green'), ('MARLENI','yellow'), ('ISRAEL','red'),
             ('THAICAR','purple'), ('AUXILIAR_I','orange'), ('AUXILIAR_II','pink')) AS s(col, color)
WHERE UPPER(u.data_column) = s.col
  AND u.color IS NULL
  AND NOT EXISTS (SELECT 1 FROM users x WHERE x.color = s.color);

-- 2) Everyone else: first free palette color, in id order
DO $$
DECLARE
  palette TEXT[] := ARRAY['green','yellow','red','purple','orange','pink','teal','cyan','blue','indigo','lime','brown'];
  r RECORD;
  free_color TEXT;
BEGIN
  FOR r IN SELECT id FROM users WHERE color IS NULL ORDER BY id LOOP
    SELECT p.c INTO free_color
    FROM unnest(palette) WITH ORDINALITY AS p(c, ord)
    WHERE p.c NOT IN (SELECT color FROM users WHERE color IS NOT NULL)
    ORDER BY p.ord
    LIMIT 1;
    EXIT WHEN free_color IS NULL;
    UPDATE users SET color = free_color WHERE id = r.id;
  END LOOP;
END $$;

-- 3) Owl belongs to the main admin
UPDATE users SET avatar = 'owl'
WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE avatar = 'owl');
```

- [ ] **Step 6: Run tests** — `npm test` → all PASS.

- [ ] **Step 7: Commit**

```bash
git add migrations/20260926_user_appearance.sql test/helpers/db.js test/fixtures/users_schema.sql test/migration.test.js
git commit -m "feat(users): migration for color/avatar with unique indexes and seeding"
```

---

## Task 3: User model — appearance methods

**Files:**
- Modify: `BE/src/models/User.js`
- Create: `BE/test/user-appearance.test.js`

**Interfaces:**
- Consumes: `COLOR_KEYS` (Task 1), migration (Task 2), test helpers (Task 2).
- Produces:
  - `User.toPublicUser(row) → { id, username, email, name, role, dataColumn, color, avatar }`
  - `User.updateAppearance(id, { color?, avatar? }) → row | null` (throws pg error `code '23505'` with `constraint` on conflict)
  - `User.listDirectory() → Array<{ id, name, username, data_column, role, color, avatar }>`
  - `User.assignFirstFreeColor(id) → string | null`
  - `User.create(...)` now returns row including `color` (auto-assigned) and `avatar`.

- [ ] **Step 1: Write the failing test** `BE/test/user-appearance.test.js`

```js
const { pool, runSqlFile, resetDb } = require('./helpers/db');
const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');

test.beforeEach(async () => {
  await resetDb();
  await pool.query(`INSERT INTO users (username, password_hash, name, role, data_column) VALUES
    ('admin','x','Admin','admin',NULL), ('hengi','x','Hengi','digitador','HENGI'), ('israel','x','Israel','digitador','ISRAEL')`);
  await runSqlFile('migrations/20260926_user_appearance.sql');
});
test.after(async () => { await pool.end(); });

test('updateAppearance changes color and avatar', async () => {
  const hengi = await User.findByUsername('hengi');
  const row = await User.updateAppearance(hengi.id, { color: 'blue', avatar: 'cow' });
  assert.equal(row.color, 'blue');
  assert.equal(row.avatar, 'cow');
});

test('updateAppearance only touches provided fields; avatar null clears', async () => {
  const hengi = await User.findByUsername('hengi');
  await User.updateAppearance(hengi.id, { avatar: 'cat' });
  const row = await User.updateAppearance(hengi.id, { avatar: null });
  assert.equal(row.avatar, null);
  assert.equal(row.color, 'green');
});

test('taken color throws unique violation', async () => {
  const hengi = await User.findByUsername('hengi');
  await assert.rejects(User.updateAppearance(hengi.id, { color: 'red' }), { code: '23505', constraint: 'users_color_unique' });
});

test('re-saving own color is fine', async () => {
  const hengi = await User.findByUsername('hengi');
  const row = await User.updateAppearance(hengi.id, { color: 'green' });
  assert.equal(row.color, 'green');
});

test('listDirectory exposes public fields only', async () => {
  const users = await User.listDirectory();
  assert.equal(users.length, 3);
  assert.deepEqual(Object.keys(users[0]).sort(), ['avatar', 'color', 'data_column', 'id', 'name', 'role', 'username']);
});

test('create auto-assigns first free color', async () => {
  const u = await User.create({ email: 'n@x.com', password: 'secret1', name: 'Nuevo', username: 'nuevo' });
  assert.equal(u.color, 'purple'); // hengi=green, israel=red, admin=yellow (first free) → purple is next
});

test('toPublicUser shape', () => {
  const pub = User.toPublicUser({ id: 1, username: 'h', email: null, name: null, role: 'digitador', data_column: 'HENGI', color: 'green', avatar: null, password_hash: 'x' });
  assert.deepEqual(pub, { id: 1, username: 'h', email: 'h', name: 'h', role: 'digitador', dataColumn: 'HENGI', color: 'green', avatar: null });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (`User.updateAppearance is not a function`).

- [ ] **Step 3: Implement** — in `BE/src/models/User.js`:

At the top, after `const SALT_ROUNDS = 10;`:
```js
const { COLOR_KEYS } = require('../config/appearance');
```

Replace the `create` method with:
```js
  async create({ email, password, name, role = 'digitador', username, data_column }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, username, data_column)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, username, data_column, color, avatar, created_at`,
      [email, passwordHash, name, role, username || null, data_column || null]
    );
    const user = rows[0];
    try {
      user.color = await User.assignFirstFreeColor(user.id);
    } catch (err) {
      console.error('[User.create] could not auto-assign color:', err.message);
    }
    return user;
  },
```

Add these methods inside the `User` object (before the closing `};`):
```js
  toPublicUser(user) {
    return {
      id: user.id,
      username: user.username || user.email,
      email: user.email || user.username,
      name: user.name || user.username,
      role: user.role,
      dataColumn: user.data_column,
      color: user.color || null,
      avatar: user.avatar || null,
    };
  },

  async assignFirstFreeColor(id) {
    const { rows } = await pool.query(
      `UPDATE users SET color = (
         SELECT p.c FROM unnest($2::text[]) WITH ORDINALITY AS p(c, ord)
         WHERE p.c NOT IN (SELECT color FROM users WHERE color IS NOT NULL)
         ORDER BY p.ord LIMIT 1)
       WHERE id = $1 AND color IS NULL
       RETURNING color`,
      [id, COLOR_KEYS]
    );
    return rows[0]?.color ?? null;
  },

  async updateAppearance(id, { color, avatar }) {
    const sets = [];
    const values = [];
    if (color !== undefined) { values.push(color); sets.push(`color = $${values.length}`); }
    if (avatar !== undefined) { values.push(avatar); sets.push(`avatar = $${values.length}`); }
    if (sets.length === 0) return User.findById(id);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async listDirectory() {
    const { rows } = await pool.query(
      `SELECT id,
              COALESCE(NULLIF(name, ''), NULLIF(data_column, ''), username) AS name,
              username, data_column, role, color, avatar
       FROM users
       ORDER BY id`
    );
    return rows;
  },
```

- [ ] **Step 4: Run tests** — `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/User.js test/user-appearance.test.js
git commit -m "feat(users): model methods for appearance, directory and color auto-assign"
```

---

## Task 4: Backend routes

**Files:**
- Modify: `BE/src/routes/auth.js` (login ~line 108-118, `/me` ~122-140, change-password ~183-217, new route)
- Modify: `BE/src/routes/dashboard.js:103-111`
- Modify: `BE/src/routes/admin.js:56-70`
- Create: `BE/test/auth-appearance.test.js`

**Interfaces:**
- Consumes: `validateAppearance` (Task 1), `User.toPublicUser/updateAppearance/listDirectory` (Task 3).
- Produces (HTTP):
  - `PUT /api/auth/me/appearance` body `{ color?, avatar? }` → `200 { user: PublicUser }` | `400 {error, code}` | `403 {error:'Reservado para el admin', code:'OWL_RESERVED'}` | `409 {error, code:'COLOR_TAKEN'|'AVATAR_TAKEN'}`
  - `PUT /api/auth/change-password` wrong current → `400 { error: 'La contraseña actual es incorrecta', code: 'WRONG_CURRENT_PASSWORD' }`
  - `GET /api/auth/me`, `POST /api/auth/login` → `user` includes `color`, `avatar`
  - `GET /api/dashboard/users` → `{ users: [{ id, name, username, data_column, role, color, avatar }] }`
  - `GET /api/admin/users` → adds `data_column, color, avatar`

- [ ] **Step 1: Write the failing test** `BE/test/auth-appearance.test.js`

```js
const { pool, runSqlFile, resetDb } = require('./helpers/db');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { generateToken } = require('../src/middleware/auth');

let server, base, tokens = {};

test.before(async () => {
  await resetDb();
  const hash = await bcrypt.hash('secret1', 4);
  await pool.query(`INSERT INTO users (username, email, password_hash, name, role, data_column) VALUES
    ('admin','admin@x.com',$1,'Admin','admin',NULL),
    ('hengi','hengi@x.com',$1,'Hengi','digitador','HENGI'),
    ('israel','israel@x.com',$1,'Israel','digitador','ISRAEL')`, [hash]);
  await runSqlFile('migrations/20260926_user_appearance.sql');
  const { rows } = await pool.query('SELECT id, username, email, role FROM users');
  for (const u of rows) tokens[u.username] = generateToken(u);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/dashboard', require('../src/routes/dashboard'));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => { server.close(); await pool.end(); });

const call = (method, path, who, body) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[who]}` },
    body: body ? JSON.stringify(body) : undefined,
  });

test('PUT /me/appearance updates own color and avatar', async () => {
  const res = await call('PUT', '/api/auth/me/appearance', 'hengi', { color: 'blue', avatar: 'cow' });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.color, 'blue');
  assert.equal(user.avatar, 'cow');
  assert.equal(user.dataColumn, 'HENGI');
  assert.equal(user.password_hash, undefined);
});

test('taken color → 409 COLOR_TAKEN with Spanish message', async () => {
  const res = await call('PUT', '/api/auth/me/appearance', 'israel', { color: 'blue' });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: 'Ese color lo acaba de tomar otro usuario', code: 'COLOR_TAKEN' });
});

test('taken avatar → 409 AVATAR_TAKEN', async () => {
  const res = await call('PUT', '/api/auth/me/appearance', 'israel', { avatar: 'cow' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'AVATAR_TAKEN');
});

test('employee asking for owl → 403', async () => {
  const res = await call('PUT', '/api/auth/me/appearance', 'israel', { avatar: 'owl' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Reservado para el admin');
});

test('invalid color → 400', async () => {
  const res = await call('PUT', '/api/auth/me/appearance', 'israel', { color: 'magenta' });
  assert.equal(res.status, 400);
});

test('GET /me includes color and avatar', async () => {
  const res = await call('GET', '/api/auth/me', 'admin');
  const { user } = await res.json();
  assert.equal(user.avatar, 'owl');
  assert.ok(user.color);
});

test('GET /dashboard/users works for employees and exposes appearance', async () => {
  const res = await call('GET', '/api/dashboard/users', 'israel');
  assert.equal(res.status, 200);
  const { users } = await res.json();
  const hengi = users.find((u) => u.username === 'hengi');
  assert.equal(hengi.color, 'blue');
  assert.equal(hengi.avatar, 'cow');
  assert.equal(hengi.data_column, 'HENGI');
  assert.equal(hengi.password_hash, undefined);
});

test('change-password with wrong current → 400 (never 401)', async () => {
  const res = await call('PUT', '/api/auth/change-password', 'israel', { currentPassword: 'nope', newPassword: 'another1' });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'La contraseña actual es incorrecta', code: 'WRONG_CURRENT_PASSWORD' });
});

test('change-password happy path', async () => {
  const res = await call('PUT', '/api/auth/change-password', 'israel', { currentPassword: 'secret1', newPassword: 'another1' });
  assert.equal(res.status, 200);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (404 on `/me/appearance`, 401 on wrong password, missing fields).

- [ ] **Step 3: Implement `auth.js`**

Top of file, after existing requires:
```js
const { validateAppearance } = require('../config/appearance');
```

In `POST /login`, replace the `user: { id: ..., dataColumn: user.data_column, },` object in `res.json(...)` with:
```js
      user: User.toPublicUser(user),
```

In `GET /me`, replace the whole `res.json({ user: { ... } });` with:
```js
    res.json({ user: User.toPublicUser(user) });
```

In `PUT /change-password`, replace:
```js
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
```
with:
```js
    if (!valid) {
      // 400, not 401: the dashboard treats 401 as an expired session and logs the user out
      return res.status(400).json({ error: 'La contraseña actual es incorrecta', code: 'WRONG_CURRENT_PASSWORD' });
    }
```

Add before `module.exports = router;`:
```js
router.put('/me/appearance', authenticate, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });

    const { color, avatar } = req.body || {};
    const check = validateAppearance({ role: me.role, color, avatar });
    if (!check.ok) {
      return res.status(check.status).json({ error: check.error, code: check.code });
    }

    const updated = await User.updateAppearance(me.id, { color, avatar });
    res.json({ user: User.toPublicUser(updated) });
  } catch (err) {
    if (err.code === '23505') {
      const isAvatar = err.constraint === 'users_avatar_unique';
      return res.status(409).json({
        error: isAvatar ? 'Ese animal lo acaba de tomar otro usuario' : 'Ese color lo acaba de tomar otro usuario',
        code: isAvatar ? 'AVATAR_TAKEN' : 'COLOR_TAKEN',
      });
    }
    console.error('Update appearance error:', err);
    res.status(500).json({ error: 'No se pudo guardar' });
  }
});
```

- [ ] **Step 4: Implement `dashboard.js`** — replace the `/users` handler body query (`BE/src/routes/dashboard.js:103-111`) with:

```js
router.get('/users', async (req, res) => {
  try {
    const users = await User.listDirectory();
    res.json({ users });
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});
```
and add `const User = require('../models/User');` to the requires at the top of `dashboard.js` if not present (check with `grep -n "models/User" src/routes/dashboard.js`).

- [ ] **Step 5: Implement `admin.js`** — in `GET /users` (`BE/src/routes/admin.js:56-70`) change the SELECT list to:
```sql
SELECT id, username, email,
       COALESCE(NULLIF(name, ''), NULLIF(data_column, ''), username) AS name,
       role, data_column, color, avatar, created_at
```

- [ ] **Step 6: Run tests** — `npm test` → all PASS (Tasks 1–4).

- [ ] **Step 7: Smoke-check the server still boots** — `node -e "require('./src/routes/auth'); require('./src/routes/dashboard'); require('./src/routes/admin'); console.log('ok')"` → `ok`.

- [ ] **Step 8: Commit**

```bash
git add src/routes/auth.js src/routes/dashboard.js src/routes/admin.js test/auth-appearance.test.js
git commit -m "feat(auth): appearance endpoint, color/avatar in user payloads, 400 on wrong current password"
```

---

## Task 5: Frontend appearance library (pure) + vitest

**Files:**
- Modify: `FE/../package.json` (`apps/dashboard/package.json`)
- Create: `FE/lib/userColors.ts`, `FE/lib/userColors.test.ts`

**Interfaces:**
- Produces:
```ts
export type ColorKey = "green"|"yellow"|"red"|"purple"|"orange"|"pink"|"teal"|"cyan"|"blue"|"indigo"|"lime"|"brown";
export type AvatarKey = "cow"|"cat"|"dog"|"horse"|"pig"|"sheep"|"goat"|"rooster"|"duck"|"rabbit"|"turtle"|"dolphin"|"lion"|"tiger"|"bear"|"panda"|"fox"|"frog"|"penguin"|"parrot"|"bee"|"butterfly"|"elephant"|"giraffe"|"owl";
export interface PaletteColor { label: string; bg: string; text: string }
export interface DirectoryUser { id: number; name: string | null; username: string | null; data_column: string | null; role: string; color: string | null; avatar: string | null }
export interface Appearance { color: PaletteColor; emoji: string | null; name: string; initial: string }
export const COLOR_PALETTE: Record<ColorKey, PaletteColor>;
export const COLOR_KEYS: ColorKey[];
export const AVATARS: Record<AvatarKey, { emoji: string; label: string }>;
export const AVATAR_KEYS: AvatarKey[];
export const ADMIN_ONLY_AVATAR: AvatarKey; // "owl"
export const FALLBACK_COLOR: PaletteColor;
export function resolveColor(key?: string | null): PaletteColor;
export function resolveAvatar(key?: string | null): string | null;
export function initialOf(name?: string | null): string;
export function findUserByColumn(users: DirectoryUser[], column?: string | null): DirectoryUser | undefined;
export function toAppearance(user: { name?: string | null; username?: string | null; color?: string | null; avatar?: string | null } | undefined, fallbackName?: string): Appearance;
```

- [ ] **Step 1: Install vitest** — `cd /Users/jay/Documents/W/guru-soluciones/guru-frontend-dev && npm install -D vitest@^3.2.0 -w apps/dashboard`, then in `apps/dashboard/package.json` `"scripts"` add `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test** `FE/lib/userColors.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  COLOR_KEYS, AVATAR_KEYS, FALLBACK_COLOR, resolveColor, resolveAvatar,
  initialOf, findUserByColumn, toAppearance, type DirectoryUser,
} from "./userColors";

const users: DirectoryUser[] = [
  { id: 1, name: "Admin", username: "admin", data_column: null, role: "admin", color: "teal", avatar: "owl" },
  { id: 2, name: "Hengi", username: "hengi", data_column: "HENGI", role: "digitador", color: "green", avatar: "cow" },
  { id: 3, name: null, username: "israel", data_column: "israel", role: "digitador", color: null, avatar: null },
];

describe("catalog", () => {
  it("has 12 colors and 25 avatars", () => {
    expect(COLOR_KEYS).toHaveLength(12);
    expect(AVATAR_KEYS).toHaveLength(25);
  });
});

describe("resolveColor", () => {
  it("returns palette entry", () => expect(resolveColor("yellow")).toEqual({ label: "Amarillo", bg: "#facc15", text: "#000000" }));
  it("falls back for unknown/null", () => {
    expect(resolveColor("magenta")).toBe(FALLBACK_COLOR);
    expect(resolveColor(null)).toBe(FALLBACK_COLOR);
  });
});

describe("resolveAvatar", () => {
  it("maps key to emoji", () => expect(resolveAvatar("owl")).toBe("🦉"));
  it("null for unknown", () => expect(resolveAvatar("unicorn")).toBeNull());
});

describe("initialOf", () => {
  it("uppercases first letter", () => expect(initialOf(" hengi")).toBe("H"));
  it("? for empty", () => expect(initialOf("")).toBe("?"));
});

describe("findUserByColumn", () => {
  it("is case-insensitive", () => {
    expect(findUserByColumn(users, "hengi")?.id).toBe(2);
    expect(findUserByColumn(users, "ISRAEL")?.id).toBe(3);
  });
  it("undefined for missing", () => expect(findUserByColumn(users, null)).toBeUndefined());
});

describe("toAppearance", () => {
  it("full user", () => {
    expect(toAppearance(users[1])).toEqual({ color: resolveColor("green"), emoji: "🐄", name: "Hengi", initial: "H" });
  });
  it("no name falls back to username; no avatar → null emoji", () => {
    const a = toAppearance(users[2]);
    expect(a.name).toBe("israel");
    expect(a.emoji).toBeNull();
    expect(a.color).toBe(FALLBACK_COLOR);
  });
  it("unknown user uses fallback name", () => {
    expect(toAppearance(undefined, "AUXILIAR_I")).toEqual({ color: FALLBACK_COLOR, emoji: null, name: "AUXILIAR_I", initial: "A" });
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npm test -w apps/dashboard` → FAIL (cannot resolve `./userColors`).

- [ ] **Step 4: Implement** `FE/lib/userColors.ts`

```ts
export type ColorKey =
  | "green" | "yellow" | "red" | "purple" | "orange" | "pink"
  | "teal" | "cyan" | "blue" | "indigo" | "lime" | "brown";

export type AvatarKey =
  | "cow" | "cat" | "dog" | "horse" | "pig" | "sheep" | "goat" | "rooster"
  | "duck" | "rabbit" | "turtle" | "dolphin" | "lion" | "tiger" | "bear" | "panda"
  | "fox" | "frog" | "penguin" | "parrot" | "bee" | "butterfly" | "elephant" | "giraffe"
  | "owl";

export interface PaletteColor {
  label: string;
  bg: string;
  text: string;
}

export interface DirectoryUser {
  id: number;
  name: string | null;
  username: string | null;
  data_column: string | null;
  role: string;
  color: string | null;
  avatar: string | null;
}

export interface Appearance {
  color: PaletteColor;
  emoji: string | null;
  name: string;
  initial: string;
}

// Must match BE/src/config/appearance.js (keys + order)
export const COLOR_PALETTE: Record<ColorKey, PaletteColor> = {
  green: { label: "Verde", bg: "#22c55e", text: "#ffffff" },
  yellow: { label: "Amarillo", bg: "#facc15", text: "#000000" },
  red: { label: "Rojo", bg: "#ef4444", text: "#ffffff" },
  purple: { label: "Morado", bg: "#9333ea", text: "#ffffff" },
  orange: { label: "Naranja", bg: "#f97316", text: "#ffffff" },
  pink: { label: "Rosado", bg: "#ec4899", text: "#ffffff" },
  teal: { label: "Teal", bg: "#14b8a6", text: "#ffffff" },
  cyan: { label: "Cyan", bg: "#06b6d4", text: "#000000" },
  blue: { label: "Azul", bg: "#3b82f6", text: "#ffffff" },
  indigo: { label: "Índigo", bg: "#6366f1", text: "#ffffff" },
  lime: { label: "Lima", bg: "#84cc16", text: "#000000" },
  brown: { label: "Marrón", bg: "#92400e", text: "#ffffff" },
};

export const COLOR_KEYS = Object.keys(COLOR_PALETTE) as ColorKey[];

export const AVATARS: Record<AvatarKey, { emoji: string; label: string }> = {
  cow: { emoji: "🐄", label: "Vaca" },
  cat: { emoji: "🐈", label: "Gato" },
  dog: { emoji: "🐕", label: "Perro" },
  horse: { emoji: "🐎", label: "Caballo" },
  pig: { emoji: "🐖", label: "Cerdo" },
  sheep: { emoji: "🐑", label: "Oveja" },
  goat: { emoji: "🐐", label: "Chivo" },
  rooster: { emoji: "🐓", label: "Gallo" },
  duck: { emoji: "🦆", label: "Pato" },
  rabbit: { emoji: "🐇", label: "Conejo" },
  turtle: { emoji: "🐢", label: "Tortuga" },
  dolphin: { emoji: "🐬", label: "Delfín" },
  lion: { emoji: "🦁", label: "León" },
  tiger: { emoji: "🐯", label: "Tigre" },
  bear: { emoji: "🐻", label: "Oso" },
  panda: { emoji: "🐼", label: "Panda" },
  fox: { emoji: "🦊", label: "Zorro" },
  frog: { emoji: "🐸", label: "Rana" },
  penguin: { emoji: "🐧", label: "Pingüino" },
  parrot: { emoji: "🦜", label: "Loro" },
  bee: { emoji: "🐝", label: "Abeja" },
  butterfly: { emoji: "🦋", label: "Mariposa" },
  elephant: { emoji: "🐘", label: "Elefante" },
  giraffe: { emoji: "🦒", label: "Jirafa" },
  owl: { emoji: "🦉", label: "Búho" },
};

export const AVATAR_KEYS = Object.keys(AVATARS) as AvatarKey[];

export const ADMIN_ONLY_AVATAR: AvatarKey = "owl";

export const FALLBACK_COLOR: PaletteColor = { label: "Sin color", bg: "#9ca3af", text: "#ffffff" };

export function resolveColor(key?: string | null): PaletteColor {
  return key && key in COLOR_PALETTE ? COLOR_PALETTE[key as ColorKey] : FALLBACK_COLOR;
}

export function resolveAvatar(key?: string | null): string | null {
  return key && key in AVATARS ? AVATARS[key as AvatarKey].emoji : null;
}

export function initialOf(name?: string | null): string {
  return (name || "").trim().charAt(0).toUpperCase() || "?";
}

export function findUserByColumn(users: DirectoryUser[], column?: string | null): DirectoryUser | undefined {
  if (!column) return undefined;
  const target = column.toUpperCase();
  return users.find((u) => (u.data_column || "").toUpperCase() === target);
}

export function toAppearance(
  user: { name?: string | null; username?: string | null; color?: string | null; avatar?: string | null } | undefined,
  fallbackName = "?",
): Appearance {
  const name = user?.name || user?.username || fallbackName;
  return {
    color: resolveColor(user?.color),
    emoji: resolveAvatar(user?.avatar),
    name,
    initial: initialOf(name),
  };
}
```

- [ ] **Step 5: Run tests** — `npm test -w apps/dashboard` → all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/package.json package-lock.json apps/dashboard/src/lib/userColors.ts apps/dashboard/src/lib/userColors.test.ts
git commit -m "feat(dashboard): user appearance palette/avatars library with tests"
```

---

## Task 6: Auth + directory context + avatar components

**Files:**
- Modify: `FE/services/api.ts` (`authAPI`, ~line 61-68)
- Modify: `FE/context/AuthContext.tsx`
- Create: `FE/context/UserColorsContext.tsx`
- Create: `FE/components/UserAvatar.tsx`, `FE/components/UserBadge.tsx`
- Modify: `FE/main.tsx`

**Interfaces:**
- Consumes: Task 5 library; backend `GET /dashboard/users`, `PUT /auth/me/appearance`, `PUT /auth/change-password`.
- Produces:
  - `authAPI.updateAppearance(data: { color?: string; avatar?: string | null })`, `authAPI.changePassword(currentPassword: string, newPassword: string)`
  - `useAuth()` adds `refreshUser(): Promise<void>`; `User` gains `name?, email?, color?: string | null, avatar?: string | null`
  - `useUserColors() → { users: DirectoryUser[]; appearanceOf(userId?: number | null): Appearance; appearanceOfColumn(column?: string | null): Appearance; refresh(): Promise<void> }`
  - `<UserAvatar appearance={Appearance} size?: "xs"|"sm"|"md"|"lg" className? />`
  - `<UserBadge userId?: number|null  label?: string  size?: "xs"|"sm" />` — renders nothing when `userId` is null/undefined.

- [ ] **Step 1: api.ts** — add to the `authAPI` object:

```ts
  updateAppearance: (data: { color?: string; avatar?: string | null }) =>
    api.put("/auth/me/appearance", data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put("/auth/change-password", { currentPassword, newPassword }),
```

- [ ] **Step 2: AuthContext.tsx** — extend the `User` interface:

```ts
interface User {
  id: number;
  username: string;
  name?: string;
  email?: string;
  role: UserRole;
  dataColumn: string | null;
  color?: string | null;
  avatar?: string | null;
}
```
Add `refreshUser: () => Promise<void>;` to `AuthContextType`. Inside `AuthProvider`, after `logout`:

```ts
  const refreshUser = async () => {
    const response = await authAPI.getCurrentUser();
    setUser(response.data.user || response.data);
  };
```
and add `refreshUser,` to the Provider `value` object.

- [ ] **Step 3: UserColorsContext.tsx**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { findUserByColumn, toAppearance, type Appearance, type DirectoryUser } from "../lib/userColors";

interface UserColorsContextType {
  users: DirectoryUser[];
  appearanceOf: (userId?: number | null) => Appearance;
  appearanceOfColumn: (column?: string | null) => Appearance;
  refresh: () => Promise<void>;
}

const UserColorsContext = createContext<UserColorsContextType | undefined>(undefined);

const REFRESH_MS = 60_000;

export const UserColorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard/users");
      setUsers(data.users || []);
    } catch (err) {
      console.error("[UserColors] failed to load users", err);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      return;
    }
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, refresh]);

  const value = useMemo<UserColorsContextType>(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      users,
      appearanceOf: (userId) => toAppearance(userId != null ? byId.get(Number(userId)) : undefined),
      appearanceOfColumn: (column) =>
        toAppearance(findUserByColumn(users, column), (column || "?").replace("_", " ")),
      refresh,
    };
  }, [users, refresh]);

  return <UserColorsContext.Provider value={value}>{children}</UserColorsContext.Provider>;
};

export function useUserColors(): UserColorsContextType {
  const ctx = useContext(UserColorsContext);
  if (!ctx) throw new Error("useUserColors must be used inside UserColorsProvider");
  return ctx;
}
```

- [ ] **Step 4: UserAvatar.tsx**

```tsx
import React from "react";
import type { Appearance } from "../lib/userColors";

const SIZES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-14 w-14 text-2xl",
} as const;

interface UserAvatarProps {
  appearance: Appearance;
  size?: keyof typeof SIZES;
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ appearance, size = "md", className = "" }) => (
  <span
    className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border-2 border-border font-black leading-none ${SIZES[size]} ${className}`}
    style={{ backgroundColor: appearance.color.bg, color: appearance.color.text }}
    title={appearance.name}
  >
    {appearance.emoji ?? appearance.initial}
  </span>
);

export default UserAvatar;
```

- [ ] **Step 5: UserBadge.tsx**

```tsx
import React from "react";
import UserAvatar from "./UserAvatar";
import { useUserColors } from "../context/UserColorsContext";

interface UserBadgeProps {
  userId?: number | null;
  label?: string;
  size?: "xs" | "sm";
  className?: string;
}

const UserBadge: React.FC<UserBadgeProps> = ({ userId, label, size = "xs", className = "" }) => {
  const { appearanceOf } = useUserColors();
  if (userId == null) return null;
  const a = appearanceOf(userId);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border-2 border-border py-0.5 pl-0.5 pr-2 text-[11px] font-bold text-black ${className}`}
      style={{ backgroundColor: `${a.color.bg}33` }}
      title={label ? `${label}: ${a.name}` : a.name}
    >
      <UserAvatar appearance={a} size={size} />
      <span className="truncate">
        {label ? `${label} ` : ""}
        {a.name}
      </span>
    </span>
  );
};

export default UserBadge;
```

- [ ] **Step 6: main.tsx** — import `import { UserColorsProvider } from "./context/UserColorsContext.tsx";` and wrap the routes inside `AuthProvider`:

```tsx
          <AuthProvider>
            <UserColorsProvider>
              {isDashboardBuild ? <DashboardRoutes /> : <DefaultRoutes />}
            </UserColorsProvider>
          </AuthProvider>
```

- [ ] **Step 7: Verify** — `npm test -w apps/dashboard && npm run build -w apps/dashboard` → tests PASS, `tsc` + build succeed.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/services/api.ts apps/dashboard/src/context apps/dashboard/src/components/UserAvatar.tsx apps/dashboard/src/components/UserBadge.tsx apps/dashboard/src/main.tsx
git commit -m "feat(dashboard): user directory context, avatar/badge components, auth refresh"
```

---

## Task 7: Payroll screens — stats cards, data table, charts

**Files:**
- Modify: `FE/components/dashboard/StatsCard.tsx`
- Modify: `FE/pages/Dashboard.tsx` (remove `WORKER_VARIANTS` lines 32-39; cards ~308-325)
- Modify: `FE/components/dashboard/AdminDataTable.tsx` (remove lines 16-53 maps; buttons ~341-355; headers ~378-395)
- Modify: `FE/components/dashboard/DataCharts.tsx` (timeline ~218-224 & ~420-430; pie ~389-390)

**Interfaces:**
- Consumes: `useUserColors().appearanceOfColumn`, `PaletteColor`.
- Produces: `StatsCard` new optional props `accent?: PaletteColor` and `icon?: string | null`.

- [ ] **Step 1: StatsCard** — add to imports `import type { PaletteColor } from "../../lib/userColors";`, add props to `StatsCardProps`:

```ts
  accent?: PaletteColor;
  icon?: string | null;
```
Destructure `accent, icon` in the component. Then compute class sets:

```tsx
  const cls = accent
    ? {
        card: "",
        subtle: "opacity-80",
        button: "border-current/30 bg-black/10 hover:bg-black/20",
        badge: "border-current/30 bg-black/10",
        watermark: "opacity-10",
      }
    : {
        card: variantStyles[variant],
        subtle: variantSubtle[variant],
        button: variantButton[variant],
        badge: variantBadge[variant],
        watermark: variantWatermark[variant],
      };
```
Replace every `variantStyles[variant]`, `variantSubtle[variant]`, `variantButton[variant]`, `variantBadge[variant]`, `variantWatermark[variant]` in the JSX with `cls.card`, `cls.subtle`, `cls.button`, `cls.badge`, `cls.watermark`. Add `style={accent ? { backgroundColor: accent.bg, color: accent.text } : undefined}` to the `motion.div`. Render the icon before the label text:

```tsx
          {icon && <span className="mr-2 not-italic">{icon}</span>}
          {label}
```
and change the watermark to `{icon ?? label.charAt(0)}`.

- [ ] **Step 2: Dashboard.tsx** — delete the `WORKER_VARIANTS` constant; add `import { useUserColors } from "../context/UserColorsContext";` and inside the component `const { appearanceOfColumn } = useUserColors();`. In the `USER_COLUMNS.map` cards replace `variant={WORKER_VARIANTS[worker]}` with:

```tsx
                        accent={appearanceOfColumn(worker).color}
                        icon={appearanceOfColumn(worker).emoji}
```

- [ ] **Step 3: AdminDataTable.tsx** — delete `workerButtonStyles` and `workerHeaderStyles`; add `import { useUserColors } from "../../context/UserColorsContext";` and inside the component `const { appearanceOfColumn } = useUserColors();`. Filter buttons:

```tsx
            {USER_COLUMNS.map((user) => {
              const a = appearanceOfColumn(user);
              const active = activeUser === user;
              return (
                <NeoButton
                  key={user}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveUser(user)}
                  style={
                    active
                      ? { backgroundColor: a.color.bg, color: a.color.text }
                      : { backgroundColor: "#ffffff", color: "#000000", borderColor: a.color.bg }
                  }
                >
                  {a.emoji && <span className="mr-1">{a.emoji}</span>}
                  {user.replace("_", " ")}
                </NeoButton>
              );
            })}
```
(If `NeoButton` does not forward `style`, verify with `grep -n "style\|\.\.\.props" ../../../../packages/ui/src/**/NeoButton*` and, if missing, wrap the label in a `<span style=...>` covering the button instead.)

Table header:
```tsx
      {usersToRender.map((user) => {
        const a = appearanceOfColumn(user);
        return (
        <div key={user} className="overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow">
          <div
            className="flex flex-col gap-3 border-b-2 border-border p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ backgroundColor: a.color.bg, color: a.color.text }}
          >
            <h3 className="font-heading text-lg font-black uppercase tracking-wider md:text-xl">
              {a.emoji && <span className="mr-2">{a.emoji}</span>}
              {user.replace("_", " ")}
            </h3>
            <div className="flex flex-wrap gap-4 font-mono text-sm">
              <span className="font-bold uppercase tracking-widest opacity-90">
                Total: <span className="opacity-100">{formatCurrency(userTotals[user].total)}</span>
              </span>
              <span className="font-bold uppercase tracking-widest opacity-90">
                Admin: <span className="opacity-100">{formatCurrency(userTotals[user].adminShare)}</span>
              </span>
            </div>
          </div>
          {/* ...rest of the existing block unchanged... */}
        </div>
        );
      })}
```
(Convert the existing `usersToRender.map((user) => (` arrow to a block body as above; keep all inner table markup as-is.)

- [ ] **Step 4: DataCharts.tsx** — add `import { useUserColors } from "../../context/UserColorsContext";` and in the component `const { appearanceOfColumn } = useUserColors();`. Add helper after `chartColorsList` is defined:

```ts
  const colorForKey = (key: string, i: number) => {
    const column = key === "Yo" ? user?.dataColumn : key;
    const a = appearanceOfColumn(column);
    return a.color.label === "Sin color" ? chartColorsList[i % chartColorsList.length] : a.color.bg;
  };
```
Replace `chartColorsList[i % chartColorsList.length]` in `timelineConfig`, the `<Line stroke=...>` and its `dot.fill` with `colorForKey(key, i)`. In the pie replace `empDist.map((_, index) => (<Cell ... fill={chartColorsList[index % chartColorsList.length]}` with `empDist.map((entry, index) => (<Cell ... fill={colorForKey(entry.name, index)}`. Add `appearanceOfColumn` to the `timelineConfig` `useMemo` deps.

- [ ] **Step 5: Verify** — `npm run build -w apps/dashboard` → success. Run `npm run dev:dashboard`, log in as admin: cards/filters/headers show the same colors as before (green/yellow/red/purple/orange/pink) plus emoji for users that have one; charts' employee lines match card colors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/components/dashboard apps/dashboard/src/pages/Dashboard.tsx
git commit -m "feat(dashboard): payroll cards, table and charts use each user's color and avatar"
```

---

## Task 8: "Mi cuenta" page, route, nav and sidebar avatar

**Files:**
- Create: `FE/pages/MiCuenta.tsx`
- Modify: `FE/pages/Dashboard.tsx` (route list ~line 386)
- Modify: `FE/components/dashboard/DashboardLayout.tsx` (nav ~340; sidebar user box ~350-356; lucide import ~line 9-29)

**Interfaces:**
- Consumes: `useAuth().user/refreshUser/isAdmin`, `useUserColors().users/refresh`, `authAPI.updateAppearance/changePassword`, Task 5 catalog, `UserAvatar`.

- [ ] **Step 1: MiCuenta.tsx**

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../context/AuthContext";
import { useUserColors } from "../context/UserColorsContext";
import { authAPI } from "../services/api";
import UserAvatar from "../components/UserAvatar";
import {
  ADMIN_ONLY_AVATAR, AVATARS, AVATAR_KEYS, COLOR_KEYS, COLOR_PALETTE, toAppearance,
  type AvatarKey, type ColorKey,
} from "../lib/userColors";

const card = "rounded-base border-2 border-border bg-background shadow-shadow";

export default function MiCuenta() {
  const { user, refreshUser, isAdmin } = useAuth();
  const { users, refresh } = useUserColors();

  const [color, setColor] = useState<ColorKey | null>((user?.color as ColorKey) ?? null);
  const [avatar, setAvatar] = useState<AvatarKey | null>((user?.avatar as AvatarKey) ?? null);
  const [saving, setSaving] = useState(false);
  const [appearanceMsg, setAppearanceMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setColor((user?.color as ColorKey) ?? null);
    setAvatar((user?.avatar as AvatarKey) ?? null);
  }, [user?.color, user?.avatar]);

  const takenColor = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.id !== user?.id && u.color && m.set(u.color, u.name || u.username || ""));
    return m;
  }, [users, user?.id]);

  const takenAvatar = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.id !== user?.id && u.avatar && m.set(u.avatar, u.name || u.username || ""));
    return m;
  }, [users, user?.id]);

  const preview = toAppearance({ name: user?.name || user?.username, color, avatar });
  const dirty = color !== (user?.color ?? null) || avatar !== (user?.avatar ?? null);

  const saveAppearance = async () => {
    setSaving(true);
    setAppearanceMsg(null);
    try {
      const payload: { color?: string; avatar?: string | null } = {};
      if (color && color !== user?.color) payload.color = color;
      if (avatar !== (user?.avatar ?? null)) payload.avatar = avatar;
      await authAPI.updateAppearance(payload);
      await Promise.all([refreshUser(), refresh()]);
      setAppearanceMsg({ ok: true, text: "Guardado. Todos verán tu nuevo color y animal." });
    } catch (err: any) {
      const text = err.response?.data?.error || "No se pudo guardar";
      setAppearanceMsg({ ok: false, text });
      if (err.response?.status === 409) await refresh();
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      return setPwMsg({ ok: false, text: "Completa todos los campos" });
    }
    if (newPassword.length < 6) {
      return setPwMsg({ ok: false, text: "La nueva contraseña debe tener al menos 6 caracteres" });
    }
    if (newPassword !== confirmPassword) {
      return setPwMsg({ ok: false, text: "La confirmación no coincide" });
    }
    setPwSaving(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setPwMsg({ ok: true, text: "Contraseña actualizada" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.response?.data?.error || "No se pudo cambiar la contraseña" });
    } finally {
      setPwSaving(false);
    }
  };

  const inputCls = "w-full rounded-base border-2 border-border bg-white px-3 py-2 font-base text-sm focus:outline-none";

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8 lg:grid-cols-2">
      <section className={card}>
        <div className="border-b-2 border-border bg-main px-5 py-3 font-heading text-lg font-black text-main-foreground">
          Mi avatar y color
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-bold">Elige tu animal</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              {AVATAR_KEYS.map((key) => {
                const reserved = key === ADMIN_ONLY_AVATAR && !isAdmin;
                const owner = takenAvatar.get(key);
                const disabled = reserved || !!owner;
                const selected = avatar === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => setAvatar(selected ? null : key)}
                    title={reserved ? "Reservado para el admin" : owner ? `Lo tiene ${owner}` : AVATARS[key].label}
                    className={`relative flex h-11 items-center justify-center rounded-base border-2 border-border bg-white text-2xl transition-all ${
                      selected ? "ring-4 ring-main ring-offset-2" : ""
                    } ${disabled ? "cursor-not-allowed opacity-30" : "hover:-translate-y-0.5"}`}
                  >
                    {AVATARS[key].emoji}
                    {reserved && <Lock size={12} className="absolute -right-1 -top-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Elige tu color</p>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_KEYS.map((key) => {
                const owner = takenColor.get(key);
                const selected = color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!!owner}
                    onClick={() => setColor(key)}
                    title={owner ? `Lo tiene ${owner}` : COLOR_PALETTE[key].label}
                    style={{ backgroundColor: COLOR_PALETTE[key].bg }}
                    className={`h-9 rounded-base border-2 border-border transition-all ${
                      selected ? "ring-4 ring-main ring-offset-2" : ""
                    } ${owner ? "cursor-not-allowed opacity-30" : "hover:-translate-y-0.5"}`}
                  >
                    {owner && <span className="text-sm font-black">✕</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Vista previa</p>
            <div
              className="flex items-center gap-3 rounded-base border-2 border-border p-4 shadow-shadow"
              style={{ backgroundColor: preview.color.bg, color: preview.color.text }}
            >
              <UserAvatar appearance={preview} size="lg" />
              <span className="font-heading text-2xl font-black uppercase">{preview.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NeoButton type="button" onClick={saveAppearance} disabled={!dirty || !color || saving}>
              {saving ? "Guardando…" : "Guardar"}
            </NeoButton>
            {appearanceMsg && (
              <span className={`text-sm font-semibold ${appearanceMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {appearanceMsg.text}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="border-b-2 border-border bg-main px-5 py-3 font-heading text-lg font-black text-main-foreground">
          Cambiar contraseña
        </div>
        <form onSubmit={changePassword} className="space-y-4 p-5">
          <label className="block text-sm font-bold">
            Contraseña actual
            <input type="password" autoComplete="current-password" className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Nueva contraseña
            <input type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Confirmar nueva contraseña
            <input type="password" autoComplete="new-password" className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          <div className="flex items-center gap-3">
            <NeoButton type="submit" disabled={pwSaving}>
              {pwSaving ? "Guardando…" : "Cambiar contraseña"}
            </NeoButton>
            {pwMsg && (
              <span className={`text-sm font-semibold ${pwMsg.ok ? "text-green-700" : "text-red-600"}`}>{pwMsg.text}</span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Route** — in `Dashboard.tsx` import `import MiCuenta from "./MiCuenta";` and add next to the `/ai-guru` route (no admin guard):

```tsx
        <Route path="/mi-cuenta" element={<MiCuenta />} />
```

- [ ] **Step 3: Nav + sidebar** — in `DashboardLayout.tsx`: add `UserCircle` to the `lucide-react` import; add imports `import UserAvatar from "../UserAvatar";` and `import { toAppearance } from "../../lib/userColors";`. Insert before the admin-only "Configuración" item:

```tsx
          <NavItem
            to="/mi-cuenta"
            icon={<UserCircle size={18} />}
            label="Mi cuenta"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
```
Replace the sidebar initial box (`<div className="flex h-9 w-9 ... shadow-button">{user?.username?.charAt(0).toUpperCase()}</div>`) with:

```tsx
            <UserAvatar appearance={toAppearance({ name: user?.name || user?.username, color: user?.color, avatar: user?.avatar })} size="md" className="shadow-button" />
```

- [ ] **Step 4: Verify** — `npm run build -w apps/dashboard` → success. With backend from Tasks 1–4 running locally against the **local** test DB (`DATABASE_URL=postgresql://localhost:5432/guru_test npm run dev` in BE after loading the fixture + migration and a user with a known bcrypt password), log in, open "Mi cuenta":
  - pick 🐈 + azul → Guardar → sidebar avatar updates;
  - owl tile disabled with lock for non-admin;
  - wrong current password → red "La contraseña actual es incorrecta" and **still logged in** after reload;
  - valid password change → success message.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/MiCuenta.tsx apps/dashboard/src/pages/Dashboard.tsx apps/dashboard/src/components/dashboard/DashboardLayout.tsx
git commit -m "feat(dashboard): Mi cuenta page (avatar, color, password) + sidebar avatar"
```

---

## Task 9: Ownership badges — chats, clients, cotizaciones, cases

**Files:**
- Modify: `FE/services/botApi.ts:78-84` (`BotClient` type)
- Modify: `FE/pages/BotMessages.tsx` (`ConvItem` ~238-290; chat top bar near assignment ~1644)
- Modify: `FE/pages/BotClients.tsx` (`ClientItem` ~53-80)
- Modify: `FE/pages/Cotizaciones.tsx` (users load ~145-156; list ~818-860; detail header ~885-891; creator filter ~728)
- Modify: `FE/pages/Cases.tsx` (list item ~496-511)

**Interfaces:**
- Consumes: `<UserBadge userId label? />`, `useUserColors().users`.

- [ ] **Step 1: BotClient type** — add `assigned_to?: number | null;` to `interface BotClient` in `botApi.ts`.

- [ ] **Step 2: Chats** — in `BotMessages.tsx` import `UserBadge from "../components/UserBadge"`. In `ConvItem`, under the preview `<p>`:

```tsx
        {conv.client_assigned_to != null && (
          <div className="mt-1">
            <UserBadge userId={conv.client_assigned_to} />
          </div>
        )}
```
In the chat top bar, immediately before `{/* Assignment (admin only) */}`:

```tsx
              {!isAdmin && selectedConv?.client_assigned_to != null && (
                <UserBadge userId={selectedConv.client_assigned_to} size="sm" />
              )}
```

- [ ] **Step 3: Clients** — in `BotClients.tsx` import `UserBadge`; in `ClientItem` after the phone `<p>`:

```tsx
        {client.assigned_to != null && (
          <div className="mt-1">
            <UserBadge userId={client.assigned_to} />
          </div>
        )}
```

- [ ] **Step 4: Cotizaciones** — import `UserBadge` and `useUserColors`. Replace the `users` state + the `loadUsers` `useEffect` (which calls the non-existent `/users` endpoint) with `const { users } = useUserColors();` (keep the creator-filter `<select>` mapping over `users`; adjust field access to `u.name || u.username` if it used another field). In the list item, after the amount/date row:

```tsx
                {quote.created_by != null && (
                  <div className="mt-2">
                    <UserBadge userId={quote.created_by} label="Creado por" />
                  </div>
                )}
```
In the detail header, after the client name `<p>`:

```tsx
                {selectedQuotation.created_by != null && (
                  <UserBadge userId={selectedQuotation.created_by} label="Creado por" size="sm" className="mt-1" />
                )}
```

- [ ] **Step 5: Cases** — import `UserBadge`; in the list item after the case number `<p>`:

```tsx
                {caseItem.user_id != null && (
                  <div className="mt-1">
                    <UserBadge userId={caseItem.user_id} />
                  </div>
                )}
```

- [ ] **Step 6: Verify** — `npm test -w apps/dashboard && npm run build -w apps/dashboard` → PASS + build OK. In the running app: assigned chats/clients/cases show the colored animal badge; quotations show "Creado por …"; the creator filter dropdown now lists users.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/services/botApi.ts apps/dashboard/src/pages/BotMessages.tsx apps/dashboard/src/pages/BotClients.tsx apps/dashboard/src/pages/Cotizaciones.tsx apps/dashboard/src/pages/Cases.tsx
git commit -m "feat(dashboard): colored avatar badges for assignees and quotation creators"
```

---

## Task 10: Release to dev (requires the owner's go-ahead at each outward step)

- [ ] **Step 1: Backend full test run** — `cd BE && npm test` → all PASS.
- [ ] **Step 2: Push backend** — ask the owner first (Railway deploys prod API from `main`): `git push origin main`. Wait for Railway deploy; `curl -s https://guruweb-backend-production.up.railway.app/health` → OK.
- [ ] **Step 3: Run migration on production DB** — the owner (admin) clicks the migrations button in Configuración, or with explicit approval run `POST /api/admin/run-migrations`. Verify: `GET /api/dashboard/users` (with an admin token) returns `color` for every user and `avatar: "owl"` for the main admin.
- [ ] **Step 4: Verify production frontend unaffected** — open https://guruweb-dashboard-prod.netlify.app, log in, load inicio/chats/cotizaciones: no errors.
- [ ] **Step 5: Push frontend dev** — `cd guru-frontend-dev && npm test -w apps/dashboard && npm run build -w apps/dashboard && git push origin main` (Netlify dev site redeploys).
- [ ] **Step 6: Two-session QA on the dev site** (admin in one browser, an employee in a private window; warn the team that changes hit real users):
  - employee changes color + animal → admin sees it on inicio, tabla, gráficas, chats, cotizaciones within 60 s (or immediately on tab focus);
  - employee cannot pick 🦉 or a taken color/animal;
  - wrong current password keeps the session.
- [ ] **Step 7: Promote to production** — only after the owner approves: copy the frontend changes into `guruweb-frontend` (same files), build, commit, push (Netlify prod deploys once linked).
