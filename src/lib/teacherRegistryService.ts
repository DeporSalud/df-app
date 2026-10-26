import { supabase } from "@/lib/supabase/client";

export interface TeacherMeta {
  pin: string;
  active: boolean;
  especialidad?: string;
  sede?: string;
  isAdmin?: boolean;
}

export interface TeacherRecord {
  id: string; // Short ID / PIN used in UI & sessions (e.g. "1015", "9998", "9999")
  uuid: string; // Canonical UUID in `alumnos` table
  name: string; // Uppercase canonical name (e.g. "BLANCA ELÍAS")
  displayName: string; // Title-case display name (e.g. "Blanca Elías")
  email: string;
  telefono: string;
  pin: string; // 4-digit PIN
  especialidad: string;
  sede: string; // "tejar" | "castilla" | "consolidado"
  active: boolean; // true = can log in, false = access revoked
  isAdmin?: boolean;
}

export const TEACHER_META_MARKER = "DF_TEACHER_META:";
const REGISTRY_CACHE_KEY = "df_teachers_registry_cache_v2";

export function normalizeTeacherName(text?: string | null): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function toTitleCaseName(text?: string | null): string {
  const clean = (text || "").trim();
  if (!clean) return "";
  return clean
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word === "y" || word === "&" || word === "de" || word === "del") return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function extractCleanAddress(raw?: string | null): string {
  if (!raw) return "";
  const idx = raw.indexOf(TEACHER_META_MARKER);
  if (idx === -1) return raw.trim();
  return raw
    .slice(0, idx)
    .replace(/\|\|\s*$/, "")
    .trim();
}

export function parseTeacherMeta(raw?: string | null): TeacherMeta | null {
  if (!raw) return null;
  const idx = raw.indexOf(TEACHER_META_MARKER);
  if (idx === -1) return null;
  const jsonPart = raw.slice(idx + TEACHER_META_MARKER.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    if (parsed && typeof parsed === "object" && typeof parsed.pin === "string") {
      return {
        pin: parsed.pin,
        active: parsed.active !== false,
        especialidad: parsed.especialidad,
        sede: parsed.sede,
        isAdmin: Boolean(parsed.isAdmin)
      };
    }
  } catch {
    return null;
  }
  return null;
}

export const DEFAULT_TEACHER_RECORDS: TeacherRecord[] = [
  {
    id: "1001",
    uuid: "c57fb3d0-525f-474a-8de7-d6d504b540be",
    name: "LUCÍA MUÑOZ",
    displayName: "Lucía Muñoz",
    email: "lucia.munoz@dancefactory.es",
    telefono: "600000000",
    pin: "1001",
    especialidad: "Danza Urbana",
    sede: "tejar",
    active: true
  },
  {
    id: "1002",
    uuid: "2d95e851-b927-494b-9558-d7ed6d447a20",
    name: "LUCÍA ZAMORANO",
    displayName: "Lucía Zamorano",
    email: "lucia.zamorano@dancefactory.es",
    telefono: "600000000",
    pin: "1002",
    especialidad: "Contemporáneo",
    sede: "tejar",
    active: true
  },
  {
    id: "1003",
    uuid: "7a100300-0000-4000-a000-000000001003",
    name: "ANDREA SOTO",
    displayName: "Andrea Soto",
    email: "andrea.soto@dancefactory.es",
    telefono: "600000000",
    pin: "1003",
    especialidad: "Comercial & Open Classes",
    sede: "castilla",
    active: false
  },
  {
    id: "1004",
    uuid: "80c59814-1ab4-4793-9039-e8fe1c5ef681",
    name: "EVA LEIVA",
    displayName: "Eva Leiva",
    email: "eva.leiva@dancefactory.es",
    telefono: "600000000",
    pin: "1004",
    especialidad: "Jazz Lírico",
    sede: "castilla",
    active: true
  },
  {
    id: "1005",
    uuid: "7a100500-0000-4000-a000-000000001005",
    name: "LUCAS LÓPEZ",
    displayName: "Lucas López",
    email: "lucas.lopez@dancefactory.es",
    telefono: "600000000",
    pin: "1005",
    especialidad: "Hip Hop & Freestyle",
    sede: "tejar",
    active: true
  },
  {
    id: "1006",
    uuid: "32d7139b-b2a2-4084-9322-d86cda358df7",
    name: "PAULA JIMÉNEZ",
    displayName: "Paula Jiménez",
    email: "paula.jimenez@dancefactory.es",
    telefono: "600000000",
    pin: "1006",
    especialidad: "Ballet & Técnica",
    sede: "castilla",
    active: true
  },
  {
    id: "1007",
    uuid: "7a100700-0000-4000-a000-000000001007",
    name: "ABEL Y NAYARA",
    displayName: "Abel y Nayara",
    email: "abel.nayara@dancefactory.es",
    telefono: "600000000",
    pin: "1007",
    especialidad: "Salsa & Bachata",
    sede: "castilla",
    active: true
  },
  {
    id: "1008",
    uuid: "7a100800-0000-4000-a000-000000001008",
    name: "DARÍO HUMBERTO",
    displayName: "Darío Humberto",
    email: "dario.humberto@dancefactory.es",
    telefono: "600000000",
    pin: "1008",
    especialidad: "Urbano & Acrobacia",
    sede: "tejar",
    active: true
  },
  {
    id: "1009",
    uuid: "7a100900-0000-4000-a000-000000001009",
    name: "NEREA OLIVARES",
    displayName: "Nerea Olivares",
    email: "nerea.olivares@dancefactory.es",
    telefono: "600000000",
    pin: "1009",
    especialidad: "Danza Infantil & Juvenil",
    sede: "tejar",
    active: true
  },
  {
    id: "1010",
    uuid: "7a101000-0000-4000-a000-000000001010",
    name: "ALEJANDRO ROVINA",
    displayName: "Alejandro Rovina",
    email: "alejandro.rovina@dancefactory.es",
    telefono: "600000000",
    pin: "1010",
    especialidad: "Heels & Comercial",
    sede: "castilla",
    active: true
  },
  {
    id: "1011",
    uuid: "7a101100-0000-4000-a000-000000001011",
    name: "NIL BARBERÁ",
    displayName: "Nil Barberá",
    email: "nil.barbera@dancefactory.es",
    telefono: "600000000",
    pin: "1011",
    especialidad: "Dirección",
    sede: "castilla",
    active: true
  },
  {
    id: "1012",
    uuid: "145547d1-643c-40aa-9144-305893e8f64c",
    name: "MARIO GADEA",
    displayName: "Mario Gadea",
    email: "mario.gadea@dancefactory.es",
    telefono: "600000000",
    pin: "1012",
    especialidad: "Comercial & Open Classes",
    sede: "castilla",
    active: true
  },
  {
    id: "1013",
    uuid: "0812eb2d-bcb5-4f9e-b690-1beaafcd3e61",
    name: "DANIELA MÉRIDA",
    displayName: "Daniela Mérida",
    email: "daniela.merida@dancefactory.es",
    telefono: "600000000",
    pin: "1013",
    especialidad: "Urbano Adultos & Comercial",
    sede: "castilla",
    active: true
  },
  {
    id: "1014",
    uuid: "e9cc4200-aba2-4e67-8191-808c40e75621",
    name: "MARTA GARCÍA VÁZQUEZ",
    displayName: "Marta García Vázquez",
    email: "marta.garci.013@gmail.com",
    telefono: "600000000",
    pin: "1014",
    especialidad: "Redes Sociales & Comunicación",
    sede: "tejar",
    active: true
  },
  {
    id: "1015",
    uuid: "7a101500-0000-4000-a000-000000001015",
    name: "BLANCA ELÍAS",
    displayName: "Blanca Elías",
    email: "blanca.elias@dancefactory.es",
    telefono: "600000000",
    pin: "1015",
    especialidad: "Comercial",
    sede: "castilla",
    active: true
  },
  {
    id: "9998",
    uuid: "ffd8f04a-5f63-4c8b-b638-9f9483df8d3c",
    name: "RUTH DOMÍNGUEZ",
    displayName: "Ruth Domínguez",
    email: "ruth.dominguez@dancefactory.es",
    telefono: "600000000",
    pin: "2026",
    especialidad: "Dirección",
    sede: "consolidado",
    active: true,
    isAdmin: true
  },
  {
    id: "9999",
    uuid: "ffd8f04a-5f63-4c8b-b638-9f9483df8d3c",
    name: "ADMINISTRADOR MASTER",
    displayName: "Administrador Master",
    email: "admin@dancefactory.es",
    telefono: "600000000",
    pin: "9999",
    especialidad: "Dirección",
    sede: "consolidado",
    active: true,
    isAdmin: true
  }
];

export function getInitialTeacherRecords(onlyActive = false): TeacherRecord[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(REGISTRY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return onlyActive ? parsed.filter((t: TeacherRecord) => t.active) : parsed;
        }
      }
    } catch {
      // Fallback to defaults
    }
  }
  return onlyActive
    ? DEFAULT_TEACHER_RECORDS.filter((t) => t.active)
    : [...DEFAULT_TEACHER_RECORDS];
}

export function buildTeacherUuidMap(records: TeacherRecord[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const t of records) {
    if (!t.uuid) continue;
    if (t.pin) map[t.pin] = t.uuid;
    if (t.id) map[t.id] = t.uuid;
    map[t.name.toUpperCase().trim()] = t.uuid;
    map[normalizeTeacherName(t.name)] = t.uuid;
  }
  return map;
}

export function mergeTeachersFromAlumnosRows(rows: any[] | null | undefined): TeacherRecord[] {
  const byKey = new Map<string, TeacherRecord>();

  for (const def of DEFAULT_TEACHER_RECORDS) {
    const key = def.isAdmin ? `admin_${def.id}` : def.uuid;
    byKey.set(key, { ...def });
  }

  if (Array.isArray(rows) && rows.length > 0) {
    for (const row of rows) {
      if (!row || !row.id) continue;
      const meta = parseTeacherMeta(row.direccion);
      const existingDefault = byKey.get(row.id);
      const nfcStr = String(row.nfc_token || "").trim().toUpperCase();
      const planStr = String(row.plan_activo || "").toLowerCase();
      const isStatusInactive = String(row.estado || "").trim().toLowerCase() === "inactivo";

      if (!meta && !existingDefault && !nfcStr.startsWith("PROF-")) {
        continue;
      }

      if (!meta && !existingDefault && planStr.includes("sin plan")) {
        continue;
      }

      const inferredPin =
        meta?.pin ||
        existingDefault?.pin ||
        (nfcStr.startsWith("PROF-") && /^\d{4}$/.test(nfcStr.slice(5)) ? nfcStr.slice(5) : "");

      if (!inferredPin) continue;

      const rawName = String(row.nombre_completo || existingDefault?.name || "").trim();
      const upperName = rawName ? rawName.toUpperCase() : existingDefault?.name || "DOCENTE";
      const displayName = existingDefault?.displayName && normalizeTeacherName(existingDefault.displayName) === normalizeTeacherName(rawName)
        ? existingDefault.displayName
        : toTitleCaseName(rawName);

      const isActive = meta ? Boolean(meta.active) && !isStatusInactive : !isStatusInactive && (existingDefault ? existingDefault.active : true);

      const merged: TeacherRecord = {
        id: existingDefault?.id || inferredPin,
        uuid: row.id,
        name: upperName,
        displayName,
        email: row.email || existingDefault?.email || `${normalizeTeacherName(upperName).toLowerCase().replace(/\s+/g, ".")}@dancefactory.es`,
        telefono: row.telefono || existingDefault?.telefono || "600000000",
        pin: inferredPin,
        especialidad: meta?.especialidad || existingDefault?.especialidad || "Danza & Formación",
        sede: meta?.sede || row.sede || existingDefault?.sede || "castilla",
        active: isActive,
        isAdmin: Boolean(meta?.isAdmin || existingDefault?.isAdmin)
      };

      byKey.set(row.id, merged);
    }
  }

  const result = Array.from(byKey.values());
  result.sort((a, b) => {
    if (Boolean(a.isAdmin) !== Boolean(b.isAdmin)) {
      return a.isAdmin ? 1 : -1;
    }
    return a.pin.localeCompare(b.pin, "es", { numeric: true });
  });

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(result));
    } catch {
      // Ignore storage quota errors
    }
  }

  return result;
}

export async function fetchActiveTeachersFromSupabase(): Promise<TeacherRecord[]> {
  try {
    const { data, error } = await supabase.from("alumnos").select("*");
    if (error || !data) {
      return getInitialTeacherRecords(true);
    }
    return mergeTeachersFromAlumnosRows(data).filter((t) => t.active);
  } catch {
    return getInitialTeacherRecords(true);
  }
}
