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

export function unlockRole(role: "alumno" | "profesor") {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + role);
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
