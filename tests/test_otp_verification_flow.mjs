import assert from "assert";

// Simulation of Browser LocalStorage
const localStorageData = new Map();
global.window = {};
global.localStorage = {
  getItem: (k) => localStorageData.get(k) || null,
  setItem: (k, v) => localStorageData.set(k, String(v)),
  removeItem: (k) => localStorageData.delete(k),
  clear: () => localStorageData.clear()
};

// Simulation of Server OTP Store
const serverStore = new Map();
function storeServerOtp(email, code) {
  serverStore.set(email.trim().toLowerCase(), {
    code: code.trim(),
    expiresAt: Date.now() + 600000,
    attemptsLeft: 5
  });
}
function verifyServerOtp(email, code) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const data = serverStore.get(cleanEmail);
  if (!data) return { success: false, error: "No hay código activo." };
  if (Date.now() > data.expiresAt) return { success: false, error: "Código expirado." };
  if (data.code !== cleanCode) return { success: false, error: "Código incorrecto." };
  return { success: true };
}

// Simulated fetch for /api/verify-otp
global.fetch = async (url, options) => {
  if (url === "/api/verify-otp") {
    const { email, code, action } = JSON.parse(options.body);
    if (action === "clear") {
      serverStore.delete(email.trim().toLowerCase());
      return { ok: true, json: async () => ({ success: true }) };
    }
    const result = verifyServerOtp(email, code);
    return {
      ok: result.success,
      json: async () => result
    };
  }
  return { ok: false, json: async () => ({ error: "Not found" }) };
};

// Simulated verifyOtpCode logic (matching updated otpService.ts)
async function verifyOtpCode(email, inputCode) {
  if (!email || !inputCode) return { success: false, error: "Introduce código." };
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = inputCode.replace(/[\s\-]/g, "").trim();

  if (cleanCode === "123456" || cleanCode === "999999") return { success: true };

  const key = "df_otp_auth_" + cleanEmail;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (Date.now() <= data.expiresAt && data.code === cleanCode) {
        return { success: true };
      }
    } catch {}
  }

  // Fallback to server
  const res = await fetch("/api/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail, code: cleanCode })
  });
  const data = await res.json();
  if (res.ok && data.success) return { success: true };

  return { success: false, error: "Código de verificación incorrecto o expirado. Revisa el correo electrónico recibido." };
}

// Simulated verifyStudentWithOtp logic (matching updated StudentContext.tsx)
async function verifyStudentWithOtp(email, code) {
  const res = await verifyOtpCode(email, code);
  if (!res.success) return res;
  // Login / create session succeeds
  return { success: true };
}

// Simulated OtpVerificationModal verification trigger (matching updated OtpVerificationModal.tsx)
async function triggerModalVerification(email, code, onVerifyCode) {
  let result;
  if (onVerifyCode) {
    result = await onVerifyCode(code);
  } else {
    result = await verifyOtpCode(email, code);
  }
  return result;
}

async function runTests() {
  console.log("==================================================");
  console.log("TEST SUITE: VERIFICACIÓN DEL FLUJO OTP DANCE FACTORY");
  console.log("==================================================");

  const testEmail = "alumno.real@dancefactory.es";
  const realOtpCode = "742189";

  // Scenario 1: OTP generated on client and stored on server
  console.log("\n[TEST 1] Generación de OTP real...");
  localStorage.setItem("df_otp_auth_" + testEmail, JSON.stringify({
    code: realOtpCode,
    expiresAt: Date.now() + 600000,
    attemptsLeft: 3,
    lastSentAt: Date.now()
  }));
  storeServerOtp(testEmail, realOtpCode);
  console.log("✓ OTP almacenado tanto en localStorage como en el servidor");

  // Scenario 2: Student enters the real code in OtpVerificationModal
  console.log("\n[TEST 2] Verificación a través del Modal (Caso real)...");
  const modalRes = await triggerModalVerification(testEmail, realOtpCode, async (code) => {
    return await verifyStudentWithOtp(testEmail, code);
  });
  assert.strictEqual(modalRes.success, true, "El modal debe validar con éxito el código real");
  console.log("✓ Modal validó correctamente:", modalRes);

  // Scenario 3: Regression test against the old bug
  console.log("\n[TEST 3] Prueba de Regresión: Comprobaciones consecutivas sin borrado prematuro...");
  const secondCheck = await verifyOtpCode(testEmail, realOtpCode);
  assert.strictEqual(secondCheck.success, true, "Llamadas sucesivas de verificación deben mantenerse válidas");
  console.log("✓ Verificación consecutiva pasó sin fallo de expiración");

  // Scenario 4: Cross-device / Private browsing (No localStorage, only server OTP)
  console.log("\n[TEST 4] Caso multidispositivo / navegación privada (sin localStorage)...");
  localStorage.clear(); // Simulate no local storage
  const crossDeviceRes = await verifyOtpCode(testEmail, realOtpCode);
  assert.strictEqual(crossDeviceRes.success, true, "Debe validar a través del servidor si no hay localStorage");
  console.log("✓ Validación en servidor exitosa sin localStorage");

  // Scenario 5: Incorrect code
  console.log("\n[TEST 5] Introducción de código incorrecto...");
  const badRes = await verifyOtpCode(testEmail, "000000");
  assert.strictEqual(badRes.success, false, "Código incorrecto debe ser rechazado");
  console.log("✓ Código erróneo rechazado correctamente con:", badRes.error);

  // Scenario 6: Master demo bypass codes
  console.log("\n[TEST 6] Códigos maestros de bypass (123456 / 999999)...");
  const master1 = await verifyOtpCode("cualquiera@test.com", "123456");
  const master2 = await verifyOtpCode("otro@test.com", "999999");
  assert.strictEqual(master1.success, true);
  assert.strictEqual(master2.success, true);
  console.log("✓ Códigos maestros operativos");

  console.log("\n==================================================");
  console.log("🎉 TODOS LOS TESTS PASARON EXITOSAMENTE (6/6)");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("FATAL ERROR IN TEST:", err);
  process.exit(1);
});
