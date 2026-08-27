export interface VentajaItem {
  id: string;
  categoria: "merch" | "bonos" | "salud" | "descuentos";
  titulo: string;
  badge: string;
  badgeColor?: string;
  precioAlumno: string;
  precioOriginal?: string;
  descuentoTexto?: string;
  descripcion: string;
  caracteristicas: string[];
  tallas?: string[];
  iconoTipo: "sudadera" | "camiseta" | "mochila" | "botella" | "bono" | "fisio" | "tienda";
  activo: boolean;
  codigoCupon?: string;
  creadoEn?: string;
}

export interface SolicitudVentaja {
  id: string;
  ventaja_id: string;
  ventaja_titulo: string;
  alumno_id: string;
  alumno_nombre: string;
  alumno_email?: string;
  alumno_telefono?: string;
  talla_elegida?: string;
  precio: string;
  fecha: string;
  estado: "Pendiente" | "Entregado" | "Cancelado";
  sede?: string;
}

export const INITIAL_VENTAJAS: VentajaItem[] = [
  {
    id: "sudadera_df_black",
    categoria: "merch",
    titulo: "Sudadera Dance Factory (Oversize Black Edition)",
    badge: "OFERTA ALUMNOS",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    precioAlumno: "32,00 €",
    precioOriginal: "45,00 €",
    descuentoTexto: "-28% DTO",
    descripcion: "Sudadera con capucha de corte moderno oversize, tejido 100% algodón perchado de 340g con bordado frontal exclusivo y forro reforzado.",
    caracteristicas: ["Bordado frontal exclusivo Dance Factory", "Capucha con forro reforzado", "Unisex (S, M, L, XL)"],
    tallas: ["S", "M", "L", "XL"],
    iconoTipo: "sudadera",
    activo: true
  },
  {
    id: "camiseta_df_flow",
    categoria: "merch",
    titulo: "Camiseta Dance Factory 'Step & Flow'",
    badge: "EDICIÓN LIMITADA",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    precioAlumno: "16,00 €",
    precioOriginal: "25,00 €",
    descuentoTexto: "-36% DTO",
    descripcion: "Camiseta técnica y transpirable diseñada específicamente para entrenamientos de alta intensidad y clases de baile.",
    caracteristicas: ["Tejido ultra ligero y transpirable", "Diseño serigrafiado de máxima duración", "Ajuste cómodo loose-fit"],
    tallas: ["XS", "S", "M", "L", "XL"],
    iconoTipo: "camiseta",
    activo: true
  },
  {
    id: "mochila_df_duffel",
    categoria: "merch",
    titulo: "Bolsa Deportiva DF Pro Duffel (45L)",
    badge: "TOP VENTAS",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    precioAlumno: "24,00 €",
    precioOriginal: "38,00 €",
    descuentoTexto: "-37% DTO",
    descripcion: "Bolsa espaciosa de viaje y entrenamiento con compartimento lateral ventilado independiente para zapatillas de baile.",
    caracteristicas: ["Compartimento zapatero ventilado", "Bolsillo impermeable para ropa húmeda", "Correa acolchada ajustable"],
    iconoTipo: "mochila",
    activo: true
  },
  {
    id: "botella_df_inox",
    categoria: "merch",
    titulo: "Botella Térmica Inox DF (750 ml)",
    badge: "ECO LIFE",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    precioAlumno: "12,00 €",
    precioOriginal: "18,00 €",
    descuentoTexto: "-33% DTO",
    descripcion: "Botella de acero inoxidable de doble pared al vacío. Mantiene tus bebidas frías 24h o calientes 12h durante tus clases.",
    caracteristicas: ["Acero inoxidable 18/8 grado alimenticio", "Tapón a prueba de fugas", "Grabado láser Dance Factory"],
    iconoTipo: "botella",
    activo: true
  },
  {
    id: "bono_intensivo_master",
    categoria: "bonos",
    titulo: "Bono Especial Masterclasses & Intensivos (3 Sesiones)",
    badge: "PROMO ESPECIAL",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    precioAlumno: "45,00 €",
    precioOriginal: "65,00 €",
    descuentoTexto: "-30% DTO",
    descripcion: "Acceso preferente con descuento de alumno a 3 masterclasses o talleres intensivos de fin de semana con coreógrafos invitados.",
    caracteristicas: ["Válido durante toda la temporada", "Reserva prioritaria de plaza", "Acreditación y diploma de asistencia"],
    iconoTipo: "bono",
    activo: true
  },
  {
    id: "fisio_convenio",
    categoria: "salud",
    titulo: "Fisioterapia & Descarga Muscular para Bailarines",
    badge: "CONVENIO SALUD",
    badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    precioAlumno: "35,00 €/sesión",
    precioOriginal: "50,00 €",
    descuentoTexto: "-30% DTO",
    descripcion: "Sesiones de fisioterapia deportiva, punción seca y terapia manual en la clínica colaboradora de Alcorcón.",
    caracteristicas: ["Especialistas en biomecánica de la danza", "Prevención y recuperación de sobrecargas", "Cita prioritaria para alumnos DF"],
    iconoTipo: "fisio",
    activo: true
  },
  {
    id: "calzado_descuento",
    categoria: "descuentos",
    titulo: "15% DTO en Calzado Urbano y Sneakers Dance",
    badge: "CÓDIGO EXCLUSIVO",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    precioAlumno: "Cupón 15%",
    precioOriginal: "",
    descuentoTexto: "15% DTO",
    descripcion: "Descuento directo en tienda física colaboradora de Alcorcón y en tienda online presentando tu carnet digital.",
    caracteristicas: ["Válido en marcas seleccionadas de calzado", "Canjeable mostrando el carnet QR en caja", "Código online: DANCEFACTORY15"],
    iconoTipo: "tienda",
    codigoCupon: "DANCEFACTORY15",
    activo: true
  }
];

const STORAGE_KEY = "df_ventajas_catalog_v2";
const RESERVAS_KEY = "df_ventajas_reservas_v2";

export function getVentajasCatalog(): VentajaItem[] {
  if (typeof window === "undefined") return INITIAL_VENTAJAS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_VENTAJAS));
      return INITIAL_VENTAJAS;
    }
    const parsed = JSON.parse(raw);
    return parsed.map((i: any) => ({
      id: i.id || `ventaja_${Math.random()}`,
      categoria: i.categoria || "merch",
      titulo: i.titulo || i.title || "Artículo",
      badge: i.badge || "OFERTA",
      badgeColor: i.badgeColor || "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      precioAlumno: i.precioAlumno || i.studentPrice || "0,00 €",
      precioOriginal: i.precioOriginal || i.originalPrice,
      descuentoTexto: i.descuentoTexto || i.discountBadge,
      descripcion: i.descripcion || i.description || "",
      caracteristicas: i.caracteristicas || i.details || [],
      tallas: i.tallas || i.sizes,
      iconoTipo: i.iconoTipo || i.iconType || "sudadera",
      codigoCupon: i.codigoCupon || (i.id === "calzado_descuento" ? "DANCEFACTORY15" : undefined),
      activo: i.activo !== false,
      creadoEn: i.creadoEn || new Date().toISOString()
    }));
  } catch (e) {
    return INITIAL_VENTAJAS;
  }
}

export function saveVentajasCatalog(items: VentajaItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("df_ventajas_updated"));
  } catch (e) {
    console.error("Error saving ventajas catalog:", e);
  }
}

export function getSolicitudesVentajas(): SolicitudVentaja[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RESERVAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSolicitudVentaja(solicitud: SolicitudVentaja): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSolicitudesVentajas();
    const updated = [solicitud, ...current.filter(s => s.id !== solicitud.id)];
    localStorage.setItem(RESERVAS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("df_solicitudes_ventajas_updated"));
  } catch (e) {
    console.error("Error saving solicitud ventaja:", e);
  }
}

export function updateSolicitudStatus(id: string, estado: "Pendiente" | "Entregado" | "Cancelado"): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSolicitudesVentajas();
    const updated = current.map(s => s.id === id ? { ...s, estado } : s);
    localStorage.setItem(RESERVAS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("df_solicitudes_ventajas_updated"));
  } catch (e) {
    console.error("Error updating solicitud status:", e);
  }
}
