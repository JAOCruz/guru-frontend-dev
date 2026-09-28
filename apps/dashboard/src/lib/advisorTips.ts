// Tips for the Gurú owl advisor, grouped by type. `pages` limits a tip to those
// routes (dashboard help), `role` to admins or employees. Laws are cited by number
// only when well established; staff should still check the current text.

export type TipCategory = "juridico" | "leyes" | "digitacion" | "documentos" | "cliente" | "dashboard";

export interface Tip {
  id: string;
  category: TipCategory;
  text: string;
  pages?: string[];
  role?: "admin" | "employee";
}

export const CATEGORIES: { key: TipCategory; label: string; emoji: string }[] = [
  { key: "juridico", label: "Consejo jurídico", emoji: "⚖️" },
  { key: "leyes", label: "Leyes RD", emoji: "📜" },
  { key: "digitacion", label: "Trucos de digitación", emoji: "⌨️" },
  { key: "documentos", label: "Documentos y trámites", emoji: "📄" },
  { key: "cliente", label: "Clientes y negocio", emoji: "🤝" },
  { key: "dashboard", label: "Tips del dashboard", emoji: "🧭" },
];

const t = (category: TipCategory, list: (string | Omit<Tip, "id" | "category">)[]): Tip[] =>
  list.map((item, i) => ({
    id: `${category}-${i}`,
    category,
    ...(typeof item === "string" ? { text: item } : item),
  }));

export const TIPS: Tip[] = [
  ...t("juridico", [
    "Un contrato con tachaduras o espacios en blanco es vulnerable a la nulidad. Cierra cada espacio con líneas antes de imprimir.",
    "Todo acto de venta debe firmarse con ambas partes presentes o confirmadas. Es tu mejor defensa contra el fraude.",
    "El intérprete judicial da fe de su traducción, no de la veracidad del documento original. No confundas esos roles.",
    "Los poderes especiales para salida de menores tienen una vigencia práctica: revisa las fechas del viaje antes de redactarlos.",
    "Un contrato válido necesita consentimiento, capacidad, objeto y causa. Si falta uno, pregunta antes de redactar.",
    "Acto auténtico (redactado por el notario) y acto bajo firma privada (el notario solo legaliza firmas) no son lo mismo. Pregunta cuál necesita el cliente.",
    "Si el cliente firma en representación de otra persona o de una empresa, pide el poder o la resolución que lo autoriza.",
    "Nunca asumas un dato: confírmalo con el cliente. Un nombre mal escrito puede invalidar todo el trámite.",
  ]),
  ...t("leyes", [
    "La Ley 140-15 del Notariado regula los actos notariales y los honorarios. Conocerla te da autoridad frente a clientes exigentes.",
    "La Ley 155-17 contra el lavado de activos es estricta: en operaciones altas (vehículos, inmuebles) exige comprobantes del origen del dinero.",
    "La Ley 108-05 de Registro Inmobiliario rige los títulos. Antes de una venta, pide la certificación de estado jurídico del inmueble.",
    "La Ley 172-13 protege los datos personales: no compartas cédulas ni datos de clientes por canales no autorizados.",
    "La Ley 126-02 da validez a los documentos y firmas digitales. Pregunta si el cliente acepta la vía digital para ahorrar tiempo.",
    "La Ley 136-03 (Código de Niños, Niñas y Adolescentes) regula los permisos de salida de menores. Verifica quién tiene la autoridad parental.",
    "La Ley 16-92 (Código de Trabajo) aplica a contratos laborales y cartas de despido. Usa las plantillas actualizadas.",
    "La República Dominicana es parte del Convenio de La Haya: los documentos para el exterior se apostillan en el MIREX.",
    "Leyes y tasas cambian: antes de citar un monto o artículo, verifica la versión vigente.",
  ]),
  ...t("digitacion", [
    "Ctrl+H (buscar y reemplazar) cambia un nombre en todo el documento de una vez. Úsalo al reciclar una plantilla.",
    "Shift+F3 en Word alterna entre MAYÚSCULAS, minúsculas y Tipo Título sin volver a escribir.",
    "F7 en Word revisa la ortografía. Pásalo siempre antes de imprimir; los nombres propios, verifícalos contra la cédula.",
    "Pega texto de WhatsApp o del correo como «solo texto» (pegado especial) para no arrastrar formatos raros.",
    "Escribe los montos en letras y números: RD$15,000.00 (QUINCE MIL PESOS DOMINICANOS CON 00/100).",
    "La cédula tiene 11 dígitos con formato 000-0000000-0. Cuenta los dígitos: un error obliga a repetir el trámite.",
    "En actos formales escribe las fechas en letras y números: «a los quince (15) días del mes de octubre del año dos mil veintiséis (2026)».",
    "Guarda con Ctrl+S cada pocos minutos. Un corte de luz no debe costarte un contrato completo.",
    "Numera las páginas como «Página X de Y» en documentos largos; evita que se pierdan o se cambien hojas.",
  ]),
  ...t("documentos", [
    "Un error de un dígito en una cédula obliga a recomenzar el proceso en la Procuraduría. Revisa dos veces.",
    "Antes de apostillar, confirma el país de destino y si exige traducción judicial del documento.",
    "Escanea a 300 dpi y en PDF. Nombra los archivos CLIENTE_TIPO_FECHA para encontrarlos rápido.",
    "Pide copia de la cédula por ambos lados y verifica que esté vigente antes de redactar.",
    "Algunos trámites en el exterior piden el acta inextensa, no el extracto. Pregunta antes de solicitarla a la JCE.",
    "Los trámites institucionales exigen al menos 24 a 48 horas. No prometas tiempos imposibles.",
    "Una vez terminada la digitación y la facturación, guarda el documento en el folio del cliente. Los datos son oro.",
    "Incluye la tasa registral en el presupuesto inicial de los actos auténticos para no sorprender al cliente.",
  ]),
  ...t("cliente", [
    "Tu rol no es solo digitar, es asesorar. Escucha el problema de fondo del cliente antes de cotizar.",
    "El activo más valioso de Gurú Soluciones es la confianza. Explica cada cobro con claridad.",
    "Cada cliente es un socio a largo plazo. Un seguimiento a la semana vale más que un descuento.",
    "La calidad de nuestras impresiones es nuestra carta de presentación. No entregues hojas manchadas.",
    "Los cobros de mensajería van atados al tabulador de distancias. No regales el trabajo logístico.",
    "Si el cliente aprobó el borrador y luego de impreso notó un error, la reimpresión corre por su cuenta.",
    "Si un trámite fracasa por causas externas, nuestra política conserva el 30% del honorario por gestión.",
    "Responde rápido por WhatsApp, aunque sea para decir «lo reviso y te confirmo». El silencio pierde clientes.",
  ]),
  ...t("dashboard", [
    { text: "Crea la cotización y pide la aprobación del admin. Cuando la apruebe, podrás verla y enviarla por WhatsApp.", pages: ["/cotizaciones", "/bot-messages"], role: "employee" },
    { text: "La pestaña «Por aprobar» se pone naranja cuando hay documentos esperando por ti. Revísalos antes de cerrar el día.", pages: ["/cotizaciones"], role: "admin" },
    { text: "Busca por cliente, teléfono o número de documento. El resto de los filtros está en el botón «Filtros».", pages: ["/cotizaciones"] },
    { text: "Puedes cotizar sin salir del chat: el documento toma el nombre y el teléfono del cliente de la conversación.", pages: ["/bot-messages"] },
    { text: "Antes de cotizar, confirma en el chat el nombre completo del cliente tal como aparece en su cédula.", pages: ["/bot-messages"] },
    { text: "En «Mis datos» puedes agregar tu fecha de nacimiento, y arriba elegir tu animal y tu color.", pages: ["/mi-cuenta"] },
    { text: "Si alguien deja el equipo, desactívalo y reasigna sus clientes: su historial se conserva.", pages: ["/usuarios"], role: "admin" },
    { text: "En «Actividad» ves quién hizo cada cambio. Úsalo para aclarar dudas sin buscar culpables.", pages: ["/actividad"], role: "admin" },
    "¿Te tapo algo? Arrástrame a cualquier parte de la pantalla.",
    "Cierra este globo con la X; tu preferencia se recuerda. Toca al búho cuando quieras otro consejo.",
    { text: "¿Olvidaste tu contraseña? Pídele al admin una contraseña temporal desde Usuarios.", role: "employee" },
  ]),
];

export const WELCOME_TIP = "ASISTENCIA EN LÍNEA: Toca al búho para recibir un consejo. Abajo puedes elegir el tema.";

export function eligibleTips({ category, path, isAdmin }: { category: TipCategory | "all"; path: string; isAdmin: boolean }): Tip[] {
  return TIPS.filter(
    (tip) =>
      (category === "all" || tip.category === category) &&
      (!tip.pages || tip.pages.some((p) => path === p || path.startsWith(`${p}/`))) &&
      (!tip.role || tip.role === (isAdmin ? "admin" : "employee")),
  );
}

// Shuffle-bag: every eligible tip comes up once, in random order, before any repeats;
// the same tip never shows twice in a row. A new pool (other topic or page) starts a new bag.
export function createTipPicker(random: () => number = Math.random) {
  let bag: Tip[] = [];
  let poolKey = "";
  let last: string | null = null;
  return (pool: Tip[]): Tip => {
    const key = pool.map((p) => p.id).join("|");
    if (key !== poolKey || bag.length === 0) {
      poolKey = key;
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1].id === last) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    const tip = bag.pop()!;
    last = tip.id;
    return tip;
  };
}
