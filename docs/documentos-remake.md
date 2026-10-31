# Documentos · propuesta de remake (prototipo, rama `documentos-remake`)

**Qué se propone:** una sola pantalla de trabajo en vez de tres pestañas, con un botón principal para **crear un documento desde cero** (sin modelo), una búsqueda única (⌘K) y el estado de los documentos a la vista. Todo lo que hoy existe sigue ahí; cambia cómo se llega.

## Lo que miramos y qué tomamos
| Patrón | De dónde | Cómo lo usamos aquí |
|---|---|---|
| Tira «Empezar un documento» + tabla de recientes | Google Docs | Arriba: *Crear desde cero (IA)*, *En blanco*, *Desde un modelo*, *Subir*; debajo, Recientes |
| Botón «Nuevo» con menú de opciones | Notion | Un solo botón **Nuevo documento** con las cuatro formas de empezar |
| Biblioteca grande: Favoritos/Recientes/búsqueda, no un grid de 166 | Smokeball (precedentes) | La biblioteca va abajo y se busca; lo que manda arriba es lo reciente y lo pendiente |
| Estados como chips y filtro (Draft → Pending → Completed) | Documenso | Tira **Borradores → Aprobados → Enviados** + *Del bot por revisar*, con conteos |
| Paleta de comandos ⌘K que mezcla objetos | Linear / Twenty CRM | ⌘K o `/`: modelos, mis documentos y clientes en una lista; «Buscar con IA» como última fila |
| Pantalla de revisión antes de generar | docassemble | «Faltan N datos» con las etiquetas que quedaron; se completan con *Personalizar* |

Anti-patrones que evitamos: pestañas separadas para crear / buscar / historial; la galería de 166 modelos como portada; generar con IA sin un paso de revisión; versiones escondidas.

## La pantalla
```
Documentos                              [⌘K Buscar modelos, documentos y clientes…]  [+ Nuevo documento]
┌ Inicio ───────────┐ ┌──────────────────────────────────────────────────────────────────────────────┐
│ Mis documentos    │ │ [ Crear documento desde cero · Redactar con IA ] [En blanco] [Desde modelo] [Subir] │
│ Revisión etiquetas│ │ Borradores 4 · Aprobados 2 · Enviados 1 · Del bot por revisar 1                 │
│ (solo admin)      │ │ Recientes (6, con estado)              │ Por cliente (6, con conteo)            │
│                   │ │ Biblioteca de modelos: buscar por nombre / con IA · Ver · Word · PDF · Llenar · Personalizar · Corregir │
└───────────────────┘ └──────────────────────────────────────────────────────────────────────────────┘
```
- **Inicio** (`/documents`): crear, en curso y biblioteca. En teléfono el menú lateral pasa a chips horizontales y todo cae en una columna.
- **Mis documentos** (`/documents?tab=historial&client=…`): el componente actual (clientes → documentos → versiones, aprobar, enviar, subir versión, personalizar, guardar como modelo). Nuevo: `&doc=ID` abre ese documento al llegar; `client=0` es «Sin cliente».
- **Revisión de etiquetas** (`/documents?tab=etiquetas&model=…`, admin): igual que hoy. Los enlaces de las notificaciones siguen funcionando.
- **⌘K / `/`**: un modelo → *Personalizar*; un documento o cliente → Mis documentos; «Buscar con IA» → la biblioteca con esa frase.

## Crear desde cero
Botón principal de Inicio (y primera opción de *Nuevo documento*). Diálogo: **Cliente** (opcional, el mismo selector de hoy), **Nombre** (opcional: lo pone la IA), **¿Qué necesitas?** en texto libre (ej. «Contrato de alquiler de un local comercial en Piantini por 2 años, RD$45,000 mensuales»).

- Backend `POST /api/documentos/documents/new` `{ title?, client_id?, request? | blank: true }`. La IA (misma ruta Claude→Gemini de `aiDocs`) devuelve título y párrafos en JSON; el motor de Word (`docx_text.py create`) arma el .docx con el formato de la oficina (carta, márgenes 2.54 cm, Times New Roman 12, justificado, título centrado en negrita).
- **No inventa datos**: nombres, cédulas, domicilios, fechas y montos que no vengan en el pedido quedan como `{{ETIQUETA}}` con el formato DATO_ROL de los modelos. La respuesta trae `placeholders` y el diálogo muestra «Faltan N datos».
- Se guarda como **v1 borrador** en Mis documentos (del cliente elegido o «Sin cliente»), `source: 'generated'`, nota «Redactado desde cero con IA: …». Desde el resultado: *Ver documento*, *Cambios específicos* (abre Personalizar sobre esa versión; formato auténtico incluido) o *Abrir en Mis documentos* para aprobar/enviar.
- **Documento en blanco**: solo el título, sin IA, mismo destino.
- Registro de actividad: `documento.new`.

## Qué queda igual
Buscar modelos por nombre / con IA, Ver/Word/PDF, Llenar por etiquetas, Personalizar (datos del cliente o cambios específicos + formato auténtico, «Qué cambió»), Corregir, Mis documentos con versiones, aprobar y enviar por WhatsApp, subir Word/PDF, guardar como modelo, revisión de etiquetas del admin. Ningún endpoint existente cambió.

## Pendiente de decidir (Jay/Leandro) antes de producción
1. ¿`source` propio (`'ai_draft'`) para distinguir estos borradores? Hoy va como `generated` + nota; requeriría migración del CHECK de `portfolio_versions.source`.
2. ¿Los documentos desde cero deben poder «guardarse como modelo»? Hoy no (no tienen `template_id`).
3. Tamaño de página: carta (8.5×11). Varios modelos de Leandro están en legal (8.5×14).
4. ¿Favoritos por digitador en la biblioteca? (Smokeball) No está en el prototipo.
