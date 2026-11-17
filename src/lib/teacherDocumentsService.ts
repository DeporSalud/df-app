import { supabase } from "@/lib/supabase/client";

export type TeacherDocCategory =
  | "nomina"
  | "contrato"
  | "dni_identidad"
  | "seguro_certificado"
  | "otro";

export interface TeacherDocumentMeta {
  id: string;
  profesor_uuid: string;
  profesor_pin: string | null;
  profesor_nombre: string;
  categoria: TeacherDocCategory;
  titulo: string;
  periodo_mes: string | null;
  nombre_archivo: string;
  mime_type: string;
  tamano_bytes: number;
  notas: string | null;
  subido_por: string | null;
  creado_en: string;
}

export const TEACHER_DOC_CATEGORIES: {
  id: TeacherDocCategory;
  label: string;
  shortLabel: string;
}[] = [
  { id: "nomina", label: "Nómina Mensual", shortLabel: "Nómina" },
  { id: "contrato", label: "Contrato Laboral", shortLabel: "Contrato" },
  { id: "dni_identidad", label: "DNI / Identidad", shortLabel: "DNI / NIE" },
  { id: "seguro_certificado", label: "Seguro RC / Certificado", shortLabel: "Seguro / Cert." },
  { id: "otro", label: "Otro Documento", shortLabel: "Documento" },
];

const MONTHS_ES: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

const META_COLUMNS =
  "id, profesor_uuid, profesor_pin, profesor_nombre, categoria, titulo, periodo_mes, nombre_archivo, mime_type, tamano_bytes, notas, subido_por, creado_en";

export function formatPeriodoMesSpanish(periodo?: string | null): string {
  if (!periodo) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(periodo.trim());
  if (!match) return periodo;
  const [, year, month] = match;
  return `${MONTHS_ES[month] || month} ${year}`;
}

export function formatFileSize(bytes?: number | null): string {
  const b = Number(bytes || 0);
  if (b <= 0) return "PDF";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function getCategoryLabel(cat?: string | null): string {
  const found = TEACHER_DOC_CATEGORIES.find((c) => c.id === cat);
  return found ? found.shortLabel : "Documento";
}

function dataUrlToBlob(dataUrl: string, fallbackMime = "application/pdf"): Blob {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    return new Blob([dataUrl], { type: fallbackMime });
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = /data:([^;]+);base64/i.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function sortTeacherDocuments(docs: TeacherDocumentMeta[]): TeacherDocumentMeta[] {
  return [...docs].sort((a, b) => {
    const perA = a.periodo_mes || "";
    const perB = b.periodo_mes || "";
    if (perA !== perB) {
      return perB.localeCompare(perA);
    }
    return (b.creado_en || "").localeCompare(a.creado_en || "");
  });
}

export async function fetchTeacherDocuments(params: {
  uuid?: string | null;
  pin?: string | null;
  name?: string | null;
}): Promise<TeacherDocumentMeta[]> {
  const cleanUuid = (params.uuid || "").trim();
  const cleanPin = (params.pin || "").trim();
  const cleanName = (params.name || "").trim().toUpperCase();

  try {
    const queries: PromiseLike<{ data: any[] | null; error: any }>[] = [];

    if (cleanUuid) {
      queries.push(
        supabase
          .from("documentos_profesores")
          .select(META_COLUMNS)
          .eq("profesor_uuid", cleanUuid)
      );
    }
    if (cleanPin) {
      queries.push(
        supabase
          .from("documentos_profesores")
          .select(META_COLUMNS)
          .eq("profesor_pin", cleanPin)
      );
    }
    if (!cleanUuid && !cleanPin && cleanName) {
      queries.push(
        supabase
          .from("documentos_profesores")
          .select(META_COLUMNS)
          .ilike("profesor_nombre", cleanName)
      );
    }

    if (queries.length === 0) return [];

    const results = await Promise.all(queries);
    const byId = new Map<string, TeacherDocumentMeta>();
    for (const res of results) {
      if (!res.error && Array.isArray(res.data)) {
        for (const row of res.data) {
          if (row && row.id) {
            byId.set(row.id, row as TeacherDocumentMeta);
          }
        }
      }
    }
    return sortTeacherDocuments(Array.from(byId.values()));
  } catch (err) {
    console.error("[TeacherDocs] Error cargando documentos:", err);
    return [];
  }
}

export async function openOrDownloadTeacherDocument(
  docId: string,
  mode: "view" | "download"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("documentos_profesores")
      .select("id, archivo_data, nombre_archivo, mime_type")
      .eq("id", docId)
      .single();

    if (error || !data || !data.archivo_data) {
      return {
        success: false,
        error: "No se pudo recuperar el archivo del documento.",
      };
    }

    const blob = dataUrlToBlob(data.archivo_data, data.mime_type || "application/pdf");
    const blobUrl = URL.createObjectURL(blob);

    if (mode === "view") {
      const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } else {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = data.nombre_archivo || "documento-profesor.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60_000);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al abrir o descargar el documento.",
    };
  }
}
