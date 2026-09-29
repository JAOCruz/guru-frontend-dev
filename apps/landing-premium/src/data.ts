export const WHATSAPP_NUMBER = "18298049017";
export const INSTAGRAM = "https://instagram.com/gurusolucionesrd";
export const EMAIL = "gurusoluciones01@gmail.com";
export const ADDRESS = "Av. Independencia 1607, Santo Domingo 10101, La Feria (frente a la OGM)";
export const MAPS_URL = "https://maps.google.com/?q=Av.+Independencia+1607,+Santo+Domingo";

export function whatsappLink(message = "Hola Gurú, quiero información sobre sus servicios.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export interface Service {
  slug: string;
  name: string;
  description: string;
  image: string;
}

export const SERVICES: Service[] = [
  { slug: "contratos", name: "Digitación de Contratos", description: "Contratos legales redactados con máxima precisión y rapidez.", image: "/img/digitacion_contratos.webp" },
  { slug: "notario", name: "Abogado Notario", description: "Notarización y asesoría legal por abogados certificados.", image: "/img/abogado_notario.webp" },
  { slug: "certificaciones", name: "Solicitud de Certificaciones", description: "Gestionamos certificaciones digitales y legales en instituciones públicas.", image: "/img/solicitud_certificaciones.webp" },
  { slug: "traduccion", name: "Traducción e Intérprete Judicial", description: "Traducción profesional de documentos legales en varios idiomas.", image: "/img/traduccion.webp" },
  { slug: "fotos", name: "Fotos 2x2", description: "Fotografía profesional para documentos oficiales y trámites.", image: "/img/fotos_2x2.webp" },
  { slug: "impresion", name: "Servicio de Impresión", description: "Impresión de alta calidad para contratos y certificaciones.", image: "/img/impresion.webp" },
  { slug: "impuestos", name: "Compra de Impuestos", description: "Compra de impuestos internos con asesoría para tus trámites fiscales.", image: "/img/compra_impuestos.webp" },
  { slug: "tienda", name: "Artículos / Tienda", description: "Productos especializados para trámites legales.", image: "/img/articulos_tienda.webp" },
  { slug: "mensajeria", name: "Mensajería Express", description: "Depósito y entrega rápida y segura de documentos importantes.", image: "/img/mensajeria.webp" },
];
