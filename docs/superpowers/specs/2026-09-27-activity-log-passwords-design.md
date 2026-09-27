# Diseño: Registro de actividad + contraseñas más fuertes

Fecha: 2026-09-27 · Repos: `guruweb-backend`, `guru-frontend-dev` → `guruweb-frontend`

## Decisiones (aprobadas por el dueño)
| Tema | Decisión |
|------|----------|
| Qué se registra | Usuarios, cotizaciones/facturas, asignaciones, servicios/ganancias (todo) |
| Retención | 1 año; limpieza automática diaria |
| Quién lo ve | Solo admin (página "Actividad") |
| Contraseñas nuevas | Mínimo 8, al menos una letra y un número, no comunes, no contener usuario/nombre. Las actuales siguen funcionando |
| Documentación | Sección nueva en la guía PDF del administrador (español) |

## 1. Datos — `migrations/20260927_activity_log.sql`
`activity_log(id BIGSERIAL PK, created_at TIMESTAMPTZ DEFAULT NOW(), actor_id INT NULL, actor_name TEXT, category TEXT, action TEXT, entity_type TEXT, entity_id TEXT, summary TEXT NOT NULL, details JSONB, ip TEXT)`; índices en `created_at DESC`, `actor_id`, `(category, created_at DESC)`.

## 2. Backend
- `src/services/activityLog.js`: `logActivity(req|null, { category, action, entityType, entityId, summary, details, actor })` — nunca lanza (catch + console.error); nombre del actor tomado de `req.user` (snapshot). `listActivity(filters)`; `purgeOld(days=365)`; `startActivityRetention()` (al arrancar y cada 24 h).
- Categorías: `usuarios`, `facturas`, `asignaciones`, `servicios`, `seguridad`.
- Puntos instrumentados:
  - Usuarios (admin.js): crear, editar (con cambios antes/después), contraseña temporal, desactivar (con reasignación), reactivar. auth.js: cambio de contraseña propio, login fallido (usuario inexistente / contraseña incorrecta / desactivado / verificación humana fallida — categoría `seguridad`), bloqueo por demasiados intentos.
  - Facturas (invoices.js): crear, editar, eliminar, aprobar, rechazar (motivo), enviar / solicitar aprobación, confirmar pago (monto, método, referencia).
  - Asignaciones: clients.js (`/:id/assign`, `/assign-by-phone`, `PUT /:id/assign`), cases.js (`/:id/assign`).
  - Servicios: servicesController create / delete / updateComment.
- `GET /api/admin/activity?category=&actor_id=&from=&to=&q=&page=&page_size=` (admin) → `{ items, total, page, page_size }`, más recientes primero, `page_size` ≤ 100.

## 3. Contraseñas — `src/config/passwordPolicy.js`
`validatePassword(password, { username, name }) → null | { code: 'WEAK_PASSWORD', error }` con mensajes en español. Aplica en: `PUT /auth/change-password`, `POST /admin/users` (temp), `POST /admin/users/:id/temp-password`, `POST /auth/register`. Lista de ~60 contraseñas comunes (incluye variantes con "guru"). Frontend: `generateTempPassword` garantiza letra y número; MiCuenta/ForcePasswordChange validan mínimo 8 en cliente y muestran el error del backend.

## 4. Frontend
- `pages/Actividad.tsx` (ruta `/actividad`, solo admin, ítem de menú): filtros (persona, categoría, desde/hasta, búsqueda), lista con avatar+nombre, resumen, hora relativa y fecha; clic → detalles (antes/después). Paginación "Cargar más".
- `Usuarios`: botón "Ver actividad" en cada tarjeta → `/actividad?actor_id=ID`.

## 5. Despliegue
Migración sola → backend → dev → producción; guía PDF actualizada.
