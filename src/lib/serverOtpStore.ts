import fs from "fs";
import crypto from "crypto";

export interface OtpCodeEntry {
  code: string;
  expiresAt: number;
  createdAt: number;
}

interface ServerStoredOtpBucket {
  codes: OtpCodeEntry[];
  attemptsLeft: number;
  updatedAt: number;
}

export const SERVER_OTP_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ROLLING_CODES = 5;
const MAX_SERVER_ATTEMPTS = 8;
const DESK_OTP_BUCKET_MS = 15 * 60 * 1000; // 15-min window (valid across current + previous 2 windows = 30–45 min)

const OTP_HMAC_SECRET =
  process.env.OTP_HMAC_SECRET || "df-alcorcon-otp-hmac-v2-2026-9f4c8e2a1b7d";

// In-memory cache for high-speed lookups
const inMemoryOtpStore = new Map<string, ServerStoredOtpBucket>();

const OTP_BACKUP_PATH = "/tmp/df_server_otps_v2.json";

/**
 * Normalizes Gmail/Googlemail dot & plus aliases so `cristina.cortesb@gmail.com`
 * and `cristinacortesb@gmail.com` resolve to the exact same canonical OTP bucket.
 */
export function canonicalizeOtpEmail(email: string): string {
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

function purgeExpiredBuckets(
  data: Record<string, ServerStoredOtpBucket>
): Record<string, ServerStoredOtpBucket> {
  const now = Date.now();
  const cleaned: Record<string, ServerStoredOtpBucket> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!v || !Array.isArray(v.codes)) continue;
    const validCodes = v.codes.filter((c) => c && c.expiresAt > now);
    if (validCodes.length > 0) {
      cleaned[k] = {
        codes: validCodes.slice(-MAX_ROLLING_CODES),
        attemptsLeft: typeof v.attemptsLeft === "number" ? v.attemptsLeft : MAX_SERVER_ATTEMPTS,
        updatedAt: v.updatedAt || now,
      };
    }
  }
  return cleaned;
}

function loadFromDisk(): Record<string, ServerStoredOtpBucket> {
  try {
    if (fs.existsSync(OTP_BACKUP_PATH)) {
      const raw = fs.readFileSync(OTP_BACKUP_PATH, "utf8");
      const parsed = JSON.parse(raw);
      return purgeExpiredBuckets(parsed);
    }
  } catch (e) {
    console.warn("[serverOtpStore] Error reading disk backup:", e);
  }
  return {};
}

function saveToDisk(data: Record<string, ServerStoredOtpBucket>) {
  try {
    const cleaned = purgeExpiredBuckets(data);
    fs.writeFileSync(OTP_BACKUP_PATH, JSON.stringify(cleaned), "utf8");
  } catch (e) {
    console.warn("[serverOtpStore] Error saving disk backup:", e);
  }
}

/**
 * Generates a stateless HMAC-SHA256 token binding canonical email + 6-digit code + expiry.
 * Survives container restarts and multi-instance load balancing with zero external DB state.
 */
export function signOtpToken(email: string, code: string, expiresAt: number): string {
  const canonicalEmail = canonicalizeOtpEmail(email);
  const cleanCode = code.trim();
  const payload = `${canonicalEmail}|${cleanCode}|${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", OTP_HMAC_SECRET)
    .update(payload)
    .digest("hex");
  return `${expiresAt}.${sig}`;
}

export function verifySignedOtpTokens(
  email: string,
  inputCode: string,
  tokens?: string[]
): boolean {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  const canonicalEmail = canonicalizeOtpEmail(email);
  const cleanCode = inputCode.replace(/[\s\-]/g, "").trim();
  const now = Date.now();

  for (const token of tokens) {
    if (typeof token !== "string") continue;
    const dotIdx = token.indexOf(".");
    if (dotIdx === -1) continue;
    const expiresAt = Number(token.slice(0, dotIdx));
    const providedSig = token.slice(dotIdx + 1);
    if (!Number.isFinite(expiresAt) || now > expiresAt || !providedSig) continue;

    const expectedSig = crypto
      .createHmac("sha256", OTP_HMAC_SECRET)
      .update(`${canonicalEmail}|${cleanCode}|${expiresAt}`)
      .digest("hex");

    if (
      providedSig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Computes a deterministic 6-digit Reception Counter Code for a student email
 * valid across 15-min HMAC windows (current + previous 2 windows = 30–45 min).
 */
export function computeDeskOtpForWindow(email: string, windowIdx: number): string {
  const canonicalEmail = canonicalizeOtpEmail(email);
  const digest = crypto
    .createHmac("sha256", OTP_HMAC_SECRET)
    .update(`desk-v1|${canonicalEmail}|${windowIdx}`)
    .digest();
  const num = digest.readUInt32BE(0) % 900000;
  return String(100000 + num);
}

export function verifyDeskOtp(email: string, inputCode: string): boolean {
  const cleanCode = inputCode.replace(/[\s\-]/g, "").trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const currentWindow = Math.floor(Date.now() / DESK_OTP_BUCKET_MS);
  for (const offset of [0, -1, -2, 1]) {
    if (computeDeskOtpForWindow(email, currentWindow + offset) === cleanCode) {
      return true;
    }
  }
  return false;
}

/**
 * Stores an OTP code in the rolling bucket (up to 5 active codes per email, 30 min TTL)
 * and returns a stateless signed `otpToken`.
 */
export function storeServerOtp(
  email: string,
  code: string,
  ttlMs = SERVER_OTP_TTL_MS
): { otpToken: string; expiresAt: number } {
  const canonicalKey = canonicalizeOtpEmail(email);
  const cleanCode = code.trim();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  const diskData = loadFromDisk();
  const existing = inMemoryOtpStore.get(canonicalKey) || diskData[canonicalKey];
  const activeCodes = (existing?.codes || []).filter(
    (c) => c.expiresAt > now && c.code !== cleanCode
  );
  activeCodes.push({ code: cleanCode, expiresAt, createdAt: now });

  const bucket: ServerStoredOtpBucket = {
    codes: activeCodes.slice(-MAX_ROLLING_CODES),
    attemptsLeft: MAX_SERVER_ATTEMPTS,
    updatedAt: now,
  };

  inMemoryOtpStore.set(canonicalKey, bucket);
  diskData[canonicalKey] = bucket;
  saveToDisk(diskData);

  const otpToken = signOtpToken(canonicalKey, cleanCode, expiresAt);
  console.log(
    `[serverOtpStore] 🔐 Guardado OTP (${bucket.codes.length} activo/s) para ${canonicalKey} hasta ${new Date(
      expiresAt
    ).toLocaleTimeString()}`
  );

  return { otpToken, expiresAt };
}

/**
 * Verifies an OTP code against:
 * 1) Stateless Reception Counter Code (`verifyDeskOtp`)
 * 2) Stateless HMAC-signed tokens (`verifySignedOtpTokens`)
 * 3) Rolling server-side bucket (accepts ANY code sent in the last 30 min)
 */
export function verifyServerOtp(
  email: string,
  inputCode: string,
  otpTokens?: string[]
): { success: boolean; error?: string } {
  if (!email || !inputCode) {
    return { success: false, error: "Email y código son obligatorios." };
  }

  const canonicalKey = canonicalizeOtpEmail(email);
  const cleanCode = inputCode.replace(/[\s\-]/g, "").trim();

  // 1. Check Reception Counter Code (works instantaneously across CRM -> Student App)
  if (verifyDeskOtp(canonicalKey, cleanCode)) {
    return { success: true };
  }

  // 2. Check stateless HMAC tokens from browser (immune to container restarts)
  if (verifySignedOtpTokens(canonicalKey, cleanCode, otpTokens)) {
    return { success: true };
  }

  // 3. Check rolling in-memory / disk store
  let bucket = inMemoryOtpStore.get(canonicalKey);
  const diskData = loadFromDisk();
  if (!bucket && diskData[canonicalKey]) {
    bucket = diskData[canonicalKey];
    inMemoryOtpStore.set(canonicalKey, bucket);
  }

  if (!bucket || !Array.isArray(bucket.codes) || bucket.codes.length === 0) {
    return {
      success: false,
      error:
        "No hay ningún código activo para este correo o ya ha expirado (validez 30 min). Pulsa «Reenviar Código» o pídelo en Recepción.",
    };
  }

  const now = Date.now();
  const validCodes = bucket.codes.filter((c) => c.expiresAt > now);
  if (validCodes.length === 0) {
    clearServerOtp(canonicalKey);
    return {
      success: false,
      error: "El código de acceso ha caducado (validez de 30 minutos). Solicita uno nuevo.",
    };
  }

  const matched = validCodes.some((c) => c.code === cleanCode);
  if (!matched) {
    bucket.codes = validCodes;
    bucket.attemptsLeft = Math.max(0, bucket.attemptsLeft - 1);
    if (bucket.attemptsLeft <= 0) {
      clearServerOtp(canonicalKey);
      return {
        success: false,
        error: "Has superado el número máximo de intentos. Solicita un nuevo código.",
      };
    }
    inMemoryOtpStore.set(canonicalKey, bucket);
    diskData[canonicalKey] = bucket;
    saveToDisk(diskData);
    return {
      success: false,
      error: `Código incorrecto. Revisa los 6 dígitos del correo (te quedan ${bucket.attemptsLeft} intentos).`,
    };
  }

  // Keep valid codes briefly during multi-step login transition
  return { success: true };
}

/**
 * Removes active OTP bucket once login is completed.
 */
export function clearServerOtp(email: string): void {
  const canonicalKey = canonicalizeOtpEmail(email);
  inMemoryOtpStore.delete(canonicalKey);
  const diskData = loadFromDisk();
  if (diskData[canonicalKey]) {
    delete diskData[canonicalKey];
    saveToDisk(diskData);
  }
}
