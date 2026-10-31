// Guía interna para digitadores: cómo se hace cada servicio y cada trámite.
// Datos copiados tal cual de la referencia «Gurú OS» (Gemini Canvas) — contenido de Leandro.

export interface Servicio {
  id: number;
  title: string;
  emoji: string;
  desc: string;
  reglas: string[];
  incluye: string[];
}

export interface Tramite {
  id: string;
  title: string;
  emoji: string;
  pasos: string[];
  costos: { item: string; p: string }[];
  preguntas: string[];
}

export const serviciosData: Servicio[] = [
  {
    id: 1, title: "Digitación", emoji: "⌨️",
    desc: "Redacción de contratos legales desde cero (civiles, penales, notariales, comerciales). Considerada la principal actividad económica.",
    reglas: ["Si un documento requiere modificar muchos puntos, conviene procesar una redacción nueva.", "El documento se redacta utilizando información suministrada por el usuario."],
    incluye: ["Guardar una copia en nuestro folio.", "Una IMPRESIÓN del primer original."]
  },
  {
    id: 2, title: "Modificaciones", emoji: "✍️",
    desc: "Cambiar detalles selectivos del documento sin alterar la esencia del mismo. No es una redacción final.",
    reglas: ["No es REDACCION FINAL (no procesado por nosotros).", "Si pasa de 3 modificaciones, se recomienda una REDACCION.", "Documento suministrado por el usuario."],
    incluye: ["Verificación completa de inconsistencias.", "Una IMPRESIÓN del documento modificado."]
  },
  {
    id: 3, title: "Impresión", emoji: "🖨️",
    desc: "Imprimir, editar, cortar y embellecer documentos o fotos para lograr una calidad experta.",
    reglas: ["Impresiones erróneas por equivocación del cliente serán cobradas.", "Formatos de extensión admisibles obligatorios."],
    incluye: ["Organización del expediente.", "Vigilancia constante de calidad.", "Precios asequibles."]
  },
  {
    id: 4, title: "Escáner", emoji: "📸",
    desc: "Digitalización ordenada para mejor visualización. ¡Servicio Gamificado!",
    reglas: ["A mayor calidad, menor será el precio.", "Asegurar el destinatario de envío."],
    incluye: ["Un envío GRATIS al escanear.", "Copia de respaldo en base de datos."]
  },
  {
    id: 5, title: "Cert. Online", emoji: "🌐",
    desc: "Solicitudes ante instituciones públicas/privadas utilizando información del cliente.",
    reglas: ["Solicitudes con 48 horas de antelación.", "Los documentos subidos no aseguran aprobación de la institución."],
    incluye: ["Seguimiento diario.", "Garantía de custodia de docs.", "Recordatorios al cliente."]
  },
  {
    id: 6, title: "Traducción", emoji: "🌍",
    desc: "Transcripción a otro idioma, firmada y sellada por intérprete judicial.",
    reglas: ["Solo traducimos la versión final oficial.", "Se cobra por página, formato y caracteres."],
    incluye: ["Intérprete judicial avalado.", "Seguimiento continuo.", "Doble revisión administrativa."]
  },
  {
    id: 7, title: "Notarización", emoji: "⚖️",
    desc: "Aprobación y firma con abogado notario público para validez legal.",
    reglas: ["Documentos deben ser coherentes.", "Precios regulados por ley 140-15.", "Notario firma hasta 2 originales (resto son duplicados)."],
    incluye: ["Abogado Notario correspondiente.", "Doble revisión administrativa."]
  },
  {
    id: 8, title: "Mensajería", emoji: "🛵",
    desc: "Llevar documentos, hacer filas y depositar expedientes en instituciones.",
    reglas: ["Precio depende del mensajero y distancia.", "Precios/impuestos regulados por administración.", "Mínimo 24 horas para agendar."],
    incluye: ["Mensajero responsable.", "Garantía contra pérdida en trayecto."]
  },
  {
    id: 9, title: "Trámites", emoji: "📑",
    desc: "Combinación de servicios para completar un proceso legal o emitir certificación.",
    reglas: ["No todos los trámites son admitidos.", "Si se cae el proceso, reembolso solo del 30%.", "Mínimo 24 horas para agendar."],
    incluye: ["Mensajería y organización.", "Garantía contra pérdida de documentos."]
  }
];

export const tramitesData: Tramite[] = [
  {
    id: "t1", title: "Traspaso Vehículo", emoji: "🚗",
    pasos: [
      "1. ACTO DE VENTA de vehículo debidamente notarizado.",
      "2. MENSAJERÍA (Opcional) para comprar impuestos (Reservas) y LEGALIZAR en Procuraduría.",
      "3. CERTIFICACIÓN VERIFICACIÓN en Plan Piloto (Cita presencial).",
      "4. CERTIFICACIÓN TRASPASO DGII. Pre-validación online y depósito físico."
    ],
    costos: [
      { item: "Acto de Venta", p: "RD$ 1,000+" },
      { item: "Impuesto Procuraduría", p: "RD$ 700" },
      { item: "Mensajería Legalización", p: "RD$ 1,000" },
      { item: "Verificación (Piloto)", p: "RD$ 500" },
      { item: "Cert. DGII", p: "RD$ 1,000" },
      { item: "Depósito DGII", p: "RD$ 3,000" },
      { item: "Impresión (Mat/Marb)", p: "RD$ 200" },
      { item: "Imp. Valor Vehículo", p: "2% Tabla" }
    ],
    preguntas: [
      "¿Doc hecho por nosotros o cliente?",
      "¿Excede Ley Lavado Activos 155-17? (Pedir recibo).",
      "¿Dónde está el vehículo? (Sin vehículo no hay proceso).",
      "¿Tachas, deudas u oposiciones?",
      "¿Marbete al día? ¿Choques/Robo?"
    ]
  },
  {
    id: "t2", title: "Salida de Menor", emoji: "✈️",
    pasos: [
      "1. PODER ESPECIAL de autorización notarizado.",
      "2. MENSAJERÍA (Opcional) para impuestos y LEGALIZAR en Procuraduría.",
      "3. CERTIFICACIÓN MIGRACIÓN (Pre-validación en plataforma).",
      "4. Recolectar/Imprimir docs (actas, fotos 2x2, sentencias).",
      "5. Depósito físico tras aprobación online."
    ],
    costos: [
      { item: "Poder Especial", p: "RD$ 1,500+" },
      { item: "Imp. Procuraduría", p: "RD$ 700" },
      { item: "Mensajería Legalización", p: "RD$ 1,000" },
      { item: "Solicitud Plataforma", p: "RD$ 1,000" },
      { item: "Imp. Viaje (Ley)", p: "RD$ 2,000" },
      { item: "Mensajería Depósito", p: "RD$ 3,000" }
    ],
    preguntas: [
      "REGLA: NO aceptar si viaja en < 24 hrs.",
      "¿Padre autorizante está en el país?",
      "¿Quién acompaña al menor? ¿Empresa?",
      "¿Doc hecho por nosotros o cliente?",
      "¿Tutela actual? ¿EZTA/Residencias?"
    ]
  },
  {
    id: "t3", title: "Registro Ayunt.", emoji: "🏛️",
    pasos: [
      "1. DOCUMENTO NOTARIAL AUTÉNTICO.",
      "2. MENSAJERÍA (Opcional) Registro Ayunt. (Solo SD).",
      "3. REDACCIÓN de Compulsa Notarial.",
      "4. MENSAJERÍA final para legalizar en Procuraduría."
    ],
    costos: [
      { item: "Contrato Auténtico", p: "RD$ 1,500+" },
      { item: "Mensajería Ayunt.", p: "RD$ 500" },
      { item: "Registro Ayunt.", p: "RD$ 300" },
      { item: "Imp. Procuraduría", p: "RD$ 700" },
      { item: "Mensajería Proc.", p: "RD$ 1,000" }
    ],
    preguntas: [
      "¿El documento es del cliente o nuestro?",
      "¿Está revisado y firmado por todos?"
    ]
  },
  {
    id: "t4", title: "Apostille", emoji: "🌍",
    pasos: [
      "1. DOCUMENTO NOTARIAL legal y validado.",
      "2. MENSAJERÍA (Opcional) legalización previa.",
      "3. Solicitar APOSTILLE en Relaciones Exteriores (MIREX)."
    ],
    costos: [
      { item: "Imp. Procuraduría", p: "RD$ 700" },
      { item: "Mensajería", p: "RD$ 1,000" },
      { item: "Imp. Apostille", p: "RD$ 620" },
      { item: "Apostille Consular", p: "RD$ 750" }
    ],
    preguntas: [
      "¿Doc está legalizado previamente?",
      "¿Sabías que el impuesto Apostille puede pagarse online?"
    ]
  },
  {
    id: "t5", title: "Trad. y Legalización", emoji: "🗣️",
    pasos: [
      "1. TRADUCCIÓN JUDICIAL oficial.",
      "2. Impresión y construcción de originales.",
      "3. MENSAJERÍA (Opcional) para Legalización.",
      "4. Entrega oficial al cliente."
    ],
    costos: [
      { item: "Traducción", p: "Según Cotización" },
      { item: "Impresiones/Notario", p: "Variable" }
    ],
    preguntas: [
      "¿El cliente necesitará que nosotros legalicemos también?"
    ]
  }
];

