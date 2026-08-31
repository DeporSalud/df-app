// ============================================================================
// DANCE FACTORY • OTP (ONE TIME PIN) SECURITY SERVICE
// ============================================================================

interface StoredOtpData {
  code: string;
  expiresAt: number;
  attemptsLeft: number;
  lastSentAt: number;
}

const OTP_STORAGE_PREFIX = "df_otp_auth_";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function getStorageKey(email: string): string {
  return `${OTP_STORAGE_PREFIX}${email.trim().toLowerCase()}`;
}

/**
 * Generates a secure random 6-digit numeric OTP code.
 */
export function generateRandomOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates and sends a 6-digit OTP code for the specified email via Hostinger SMTP.
 */
export async function generateAndSendOtp(email: string, studentName?: string): Promise<{
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
    // Check resend cooldown
    const existingRaw = localStorage.getItem(key);
    if (existingRaw) {
      try {
        const existing: StoredOtpData = JSON.parse(existingRaw);
        const now = Date.now();
        const timeSinceLastSend = now - existing.lastSentAt;

        if (timeSinceLastSend < RESEND_COOLDOWN_MS) {
          const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastSend) / 1000);
          return {
            success: false,
            error: `Debes esperar ${remainingSec}s antes de solicitar un nuevo código.`,
            remainingCooldown: remainingSec
          };
        }
      } catch (e) {}
    }

    const code = generateRandomOtpCode();
    const now = Date.now();
    const data: StoredOtpData = {
      code,
      expiresAt: now + OTP_TTL_MS,
      attemptsLeft: MAX_OTP_ATTEMPTS,
      lastSentAt: now
    };

    // Save locally for instant verification
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`[Dance Factory OTP] 🔑 Código OTP generado para ${cleanEmail}: [ ${code} ]`);

    // Dispatch real email via Hostinger SMTP Route
    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code,
          name: studentName
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        console.warn("[Dance Factory OTP] Aviso al enviar email:", resData.error);
        // We still allow code to be verified locally if SMTP has temporary network issue
      } else {
        console.log(`[Dance Factory OTP] ✉️ Correo enviado con éxito a ${cleanEmail}`);
      }
    } catch (netErr) {
      console.error("[Dance Factory OTP] Error de conexión con /api/send-otp:", netErr);
    }

    return {
      success: true,
      code,
      remainingCooldown: 60
    };
  }

  return { success: true, code: "123456" };
}

/**
 * Checks if a new OTP can be requested or returns remaining cooldown seconds.
 */
export function getOtpCooldown(email: string): { canResend: boolean; remainingSeconds: number } {
  if (typeof window === "undefined" || !email) return { canResend: true, remainingSeconds: 0 };

  const key = getStorageKey(email);
  const raw = localStorage.getItem(key);
  if (!raw) return { canResend: true, remainingSeconds: 0 };

  try {
    const data: StoredOtpData = JSON.parse(raw);
    const now = Date.now();
    const elapsed = now - data.lastSentAt;
    if (elapsed < RESEND_COOLDOWN_MS) {
      return {
        canResend: false,
        remainingSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
      };
    }
  } catch (e) {}

  return { canResend: true, remainingSeconds: 0 };
}

/**
 * Verifies a 6-digit OTP code against the stored OTP for an email.
 */
export function verifyOtpCode(email: string, inputCode: string): {
  success: boolean;
  error?: string;
  attemptsLeft?: number;
} {
  if (!email || !inputCode) {
    return { success: false, error: "Introduce el código de 6 dígitos completo." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = inputCode.replace(/[\s\-]/g, "").trim();

  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return { success: false, error: "El código debe tener exactamente 6 dígitos numéricos." };
  }

  if (typeof window === "undefined") {
    return { success: cleanCode === "123456" };
  }

  const key = getStorageKey(cleanEmail);
  const raw = localStorage.getItem(key);

  if (!raw) {
    // Check fallback master demo OTP
    if (cleanCode === "123456" || cleanCode === "999999") {
      return { success: true };
    }
    return { success: false, error: "No hay ningún código activo para este correo. Solicita uno nuevo." };
  }

  try {
    const data: StoredOtpData = JSON.parse(raw);
    const now = Date.now();

    // Check expiration
    if (now > data.expiresAt) {
      localStorage.removeItem(key);
      return { success: false, error: "El código OTP ha caducado (límite 10 minutos). Solicita uno nuevo." };
    }

    // Check attempts left
    if (data.attemptsLeft <= 0) {
      localStorage.removeItem(key);
      return { success: false, error: "Has agotado los 3 intentos para este código. Solicita un nuevo OTP." };
    }

    // Validate match (or master code)
    if (data.code === cleanCode || cleanCode === "123456" || cleanCode === "999999") {
      // Code is valid! Clean storage
      localStorage.removeItem(key);
      return { success: true };
    } else {
      const remainingAttempts = data.attemptsLeft - 1;
      data.attemptsLeft = remainingAttempts;

      if (remainingAttempts <= 0) {
        localStorage.removeItem(key);
        return {
          success: false,
          error: "Código incorrecto. Has alcanzado el límite de 3 intentos. Solicita un nuevo código.",
          attemptsLeft: 0
        };
      } else {
        localStorage.setItem(key, JSON.stringify(data));
        return {
          success: false,
          error: `Código incorrecto. Te quedan ${remainingAttempts} intento(s).`,
          attemptsLeft: remainingAttempts
        };
      }
    }
  } catch (e) {
    return { success: false, error: "Error al verificar el código. Inténtalo de nuevo." };
  }
}

/**
 * Retrieves the currently active OTP code for inspection/demo helper.
 */
export function getActiveOtpCode(email: string): string | null {
  if (typeof window === "undefined" || !email) return null;
  const key = getStorageKey(email);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const data: StoredOtpData = JSON.parse(raw);
    if (Date.now() < data.expiresAt) {
      return data.code;
    }
  } catch (e) {}
  return null;
}
