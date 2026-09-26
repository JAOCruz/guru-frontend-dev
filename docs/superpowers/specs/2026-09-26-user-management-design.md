# Diseño: Panel de gestión de usuarios (fase 1)

Fecha: 2026-09-26
Repos: `guruweb-backend` (API + DB) y `guru-frontend-dev` → luego `guruweb-frontend` (producción)
Fase 2 (fuera de este documento): puntos de venta.

## Objetivo

Que el admin gestione a todo el personal desde el dashboard: crear empleados, auxiliares y otros admins; editar sus datos y rol; ponerles una contraseña temporal; desactivarlos (p. ej. Marleni, que renunció y todavía tiene acceso) pasando sus asignaciones a otra persona; y reactivarlos. Los empleados nuevos deben aparecer en las ganancias sin tocar código.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Alcance | Fase 1: panel + cerrar registro público + lista de empleados dinámica. Puntos de venta en fase 2 |
| Asignados al desactivar | El admin elige a quién pasarlos (o "Sin asignar"); nada queda huérfano |
| Borrar | Nunca se borra: solo desactivar/reactivar. El historial conserva el nombre |
| Ganancias | Interruptor por usuario "Participa en ganancias" |
| Desactivado en ganancias | Aparece solo si tiene servicios en el período filtrado, marcado "Desactivado" |
| Contraseña puesta por el admin | Temporal: el usuario debe cambiarla al entrar antes de usar el dashboard |

## Estado actual (relevante)

- No hay endpoints de CRUD de usuarios para el admin; solo `POST /api/auth/reset-password` (admin).
- `POST /api/auth/register` es **público** y acepta `role` del body → cualquiera puede crearse admin. Ningún frontend lo usa.
- Ganancias usan una lista fija `USER_COLUMNS` (6 `data_column`) en `excelService.ts`, `Dashboard.tsx`, `AdminDataTable.tsx`, `DataModificationForm.tsx`; los servicios se agrupan por `data_column`.
- Asignaciones: `clients.assigned_to` (chats y clientes se asignan por cliente) y `cases.user_id`.
- Colores/avatares por usuario ya existen (`users.color`, `users.avatar`, `UserColorsContext`).
- Usuarios en producción: admin(1), hengi(2), marleni(3), israel(4), thaicar(5), devtest(26, admin), auxiliar1(34), auxiliar2(35), administracion(37, digitador sin `data_column`).

## 1. Datos (migración `20260926_user_management.sql`, idempotente)

- `users.is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `users.must_change_password BOOLEAN NOT NULL DEFAULT FALSE`
- `users.in_payroll BOOLEAN NOT NULL DEFAULT FALSE`; se marca `TRUE` para quienes hoy tienen `data_column` en HENGI, MARLENI, ISRAEL, THAICAR, AUXILIAR_I, AUXILIAR_II (sin distinguir mayúsculas).
- `users.deactivated_at TIMESTAMPTZ NULL`
- Índice único sobre `LOWER(username)` para evitar duplicados al crear (si ya existiera un duplicado en datos, la migración lo detecta y falla con mensaje claro antes de crear el índice).

`data_column` sigue siendo la clave de ganancias. Al crear un usuario con "Participa en ganancias", el backend genera `data_column` a partir del nombre (mayúsculas, sin acentos, espacios → `_`, sufijo `_2`, `_3` si ya existe).

## 2. Backend

**Login y sesión**
- Login de usuario desactivado → `403 { error: "Usuario desactivado. Contacta al administrador.", code: "USER_INACTIVE" }` (403, no 401, para que el frontend no lo confunda con sesión vencida y muestre el mensaje).
- `authenticate`: además del JWT, verifica `is_active` y `must_change_password` en DB con caché en memoria de 60 s por usuario. Desactivado → `401 USER_INACTIVE` (la sesión se cierra, como una sesión vencida). La caché se invalida al instante cuando el admin cambia el usuario (mismo proceso).
- `must_change_password = true` → cualquier endpoint devuelve `403 { code: "PASSWORD_CHANGE_REQUIRED" }` excepto `GET /auth/me`, `PUT /auth/change-password`, `POST /auth/logout`. Al cambiar la contraseña se pone en `false`.
- `/auth/me` y login incluyen `mustChangePassword`, `isActive`, `inPayroll` en el usuario.

**Registro**
- `POST /api/auth/register` pasa a requerir admin (compatibilidad) y delega en la misma lógica de creación que el panel.

**Endpoints del panel** (`/api/admin/users…`, todos `requireRole('admin')`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/admin/users?status=active\|inactive\|all` | Lista con `id, name, username, email, role, data_column, color, avatar, is_active, in_payroll, must_change_password, last_seen, created_at` (ya existe; se amplía, `status` por defecto `all`) |
| POST | `/admin/users` | Crea: `{ name, username, email?, role, in_payroll, temp_password }`. Color automático; `must_change_password = true` |
| PUT | `/admin/users/:id` | Edita `name, username, email, role, in_payroll` |
| POST | `/admin/users/:id/temp-password` | `{ temp_password }` → nueva contraseña + `must_change_password = true` |
| GET | `/admin/users/:id/assignments` | `{ clients: n, cases: n }` asignados activos |
| POST | `/admin/users/:id/deactivate` | `{ reassign_to: id \| null }` → en una transacción: pasa `clients.assigned_to` y `cases.user_id` al destino (o NULL), `is_active=false`, `deactivated_at=NOW()`, libera `color` y `avatar` |
| POST | `/admin/users/:id/reactivate` | `is_active=true`, `deactivated_at=NULL`, color automático |

**Validaciones**
- `username` obligatorio, único sin distinguir mayúsculas (`409 USERNAME_TAKEN`); `role ∈ {admin, digitador, auxiliar}`; contraseña temporal ≥ 6.
- No puedes desactivarte a ti mismo (`400 CANNOT_DEACTIVATE_SELF`).
- No se puede desactivar ni quitar el rol admin al último admin activo (`400 LAST_ADMIN`).
- `reassign_to` debe ser un usuario activo distinto del desactivado.
- El admin no puede quitarse a sí mismo el rol admin.

## 3. Frontend

**Página "Usuarios"** (`/usuarios`, solo admin, ítem en el menú lateral)
- Tabla: avatar, nombre, usuario, rol, ganancias (sí/no), estado (Activo / Desactivado / "Debe cambiar contraseña"), última conexión. Filtro Activos / Desactivados / Todos (por defecto Activos). En móvil, tarjetas.
- **Nuevo usuario** (modal): nombre, usuario, email (opcional), rol (Admin / Digitador / Auxiliar), "Participa en ganancias" (marcado por defecto para Digitador y Auxiliar), contraseña temporal (con botón "Generar").
- **Editar** (modal): mismos campos sin contraseña.
- **Contraseña temporal** (modal): nueva contraseña temporal + aviso "Deberá cambiarla al entrar".
- **Desactivar** (modal): muestra "X clientes/chats y Y casos asignados", selector de a quién pasarlos (empleados activos) o "Sin asignar", confirmación.
- **Reactivar** (confirmación).
- Mensajes de error del backend en español; estilo neo-brutalista existente.

**Login**
- `403 USER_INACTIVE` → muestra el mensaje en el formulario.

**Contraseña obligatoria**
- Si `user.mustChangePassword`, `ProtectedRoute` muestra solo la pantalla "Crea tu contraseña" (actual temporal, nueva, confirmar) antes del dashboard; al guardar, `refreshUser()` y entra.

**Ganancias dinámicas**
- Lista de empleados = usuarios del directorio con `in_payroll` y activos, más desactivados que tengan servicios en el período mostrado (tarjeta con etiqueta "Desactivado").
- Reemplaza `USER_COLUMNS`/`WorkerKey` en `Dashboard.tsx`, `AdminDataTable.tsx`, `DataModificationForm.tsx` (selector de empleado al crear servicio: solo activos en ganancias) y `excelService.ts` (exportación). El directorio (`/api/dashboard/users`) añade `is_active` e `in_payroll`.
- Gráficas ya usan `data_column` + colores del directorio: sin cambios de lógica.

## 4. Despliegue

1. Migración sola a `main` del backend → ejecutar desde Configuración.
2. Backend (endpoints, bloqueo de desactivados, registro cerrado).
3. Frontend en dev (`guruweb-development.netlify.app`) → pruebas con el admin.
4. Producción con aprobación (incluye colores/avatares ya probados).
5. PDF "Guía del administrador — Gestión de usuarios" (con capturas del panel).

## 5. Pruebas

- Backend (`node:test`, DB local): crear (usuario duplicado 409, rol inválido 400, `data_column` generado único), editar, contraseña temporal fuerza `PASSWORD_CHANGE_REQUIRED` hasta cambiarla, desactivar reasigna clientes y casos en una transacción y libera color/avatar, último admin / uno mismo protegidos, login desactivado 403, sesión abierta de desactivado → 401 tras invalidar caché, registro sin admin → 401/403.
- Frontend (vitest + Testing Library): cálculo de la lista de ganancias (activos en ganancias + desactivados con servicios en el período), pantalla de contraseña obligatoria bloquea el dashboard, mensaje de usuario desactivado en login.
- Manual en dev: flujo completo creando un usuario de prueba, desactivándolo con reasignación y reactivándolo.
