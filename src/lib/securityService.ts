import { logActivity } from "./activityLogger";

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
  failedCount: number;
  maxAttempts: number;
}

const STORAGE_KEY_PREFIX = "df_sec_lockout_";
const MAX_ATTEMPTS = 3;
const BASE_LOCKOUT_SECONDS = 60; // 60 segundos de bloqueo tras 3 intentos fallidos

interface SecurityState {
  failedCount: number;
  lockedUntil: number; // timestamp ms
  lockoutStreak: number; // consecutive lockouts
}

function getStoredState(role: "alumno" | "profesor"): SecurityState {
  if (typeof window === "undefined") {
    return { failedCount: 0, lockedUntil: 0, lockoutStreak: 0 };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + role);
    if (!raw) return { failedCount: 0, lockedUntil: 0, lockoutStreak: 0 };
    return JSON.parse(raw);
  } catch {
    return { failedCount: 0, lockedUntil: 0, lockoutStreak: 0 };
  }
}

function saveState(role: "alumno" | "profesor", state: SecurityState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + role, JSON.stringify(state));
  } catch (e) {
    console.error("Error saving security state:", e);
  }
}

export function checkLockout(role: "alumno" | "profesor"): LockoutStatus {
  const state = getStoredState(role);
  const now = Date.now();

  if (state.lockedUntil && now < state.lockedUntil) {
    const remainingSeconds = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
    return {
      isLocked: true,
      remainingSeconds,
      attemptsLeft: 0,
      failedCount: state.failedCount,
      maxAttempts: MAX_ATTEMPTS
    };
  }

  // If lockout duration expired, reset lock state but keep streak awareness
  if (state.lockedUntil && now >= state.lockedUntil) {
    const resetState: SecurityState = {
      failedCount: 0,
      lockedUntil: 0,
      lockoutStreak: state.lockoutStreak
    };
    saveState(role, resetState);
    return {
      isLocked: false,
      remainingSeconds: 0,
      attemptsLeft: MAX_ATTEMPTS,
      failedCount: 0,
      maxAttempts: MAX_ATTEMPTS
    };
  }

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - state.failedCount);
  return {
    isLocked: false,
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
  let newStreak = state.lockoutStreak;

  if (newCount >= MAX_ATTEMPTS) {
    newStreak += 1;
    // Exponential lockout: 1st lockout = 60s, 2nd+ lockout = 300s (5 mins)
    const lockoutSec = newStreak > 1 ? 300 : BASE_LOCKOUT_SECONDS;
    lockedUntil = now + lockoutSec * 1000;

    // Log high priority security lockout event
    logActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_bloqueo",
      descripcion: `🚨 BLOQUEO DE SEGURIDAD: Se ha bloqueado temporalmente el acceso de ${role.toUpperCase()} tras ${newCount} intentos fallidos de autenticación (identificador: ${identifier || "desconocido"}). Bloqueado durante ${lockoutSec}s.`,
      usuario_afectado: identifier || `Intento ${role}`,
      sede: "General"
    });
  } else {
    // Log individual failed attempt
    logActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_intento_fallido",
      descripcion: `⚠️ Intento fallido de acceso (${newCount}/${MAX_ATTEMPTS}) como ${role.toUpperCase()} (identificador: ${identifier || "desconocido"}).`,
      usuario_afectado: identifier || `Intento ${role}`,
      sede: "General"
    });
  }

  const updatedState: SecurityState = {
    failedCount: newCount,
    lockedUntil,
    lockoutStreak: newStreak
  };

  saveState(role, updatedState);

  return checkLockout(role);
}

export function registerSuccessfulLogin(role: "alumno" | "profesor", identifier?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + role);
  } catch {}
}
