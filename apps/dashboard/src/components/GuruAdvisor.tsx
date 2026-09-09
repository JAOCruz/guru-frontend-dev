import { useState, useRef } from "react";
import { NeoCard } from "@guru/ui";
import { Sparkles, X } from "lucide-react";

const tips = [
  "ASISTENCIA EN LÍNEA: Haz clic sobre mí para consultar directrices corporativas y jurídicas.",
  "ÉTICA PROFESIONAL: El activo más valioso de Gurú Soluciones es la confianza. Jamás asumas un dato, confírmalo con el cliente.",
  "DERECHO CIVIL 101: Un contrato con tachaduras o espacios en blanco es vulnerable a la nulidad. Perfila tus documentos.",
  "ADMINISTRACIÓN: Recuerda, si un trámite fracasa por negligencia externa, nuestra política protege el 30% del honorario por gestión.",
  "EFICIENCIA OPERATIVA: No garantices tiempos imposibles. Trámites institucionales exigen un mínimo de 24 a 48 horas.",
  "LEY NOTARIAL: La Ley 140-15 es nuestra guía de honorarios. Conocerla te da autoridad frente a clientes exigentes.",
  "ATENCIÓN AL CLIENTE: Tu rol no es solo digitar, es asesorar. Escucha el problema de fondo del cliente antes de cotizar.",
  "SOPORTE LEGAL: Los Poderes Especiales para salida de menores tienen fecha de caducidad práctica. Vigila el itinerario de vuelo.",
  "GESTIÓN FINANCIERA: Exige comprobantes bancarios para operaciones vehiculares altas; la Ley de Lavado de Activos (155-17) es estricta.",
  "CONTROL DE CALIDAD: Sé meticuloso. Un error de un dígito en una cédula obliga a recomenzar todo el proceso en la Procuraduría.",
  "DERECHO INTERNACIONAL: Antes de apostillar, valida el país de destino en la lista actualizada del Convenio de La Haya.",
  "PROTOCOLOS: El Intérprete Judicial da fe de su traducción, pero no de la veracidad del documento original. Diferencia estos roles.",
  "GESTIÓN DE RIESGOS: Todo acto de venta debe firmarse con ambas partes presentes o confirmadas. Evita el fraude.",
  "SERVICIO VIP: La calidad 'Experta' de nuestras impresiones es nuestra carta de presentación física. No entregues hojas manchadas.",
  "VISIÓN DE NEGOCIO: Cada cliente que atendemos es un potencial socio comercial a largo plazo. Cultiva la relación.",
  "FINANZAS INTERNAS: Los cobros de mensajería están directamente atados al tabulador de distancias. No regales el trabajo logístico.",
  "TRÁMITES AYUNTAMIENTO: Asegúrate de incluir la tasa registral (aprox RD$300) dentro de tu presupuesto inicial para actos auténticos.",
  "DIGITALIZACIÓN: El Apostille permite el pago de impuestos en línea si el documento cuenta con código de barras validable. Aprovecha esto para ganar tiempo.",
  "SEGURIDAD DE LA INFORMACIÓN: Una vez concluida la digitación y facturación, asegúrate de almacenar los documentos en nuestro folio. Los datos son oro.",
  "FACTURACIÓN DE ERRORES: Si el cliente revisó el borrador, lo aprobó y luego de impreso notó un error, el costo de la reimpresión corre por él, no por la empresa.",
];

interface GuruAdvisorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GuruAdvisor({ isOpen, onOpenChange }: GuruAdvisorProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [animando, setAnimando] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    didDrag.current = false;
    dragStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    didDrag.current = true;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const getRandomTip = (current: number) => {
    if (tips.length <= 1) return 0;
    let next: number;
    do {
      next = Math.floor(Math.random() * tips.length);
    } while (next === current);
    return next;
  };

  const openWithNewTip = () => {
    if (didDrag.current) return;
    setAnimando(true);
    setTipIndex((prev) => getRandomTip(prev));
    onOpenChange(true);
    setTimeout(() => setAnimando(false), 300);
  };

  const closeTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(false);
  };

  return (
    <div
      className="group fixed bottom-6 right-6 z-[100] flex items-end gap-4 md:bottom-10 md:right-10"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        touchAction: "none",
      }}
    >
      {isOpen && (
        <NeoCard
          className={`relative max-w-[260px] overflow-hidden border-2 border-border bg-background px-5 py-4 pr-10 shadow-shadow transition-all ${
            animando ? "scale-95 opacity-60" : "scale-100 opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={closeTip}
            aria-label="Cerrar consejo"
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-base border-2 border-border bg-main text-main-foreground shadow-button transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-95"
          >
            <X size={14} strokeWidth={3} />
          </button>
          <div className="absolute top-0 left-0 h-1 w-full bg-main" />
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-main">
            <Sparkles size={12} />
            Gurú // Asesoría Jurídica
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {tips[tipIndex]}
          </p>
          <p className="mt-3 text-right text-[9px] font-black uppercase tracking-widest text-foreground/50">
            Click en el búho para otro tip
          </p>
        </NeoCard>
      )}

      <div
        className="relative cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={openWithNewTip}
      >
        <div className="absolute inset-0 rounded-full bg-main/20 opacity-60 blur-[16px] transition-opacity group-hover:opacity-100" />
        <div className="relative z-10 select-none text-6xl drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105 active:scale-95">
          🦉
        </div>
      </div>
    </div>
  );
}