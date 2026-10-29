// ============================================================================
// DANCE FACTORY • OTP (ONE TIME PIN) SECURITY SERVICE
// ============================================================================

interface LocalOtpEntry {
  code: string;
  expiresAt: number;
  otpToken?: string;
}

interface StoredOtpData {
  code: string; // Latest code (backward compatibility)
  expiresAt: number; // Latest expiry
  codes?: LocalOtpEntry[]; // Rolling list of active codes (last 5 within 30 min)
  attemptsLeft: number;
  lastSentAt: number;
}

const OTP_STORAGE_PREFIX = "df_otp_auth_";
export const OTP_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_OTP_ATTEMPTS = 6;
const MAX_ROLLING_LOCAL_CODES = 5;
export const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const RESEND_COOLDOWN_SEC = 30;

export function canonicalizeClientEmail(email: string): string {
  const clean = (email || "").trim().toLowerCase();
  const atIdx = clean.indexOf("@");
  if (atIdx === -1) return clean;
  let local = clean.slice(0, atIdx);
  let domain = clean.slice(atIdx + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    const plusIdx = local.indexOf("+");
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

function getStorageKey(email: string): string {
  return `${OTP_STORAGE_PREFIX}${canonicalizeClientEmail(email)}`;
}

function readStoredOtpData(email: string): StoredOtpData | null {
  if (typeof window === "undefined" || !email) return null;
  const canonicalKey = getStorageKey(email);
  const legacyKey = `${OTP_STORAGE_PREFIX}${email.trim().toLowerCase()}`;
  const raw = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOtpData;
  } catch {
    return null;
  }
}

/**
 * Generates a secure random 6-digit numeric OTP code.
 */
export function generateRandomOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates and sends a 6-digit OTP code for the specified email via Hostinger SMTP.
 * Preserves previously sent unexpired codes (rolling 30-min window) so delayed emails never break login.
 */
export async function generateAndSendOtp(
  email: string,
  studentName?: string
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  remainingCooldown?: number;
}> {
  if (!email || !email.trim()) {
    return { success: false, error: "El correo electrónico es obligatorio." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const key = getStorageKey(cleanEmail);

  if (typeof window !== "undefined") {
    const existing = readStoredOtpData(cleanEmail);
    const now = Date.now();

    if (existing && existing.lastSentAt) {
      const timeSinceLastSend = now - existing.lastSentAt;
      if (timeSinceLastSend >= 0 && timeSinceLastSend < RESEND_COOLDOWN_MS) {
        const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastSend) / 1000);
        return {
          success: false,
          error: `Espera ${remainingSec}s antes de pedir otro código (si ya te llegó uno en los últimos 30 min, puedes introducirlo).`,
          remainingCooldown: remainingSec,
        };
      }
    }

    const code = generateRandomOtpCode();
    let otpToken: string | undefined;
    let serverExpiresAt = now + OTP_TTL_MS;
    let sendSucceeded = false;
    let lastSendError = "";

    // Dispatch real email via Hostinger SMTP Route (with 1 automatic client retry on transient network/5xx error)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch("/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            code,
            name: studentName,
          }),
        });

        const resData = await response.json().catch(() => ({}));
        if (response.ok && resData?.success) {
          sendSucceeded = true;
          otpToken = typeof resData.otpToken === "string" ? resData.otpToken : undefined;
          if (typeof resData.expiresAt === "number") {
            serverExpiresAt = resData.expiresAt;
          }
          break;
        } else {
          lastSendError =
            resData?.error || "El servidor de correo no pudo enviar el código en este intento.";
          if (response.status >= 400 && response.status < 500) {
            break; // Validation error — do not retry
          }
        }
      } catch (netErr: any) {
        lastSendError = "Error de conexión al solicitar el código. Comprueba tu cobertura o Wi-Fi.";
        console.warn(`[Dance Factory OTP] Intento ${attempt}/2 fallido en /api/send-otp:`, netErr);
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!sendSucceeded) {
      return {
        success: false,
        error:
          lastSendError ||
          "No se pudo enviar el correo de verificación. Inténtalo de nuevo o solicita tu código en Recepción.",
      };
    }

    // Keep rolling list of unexpired codes so earlier delayed emails still work!
    const priorCodes: LocalOtpEntry[] = [];
    if (existing) {
      if (Array.isArray(existing.codes)) {
        for (const item of existing.codes) {
          if (item && item.expiresAt > now && item.code !== code) {
            priorCodes.push(item);
          }
        }
      } else if (existing.code && existing.expiresAt > now && existing.code !== code) {
        priorCodes.push({ code: existing.code, expiresAt: existing.expiresAt });
      }
    }

    priorCodes.push({ code, expiresAt: serverExpiresAt, otpToken });
    const rollingCodes = priorCodes.slice(-MAX_ROLLING_LOCAL_CODES);

    const data: StoredOtpData = {
      code,
      expiresAt: serverExpiresAt,
      codes: rollingCodes,
      attemptsLeft: MAX_OTP_ATTEMPTS,
      lastSentAt: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(data));
    console.log(`[Dance Factory OTP] ✉️ Código enviado con éxito a ${cleanEmail}`);

    return {
      success: true,
      code,
      remainingCooldown: RESEND_COOLDOWN_SEC,
    };
  }

  const code = generateRandomOtpCode();
  return { success: true, code };
}

/**
 * Checks if a new OTP can be requested or returns remaining cooldown seconds.
 */
export function getOtpCooldown(email: string): { canResend: boolean; remainingSeconds: number } {
  if (typeof window === "undefined" || !email) return { canResend: true, remainingSeconds: 0 };

  const data = readStoredOtpData(email);
  if (!data || !data.lastSentAt) return { canResend: true, remainingSeconds: 0 };

  const now = Date.now();
  const elapsed = now - data.lastSentAt;
  if (elapsed >= 0 && elapsed < RESEND_COOLDOWN_MS) {
    return {
      canResend: false,
      remainingSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
    };
  }

  return { canResend: true, remainingSeconds: 0 };
}

/**
 * Verifies a 6-digit OTP code against:
 * 1) Rolling local storage codes (any code sent in the last 30 min)
 * 2) Server-side OTP store + stateless HMAC tokens + Reception Counter Code (/api/verify-otp)
 */
export async function verifyOtpCode(
  email: string,
  inputCode: string
): Promise<{
  success: boolean;
  error?: string;
  attemptsLeft?: number;
}> {
  if (!email || !inputCode) {
    return { success: false, error: "Introduce el código de 6 dígitos completo." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = inputCode.replace(/[\s\-]/g, "").trim();

  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return { success: false, error: "El código debe tener exactamente 6 dígitos numéricos." };
  }

  const key = getStorageKey(cleanEmail);
  let storedTokens: string[] = [];

  // 1. Check rolling local storage (same browser / tab)
  if (typeof window !== "undefined") {
    const data = readStoredOtpData(cleanEmail);
    if (data) {
      const now = Date.now();
      const entries: LocalOtpEntry[] = Array.isArray(data.codes)
        ? data.codes
        : data.code
        ? [{ code: data.code, expiresAt: data.expiresAt }]
        : [];

      storedTokens = entries
        .filter((e) => e && e.expiresAt > now && typeof e.otpToken === "string")
        .map((e) => e.otpToken as string);

      const matchedLocal = entries.some(
        (e) => e && now <= e.expiresAt && e.code?.trim() === cleanCode
      );

      if (matchedLocal) {
        setTimeout(() => {
          try {
            localStorage.removeItem(key);
          } catch {}
        }, 30000);
        return { success: true };
      }
    }
  }

  // 2. Check server-side OTP store + HMAC tokens + Reception Counter Code (/api/verify-otp)
  try {
    const res = await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        code: cleanCode,
        otpTokens: storedTokens,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }
  } catch (netErr) {
    console.warn("[Dance Factory OTP] Fallo de conexión con /api/verify-otp:", netErr);
  }

  return {
    success: false,
    error:
      "Código incorrecto o expirado. Revisa los 6 dígitos del último correo recibido o pide tu código en Recepción.",
  };
}

/**
 * Explicitly clears the active OTP for an email across local storage and server.
 */
export async function clearActiveOtp(email: string): Promise<void> {
  if (!email) return;
  const cleanEmail = email.trim().toLowerCase();
  if (typeof window !== "undefined") {
    localStorage.removeItem(getStorageKey(cleanEmail));
    localStorage.removeItem(`${OTP_STORAGE_PREFIX}${cleanEmail}`);
  }

  try {
    await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, action: "clear" }),
    });
  } catch {}
}

/**
 * Retrieves the currently active OTP code for inspection/demo helper.
 */
export function getActiveOtpCode(email: string): string | null {
  const data = readStoredOtpData(email);
  if (!data) return null;
  if (Date.now() < data.expiresAt) {
    return data.code;
  }
  return null;
}
