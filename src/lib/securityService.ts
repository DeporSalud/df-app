import { logActivity } from "./activityLogger";
import { supabase } from "./supabase/client";

export interface LockoutStatus {
  isLocked: boolean;
  isPermanentLock?: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
  failedCount: number;
  maxAttempts: number;
}

const STORAGE_KEY_PREFIX = "df_sec_lockout_";
const MAX_ATTEMPTS = 3;

interface SecurityState {
  failedCount: number;
  lockedUntil: number; // timestamp ms or Infinity for permanent lock
  lockoutStreak: number;
  isPermanentLock?: boolean;
}

function getStoredState(role: "alumno" | "profesor"): SecurityState {
  if (typeof window === "undefined") {
    return { failedCount: 0, lockedUntil: 0, lockoutStreak: 0, isPermanentLock: false };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + role);
    if (!raw) return { failedCount: 0, lockedUntil: 0, lockoutStreak: 0, isPermanentLock: false };
    return JSON.parse(raw);
  } catch {
    return { failedCount: 0, lockedUntil: 0, lockoutStreak: 0, isPermanentLock: false };
  }
}

function saveState(role: "alumno" | "profesor", state: SecurityState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + role, JSON.stringify(state));
    window.dispatchEvent(new Event("df_security_lock_updated"));
  } catch (e) {
    console.error("Error saving security state:", e);
  }
}

export function checkLockout(role: "alumno" | "profesor"): LockoutStatus {
  const state = getStoredState(role);
  const now = Date.now();

  // Permanent teacher lock requiring reception release
  if (role === "profesor" && state.failedCount >= MAX_ATTEMPTS) {
    return {
      isLocked: true,
      isPermanentLock: true,
      remainingSeconds: 0,
      attemptsLeft: 0,
      failedCount: state.failedCount,
      maxAttempts: MAX_ATTEMPTS
    };
  }

  if (state.lockedUntil && now < state.lockedUntil) {
    const remainingSeconds = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
    return {
      isLocked: true,
      isPermanentLock: false,
      remainingSeconds,
      attemptsLeft: 0,
      failedCount: state.failedCount,
      maxAttempts: MAX_ATTEMPTS
    };
  }

  // If time-based lockout duration expired, reset
  if (state.lockedUntil && now >= state.lockedUntil && !state.isPermanentLock) {
    const resetState: SecurityState = {
      failedCount: 0,
      lockedUntil: 0,
      lockoutStreak: state.lockoutStreak,
      isPermanentLock: false
    };
    saveState(role, resetState);
    return {
      isLocked: false,
      isPermanentLock: false,
      remainingSeconds: 0,
      attemptsLeft: MAX_ATTEMPTS,
      failedCount: 0,
      maxAttempts: MAX_ATTEMPTS
    };
  }

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - state.failedCount);
  return {
    isLocked: false,
    isPermanentLock: false,
    remainingSeconds: 0,
    attemptsLeft,
    failedCount: state.failedCount,
    maxAttempts: MAX_ATTEMPTS
  };
}

export function registerFailedAttempt(role: "alumno" | "profesor", identifier?: string): LockoutStatus {
  const state = getStoredState(role);
  const now = Date.now();

  const newCount = state.failedCount + 1;
  let lockedUntil = 0;
  let isPermanentLock = false;
  let newStreak = state.lockoutStreak;

  if (newCount >= MAX_ATTEMPTS) {
    newStreak += 1;
    
    if (role === "profesor") {
      // Teacher accounts are locked PERMANENTLY until reception unlocks
      isPermanentLock = true;
      lockedUntil = Infinity;

      // Sync lock to Supabase for reception visibility
      try {
        supabase
          .from("alumnos")
          .update({ estado: "Bloqueado por PIN" })
          .ilike("plan_activo", "%Docente%");
      } catch (err) {
        console.warn("[Security] Error syncing lock to Supabase:", err);
      }
    } else {
      // Students have temporary cooldown
      const lockoutSec = newStreak > 1 ? 300 : 60;
      lockedUntil = now + lockoutSec * 1000;
    }

    // Log high priority security lockout event
    logActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_bloqueo",
      descripcion: `🚨 BLOQUEO DE SEGURIDAD DOCENTE: Se ha bloqueado permanentemente el acceso de ${role.toUpperCase()} tras ${newCount} intentos fallidos con PIN (identificador: ${identifier || "desconocido"}). Requiere desbloqueo en Recepción.`,
      usuario_afectado: identifier || `Docente ${role}`,
      sede: "General"
    });
  } else {
    // Log individual failed attempt
    logActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_intento_fallido",
      descripcion: `⚠️ Intento fallido de PIN (${newCount}/${MAX_ATTEMPTS}) como ${role.toUpperCase()} (identificador: ${identifier || "desconocido"}).`,
      usuario_afectado: identifier || `Docente ${role}`,
      sede: "General"
    });
  }

  const updatedState: SecurityState = {
    failedCount: newCount,
    lockedUntil,
    lockoutStreak: newStreak,
    isPermanentLock
  };

  saveState(role, updatedState);

  return checkLockout(role);
}

export function getTeacherUuid(id: string): string {
  const num = parseInt(id.replace(/\D/g, "") || "1000", 10);
  return `00000000-0000-0000-0000-${num.toString().padStart(12, "0")}`;
}

export function checkTeacherLockout(teacherId: string): LockoutStatus {
  if (typeof window === "undefined") {
    return { isLocked: false, isPermanentLock: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, failedCount: 0, maxAttempts: MAX_ATTEMPTS };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}teacher_${teacherId}`);
    if (!raw) {
      return { isLocked: false, isPermanentLock: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, failedCount: 0, maxAttempts: MAX_ATTEMPTS };
    }

    const state: SecurityState = JSON.parse(raw);
    if (state.failedCount >= MAX_ATTEMPTS) {
      return {
        isLocked: true,
        isPermanentLock: true,
        remainingSeconds: 0,
        attemptsLeft: 0,
        failedCount: state.failedCount,
        maxAttempts: MAX_ATTEMPTS
      };
    }

    return {
      isLocked: false,
      isPermanentLock: false,
      remainingSeconds: 0,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - state.failedCount),
      failedCount: state.failedCount,
      maxAttempts: MAX_ATTEMPTS
    };
  } catch {
    return { isLocked: false, isPermanentLock: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, failedCount: 0, maxAttempts: MAX_ATTEMPTS };
  }
}

export async function syncTeacherLockoutWithSupabase(teacherId: string): Promise<LockoutStatus> {
  if (typeof window === "undefined") return checkTeacherLockout(teacherId);

  const teacherUuid = getTeacherUuid(teacherId);
  try {
    const { data } = await supabase
      .from("alumnos")
      .select("estado")
      .eq("id", teacherUuid)
      .maybeSingle();

    if (data && data.estado) {
      if (data.estado.toLowerCase().includes("bloqueado")) {
        const state: SecurityState = {
          failedCount: MAX_ATTEMPTS,
          lockedUntil: Infinity,
          lockoutStreak: 1,
          isPermanentLock: true
        };
        localStorage.setItem(`${STORAGE_KEY_PREFIX}teacher_${teacherId}`, JSON.stringify(state));
      } else {
        // Reception unlocked in Supabase! Clear local lock
        const localKey = `${STORAGE_KEY_PREFIX}teacher_${teacherId}`;
        const localRaw = localStorage.getItem(localKey);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed.isPermanentLock || parsed.failedCount >= MAX_ATTEMPTS) {
            localStorage.removeItem(localKey);
            window.dispatchEvent(new Event("df_security_lock_updated"));
          }
        }
      }
    }
  } catch (e) {}

  return checkTeacherLockout(teacherId);
}

export async function syncAllTeachersLockoutsWithSupabase(teacherIds: string[]): Promise<Set<string>> {
  const lockedIds = new Set<string>();
  if (typeof window === "undefined") return lockedIds;

  try {
    const { data } = await supabase
      .from("alumnos")
      .select("id, estado")
      .ilike("estado", "%Bloqueado%");

    const blockedUuids = new Set((data || []).map(d => d.id));

    for (const id of teacherIds) {
      const uuid = getTeacherUuid(id);
      const isBlockedInDb = blockedUuids.has(uuid);
      const localKey = `${STORAGE_KEY_PREFIX}teacher_${id}`;
      const localRaw = localStorage.getItem(localKey);
      const localState: SecurityState | null = localRaw ? JSON.parse(localRaw) : null;

      if (isBlockedInDb) {
        lockedIds.add(id);
        if (!localState || !localState.isPermanentLock) {
          const state: SecurityState = {
            failedCount: MAX_ATTEMPTS,
            lockedUntil: Infinity,
            lockoutStreak: 1,
            isPermanentLock: true
          };
          localStorage.setItem(localKey, JSON.stringify(state));
        }
      } else if (localState && localState.isPermanentLock) {
        // Reception unblocked in DB (no longer in blockedUuids), clear local permanent lock!
        localStorage.removeItem(localKey);
      } else if (localState && localState.failedCount >= MAX_ATTEMPTS) {
        lockedIds.add(id);
      }
    }
  } catch (e) {
    for (const id of teacherIds) {
      const status = checkTeacherLockout(id);
      if (status.isLocked) lockedIds.add(id);
    }
  }

  return lockedIds;
}

export async function registerFailedTeacherAttempt(teacherId: string, teacherName: string, teacherEmail?: string, teacherSede?: string): Promise<LockoutStatus> {
  if (typeof window === "undefined") {
    return { isLocked: false, isPermanentLock: false, remainingSeconds: 0, attemptsLeft: 2, failedCount: 1, maxAttempts: MAX_ATTEMPTS };
  }

  const current = checkTeacherLockout(teacherId);
  const newCount = current.failedCount + 1;
  const isPermanentLock = newCount >= MAX_ATTEMPTS;

  const state: SecurityState = {
    failedCount: newCount,
    lockedUntil: isPermanentLock ? Infinity : 0,
    lockoutStreak: isPermanentLock ? 1 : 0,
    isPermanentLock
  };

  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}teacher_${teacherId}`, JSON.stringify(state));
    window.dispatchEvent(new Event("df_security_lock_updated"));
  } catch (e) {
    console.error("Error saving teacher security state:", e);
  }

  if (isPermanentLock) {
    // Sync block to Supabase alumnos so Reception CRM can see it and unlock
    const teacherUuid = getTeacherUuid(teacherId);
    try {
      await supabase
        .from("alumnos")
        .upsert({
          id: teacherUuid,
          nombre_completo: teacherName,
          email: teacherEmail || `${teacherId}@dancefactory.es`,
          telefono: "600000000",
          plan_activo: "Docente Dance Factory",
          sede: teacherSede || "castilla",
          estado: "Bloqueado por 3 fallos de PIN"
        });
    } catch (err) {
      console.warn("[Security] Error syncing teacher lock to Supabase:", err);
    }

    logActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_bloqueo",
      descripcion: `🚨 BLOQUEO DE SEGURIDAD DOCENTE: Se ha bloqueado el acceso de ${teacherName} tras ${newCount} intentos fallidos de PIN. Requiere desbloqueo en Recepción.`,
      usuario_afectado: teacherName,
      sede: teacherSede || "General"
    });
  } else {
    logActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_intento_fallido",
      descripcion: `⚠️ Intento fallido de PIN (${newCount}/${MAX_ATTEMPTS}) para el docente ${teacherName}.`,
      usuario_afectado: teacherName,
      sede: teacherSede || "General"
    });
  }

  return checkTeacherLockout(teacherId);
}

export function registerSuccessfulTeacherLogin(teacherId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}teacher_${teacherId}`);
    window.dispatchEvent(new Event("df_security_lock_updated"));
  } catch {}
}

export function unlockTeacher(teacherId: string, teacherName?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}teacher_${teacherId}`);
    window.dispatchEvent(new Event("df_security_lock_updated"));

    // Sync unlock in Supabase
    const teacherUuid = getTeacherUuid(teacherId);
    try {
      supabase
        .from("alumnos")
        .update({ estado: "Activo" })
        .eq("id", teacherUuid);
    } catch {}

    logActivity({
      origen: "recepcion",
      tipo_evento: "seguridad_desbloqueo",
      descripcion: `🔓 DESBLOQUEO DOCENTE: Recepción ha restablecido con éxito el acceso de ${teacherName || `Profesor (${teacherId})`}.`,
      usuario_afectado: teacherName || `Docente ${teacherId}`,
      sede: "General"
    });
  } catch (e) {
    console.error("Error unlocking teacher:", e);
  }
}

export function unlockRole(role: "alumno" | "profesor") {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + role);
    // Also remove any teacher locks
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_KEY_PREFIX}teacher_`)) {
        localStorage.removeItem(key);
      }
    }
    window.dispatchEvent(new Event("df_security_lock_updated"));
    
    logActivity({
      origen: "recepcion",
      tipo_evento: "seguridad_desbloqueo",
      descripcion: `🔓 DESBLOQUEO DE SEGURIDAD: Recepción ha restablecido los accesos y desbloqueado al claustro docente (${role.toUpperCase()}).`,
      usuario_afectado: `Docente ${role}`,
      sede: "General"
    });
  } catch (e) {
    console.error("Error unlocking role:", e);
  }
}

export function registerSuccessfulLogin(role: "alumno" | "profesor", identifier?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + role);
  } catch {}
}
