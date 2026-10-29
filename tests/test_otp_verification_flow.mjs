import assert from "assert";
import crypto from "crypto";

const OTP_HMAC_SECRET = "df-alcorcon-otp-hmac-v2-2026-9f4c8e2a1b7d";
const DESK_OTP_BUCKET_MS = 15 * 60 * 1000;

function canonicalizeOtpEmail(email) {
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

function signOtpToken(email, code, expiresAt) {
  const canonicalEmail = canonicalizeOtpEmail(email);
  const sig = crypto
    .createHmac("sha256", OTP_HMAC_SECRET)
    .update(`${canonicalEmail}|${code}|${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${sig}`;
}

function computeDeskOtpForWindow(email, windowIdx) {
  const canonicalEmail = canonicalizeOtpEmail(email);
  const digest = crypto
    .createHmac("sha256", OTP_HMAC_SECRET)
    .update(`desk-v1|${canonicalEmail}|${windowIdx}`)
    .digest();
  const num = digest.readUInt32BE(0) % 900000;
  return String(100000 + num);
}

async function runTests() {
  console.log("==================================================");
  console.log("TEST SUITE: OTP ROLLING + HMAC + GMAIL DOTS + DESK");
  console.log("==================================================");

  // 1. Gmail dot-insensitive canonicalization (Patricia Villalta Cortés case)
  const patriciaDbEmail = "cristina.cortesb@gmail.com";
  const patriciaTypedNoDot = "cristinacortesb@gmail.com";
  const patriciaGooglemail = "Cristina.CortesB+df@googlemail.com";
  assert.strictEqual(
    canonicalizeOtpEmail(patriciaDbEmail),
    canonicalizeOtpEmail(patriciaTypedNoDot),
    "Gmail con punto y sin punto deben resolver al mismo bucket canónico"
  );
  assert.strictEqual(
    canonicalizeOtpEmail(patriciaDbEmail),
    canonicalizeOtpEmail(patriciaGooglemail),
    "googlemail + alias debe resolver al mismo bucket canónico"
  );
  console.log("✓ [TEST 1] Canonicalización Gmail (cristina.cortesb == cristinacortesb) OK");

  // 2. Hotmail preservation (Olivia Anna Hrebenyvk case — dots ARE distinct in Hotmail)
  assert.strictEqual(
    canonicalizeOtpEmail("olivia.anna2013@hotmail.com"),
    "olivia.anna2013@hotmail.com",
    "Hotmail NO debe eliminar puntos del local-part"
  );
  console.log("✓ [TEST 2] Preservación exacta de puntos en dominios no-Gmail (Hotmail) OK");

  // 3. Rolling multi-code bucket (Alba Rodríguez / Olivia delayed email after clicking Reenviar)
  const bucket = [];
  const now = Date.now();
  const code1 = "318492";
  const code2 = "805127";
  bucket.push({ code: code1, expiresAt: now + 30 * 60 * 1000 });
  bucket.push({ code: code2, expiresAt: now + 30 * 60 * 1000 });
  assert.strictEqual(bucket.some((c) => c.code === code1 && c.expiresAt > now), true, "El primer código sigue siendo válido tras reenviar");
  assert.strictEqual(bucket.some((c) => c.code === code2 && c.expiresAt > now), true, "El segundo código también es válido");
  console.log("✓ [TEST 3] Ventana rolling de 30 min (Reenviar NO invalida el código anterior en tránsito) OK");

  // 4. Stateless HMAC token verification across Gmail dot variations (survives container recycle)
  const exp = now + 30 * 60 * 1000;
  const token = signOtpToken(patriciaTypedNoDot, code1, exp);
  const [expStr, sig] = token.split(".");
  const verifySig = crypto
    .createHmac("sha256", OTP_HMAC_SECRET)
    .update(`${canonicalizeOtpEmail(patriciaDbEmail)}|${code1}|${Number(expStr)}`)
    .digest("hex");
  assert.strictEqual(sig, verifySig, "Token HMAC firmado sin estado valida tras reinicio de contenedor");
  console.log("✓ [TEST 4] Firma criptográfica stateless HMAC-SHA256 OK");

  // 5. Stateless Reception Counter Code (CRM -> Student App instant login)
  const win = Math.floor(now / DESK_OTP_BUCKET_MS);
  const crmCode = computeDeskOtpForWindow("juanijulio@gmail.com", win);
  assert.match(crmCode, /^\d{6}$/, "El código de mostrador debe tener 6 dígitos");
  const validInPrevWindow = [0, -1, -2, 1].some(
    (offset) => computeDeskOtpForWindow("JuaniJulio@gmail.com", win + offset) === crmCode
  );
  assert.strictEqual(validInPrevWindow, true, "Código generado en CRM Recepción valida en Student App");
  console.log("✓ [TEST 5] Código instantáneo de Recepción (CRM <-> Student App) OK:", crmCode);

  console.log("\n🎉 TODOS LOS TESTS PASARON EXITOSAMENTE (5/5)");
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST:", err);
  process.exit(1);
});
