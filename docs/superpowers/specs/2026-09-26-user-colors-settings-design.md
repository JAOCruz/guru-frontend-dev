# Diseño: Colores y avatares por usuario + página "Mi cuenta"

Fecha: 2026-09-26
Repos: `guruweb-backend` (API + DB) y `guru-frontend-dev` → luego `guruweb-frontend` (producción)

## Objetivo

Que cada usuario elija su color y su avatar (un animal emoji) en el dashboard y que ese color lo identifique en todas partes, para todos los usuarios: si Hengi cambia de verde a rojo, el admin (y cualquiera) lo ve rojo. El color sirve como indicador visual de "este empleado está asignado a esto / hizo esto". Además, una página "Mi cuenta" donde cada usuario cambia su contraseña y su color.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Selector | Paleta fija de 12 colores (no color libre) |
| Unicidad | Dos usuarios no pueden tener el mismo color |
| Avatar | Animal emoji de una lista fija de 24 + 🦉 búho; tampoco se repite entre usuarios |
| Búho | 🦉 reservado para el admin: solo usuarios con rol `admin` pueden tenerlo; la migración se lo asigna al admin principal (menor `id` con rol admin) |
| Alcance | Donde ya hay color (tarjetas, tabla de datos, gráficas) **y** donde se muestra quién está asignado/quién creó algo (chats, clientes, cotizaciones, casos si el dato existe) |
| Arquitectura | El color vive en `users.color`; el frontend carga la lista de usuarios una vez y resuelve el color por `user_id` / `data_column` |
| Fuera de alcance | Hacer dinámica la lista fija de 6 empleados (`USER_COLUMNS`) |

## Estado actual

- Colores hardcodeados por `data_column` en tres mapas: `AdminDataTable.tsx` (`workerButtonStyles`, `workerHeaderStyles`) y `Dashboard.tsx` (`WORKER_VARIANTS` → variantes de `StatsCard`).
- `DataCharts.tsx` usa `--chart-1..5` por índice: los colores no coinciden con las tarjetas.
- Chats, clientes, cotizaciones y casos muestran el asignado/creador sin color (o no lo muestran).
- `users` no tiene columna de color. `PUT /api/auth/change-password` ya existe (`{currentPassword, newPassword}`), pero no hay UI para usarlo.

## 1. Paleta

Definida en un solo lugar por repo (backend: lista de claves válidas; frontend: clave → `{ bg, text }` en hex).

| Clave | Fondo | Texto |
|-------|-------|-------|
| green | #22c55e | #ffffff |
| yellow | #facc15 | #000000 |
| red | #ef4444 | #ffffff |
| purple | #9333ea | #ffffff |
| orange | #f97316 | #ffffff |
| pink | #ec4899 | #ffffff |
| teal | #14b8a6 | #ffffff |
| cyan | #06b6d4 | #000000 |
| blue | #3b82f6 | #ffffff |
| indigo | #6366f1 | #ffffff |
| lime | #84cc16 | #000000 |
| brown | #92400e | #ffffff |

Se guarda la **clave** (`"green"`), no el hex, para poder ajustar tonos sin migrar datos. Las seis primeras coinciden con los Tailwind actuales (`green-500`, `yellow-400`, `red-500`, `purple-600`, `orange-500`, `pink-500`).

## 1b. Avatares

Lista fija (se guarda la clave, no el emoji):

| Clave | Emoji | Clave | Emoji | Clave | Emoji |
|-------|-------|-------|-------|-------|-------|
| cow | 🐄 | cat | 🐈 | dog | 🐕 |
| horse | 🐎 | pig | 🐖 | sheep | 🐑 |
| goat | 🐐 | rooster | 🐓 | duck | 🦆 |
| rabbit | 🐇 | turtle | 🐢 | dolphin | 🐬 |
| lion | 🦁 | tiger | 🐯 | bear | 🐻 |
| panda | 🐼 | fox | 🦊 | frog | 🐸 |
| penguin | 🐧 | parrot | 🦜 | bee | 🐝 |
| butterfly | 🦋 | elephant | 🐘 | giraffe | 🦒 |
| **owl** | **🦉** | — solo admin — | | | |

- Sin avatar elegido → se muestra la inicial del nombre sobre su color (como hoy).
- El emoji se ve con la fuente del sistema de cada equipo (Apple / Windows / Android), por lo que el dibujo puede variar un poco entre computadoras.

## 2. Backend

**Migración** `migrations/20260926_user_color.sql` (idempotente, como las demás):
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS color VARCHAR(20);`
- Índice único parcial: `CREATE UNIQUE INDEX IF NOT EXISTS users_color_unique ON users(color) WHERE color IS NOT NULL;`
- Sembrar colores actuales por `data_column`: HENGI→green, MARLENI→yellow, ISRAEL→red, THAICAR→purple, AUXILIAR_I→orange, AUXILIAR_II→pink (solo donde `color IS NULL`).
- Resto de usuarios sin color (admin, etc.): asignar el primer color libre de la paleta en orden de `id`.
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(20);` + índice único parcial `users_avatar_unique`.
- Asignar `avatar = 'owl'` al admin principal (menor `id` con `role='admin'`) si nadie lo tiene. Los demás quedan sin avatar hasta que elijan.

**Modelo `User`:** `updateAppearance(id, {color, avatar})`, `findTakenAppearance()`, y asignación automática del primer color libre al crear usuario (si queda alguno; si no, `NULL`).

**Endpoints:**
- Login, `GET /api/auth/me`, `GET /api/admin/users`: incluyen `color` y `avatar`.
- `GET /api/dashboard/users` (cualquier usuario autenticado): devuelve `id, name, username, data_column, color, avatar`.
- `PUT /api/auth/me/appearance` (autenticado, sobre sí mismo) body `{ color?, avatar? }` (uno o ambos):
  - `400` si la clave no está en la paleta / lista de avatares.
  - `403` si pide `owl` y su rol no es `admin`.
  - `409` si otro usuario ya tiene ese color o avatar (también si la DB rechaza por el índice único — condición de carrera).
  - `200 { user }` con el usuario actualizado.
- Contraseña: se reutiliza `PUT /api/auth/change-password`, con un cambio: contraseña actual incorrecta responde **400** (antes 401), porque el frontend trata cualquier 401 como sesión vencida y cierra la sesión.

Compatibilidad: todo es aditivo; el frontend de producción actual ignora `color`.

## 3. Frontend — fuente única de colores

- `src/lib/userColors.ts`: paleta (clave → `{ bg, text }`), lista de avatares (clave → emoji + nombre), `FALLBACK` gris para usuarios sin color o no encontrados.
- `src/context/UserColorsContext.tsx`: carga `GET /dashboard/users`; expone `users`, `colorOf(userId)`, `colorOfColumn(dataColumn)`, `avatarOf(userId)`, `refresh()`. Refresca cada 60 s y al volver el foco a la pestaña. Montado dentro de `AuthProvider`, solo con sesión iniciada.
- `src/components/UserAvatar.tsx`: círculo con el color del usuario y su emoji (o inicial si no tiene).
- `src/components/UserBadge.tsx`: avatar + nombre + color del usuario (variante "pill" con fondo, y variante "dot" con punto de color), para reutilizar en listas.
- `AuthContext`: agrega `color` (y `name`, `email`) al tipo `User` y expone `refreshUser()` para actualizar tras cambiar color.

## 4. Dónde se aplica

| Lugar | Cambio |
|-------|--------|
| Inicio (`Dashboard.tsx` + `StatsCard`) | Tarjetas por empleado con el color y avatar del usuario vía estilo inline (nueva prop `color` en `StatsCard`; las variantes existentes quedan para las tarjetas no-usuario) |
| Sidebar (`DashboardLayout.tsx`) | Avatar + nombre del usuario conectado |
| Tabla de datos (`AdminDataTable.tsx`) | Botones de filtro y encabezados usan el color del usuario; se eliminan `workerButtonStyles`/`workerHeaderStyles` |
| Gráficas (`DataCharts.tsx`) | Líneas de timeline y porciones del pie por empleado usan `colorOfColumn`; las series que no son de empleado siguen usando `--chart-*` |
| Chats (`BotMessages.tsx`) | Etiqueta del asignado en la lista de conversaciones y en el panel del cliente |
| Clientes (`BotClients.tsx`) | Etiqueta del asignado |
| Cotizaciones (`Cotizaciones.tsx`) | Etiqueta "creado por" en la lista y el detalle (usa `created_by`) |
| Casos (`Cases.tsx`) | Etiqueta del asignado **si** el dato está en la respuesta; si no, se omite en esta fase |

## 5. Página "Mi cuenta"

- Ruta `/mi-cuenta` en `Dashboard.tsx`, sin guardia de admin; ítem "Mi cuenta" en el sidebar (`DashboardLayout.tsx`) para todos los roles.
- **Mi avatar:** grilla de animales; el actual marcado; los tomados deshabilitados con el nombre de quien lo tiene; 🦉 visible solo para admin (para los demás aparece como "Reservado para el admin"). Mismo manejo de `409`.
- **Mi color:** grilla de la paleta; el actual marcado; los ocupados deshabilitados con el nombre de quien lo usa (tooltip); vista previa de la tarjeta con el nombre del usuario. Al guardar (avatar y color juntos): `PUT /auth/me/appearance` → `refreshUser()` + `refresh()` del contexto de colores. Error `409` → mensaje "Ese color lo acaba de tomar otro usuario" y recarga la paleta.
- **Cambiar contraseña:** actual, nueva, confirmar. Validación en cliente: campos requeridos, mínimo 6, nueva = confirmación. Error `400` (`WRONG_CURRENT_PASSWORD`) → "La contraseña actual es incorrecta" (sin cerrar sesión). Éxito → mensaje y limpia el formulario.
- Estilo neo-brutalista existente (componentes `@guru/ui` / clases actuales).

## 6. Despliegue

1. Backend: commit + push a `main` (Railway despliega). Cambio aditivo, no rompe producción.
2. Ejecutar migraciones desde Configuración (admin) → `POST /api/admin/run-migrations`.
3. Frontend en `guru-frontend-dev` → probar en el sitio de dev.
4. Con aprobación del usuario: pasar a `guruweb-frontend`.

Nota: dev y producción comparten backend y base de datos; cambiar el color o la contraseña en dev afecta al usuario real.

## 7. Pruebas

- Backend (curl contra local o Railway): color/avatar válido → 200; clave inválida → 400; `owl` desde no-admin → 403; color/avatar de otro usuario → 409; `/dashboard/users` incluye `color`; contraseña actual incorrecta → 400 y la sesión sigue activa.
- Migración: correrla dos veces sin errores; verificar colores sembrados.
- Frontend: `tsc && vite build` sin errores; en dev, con dos sesiones (admin y empleado), cambiar el color del empleado y confirmar que el admin lo ve en ≤ 60 s en tarjetas, tabla, gráficas, chats y cotizaciones.
