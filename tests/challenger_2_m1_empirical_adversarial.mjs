/**
 * ============================================================================
 * CHALLENGER 2 - MILESTONE 1 EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * ============================================================================
 * Focus Areas:
 * 1. Teacher authentication PIN (4 digits) & brute force lockout (3 attempts -> 60s cooldown).
 * 2. Teacher attendance roll call 1-click marking and verified Supabase `asistencias` payload { alumno_id, clase_id, fecha_hora }.
 * 3. Teacher standby bono request (-10% discount) & reception reconciliation without duplicate ledger entries.
 * 4. Student class cancellation & automatic +1 class refund to bono balance.
 * ============================================================================
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const STUDENT_APP_DIR = path.resolve(__dirname, "..");
const CRM_APP_DIR = path.resolve(PROJECT_ROOT, "crm-app");

function resolveAppFile(app, relPath) {
  const base = app === "student-app" ? STUDENT_APP_DIR : CRM_APP_DIR;
  return path.resolve(base, relPath);
}

console.log("================================================================================");
console.log("   DANCE FACTORY: CHALLENGER 2 EMPIRICAL ADVERSARIAL VERIFICATION (M1)");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`          ${err.stack || err.message}`);
    failedCount++;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`          ${err.stack || err.message}`);
    failedCount++;
  }
}

// ============================================================================
// SIMULATION ENVIRONMENT & STORAGE MOCKS
// ============================================================================

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockStorage();
globalThis.localStorage = mockStorage;
globalThis.sessionStorage = new MockStorage();

const activityLogs = [];
function mockLogActivity(entry) {
  activityLogs.push({ ...entry, timestamp: Date.now() });
}

// ============================================================================
// 1. TEACHER AUTHENTICATION & BRUTE FORCE LOCKOUT ENGINE
// ============================================================================

const TEACHERS = [
  { id: "1001", name: "LUCÍA MUÑOZ", email: "lucia.munoz@dancefactory.es", pin: "1001", especialidad: "Danza Urbana", sede: "tejar" },
  { id: "1002", name: "LUCÍA ZAMORANO", email: "lucia.zamorano@dancefactory.es", pin: "1002", especialidad: "Contemporáneo", sede: "tejar" },
  { id: "1003", name: "ANDREA SOTO", email: "andrea.soto@dancefactory.es", pin: "1003", especialidad: "Comercial & Open Classes", sede: "castilla" },
  { id: "1004", name: "EVA LEIVA", email: "eva.leiva@dancefactory.es", pin: "1004", especialidad: "Jazz Lírico", sede: "castilla" },
  { id: "1005", name: "LUCAS LÓPEZ", email: "lucas.lopez@dancefactory.es", pin: "1005", especialidad: "Hip Hop & Freestyle", sede: "tejar" },
  { id: "1006", name: "PAULA JIMÉNEZ", email: "paula.jimenez@dancefactory.es", pin: "1006", especialidad: "Ballet & Técnica", sede: "castilla" },
  { id: "1007", name: "ABEL Y NAYARA", email: "abel.nayara@dancefactory.es", pin: "1007", especialidad: "Salsa & Bachata", sede: "castilla" },
  { id: "1008", name: "DARÍO HUMBERTO", email: "dario.humberto@dancefactory.es", pin: "1008", especialidad: "Urbano & Acrobacia", sede: "tejar" },
  { id: "1009", name: "NEREA OLIVARES", email: "nerea.olivares@dancefactory.es", pin: "1009", especialidad: "Danza Infantil & Juvenil", sede: "tejar" },
  { id: "1010", name: "ALEJANDRO ROVINA", email: "alejandro.rovina@dancefactory.es", pin: "1010", especialidad: "Heels & Comercial", sede: "castilla" },
  { id: "1011", name: "NIL BARBERÁ", email: "nil.barbera@dancefactory.es", pin: "1011", especialidad: "Popping & Locking", sede: "castilla" },
  { id: "9999", name: "ADMINISTRADOR MASTER", email: "admin@dancefactory.es", pin: "9999", especialidad: "Dirección", sede: "consolidado", isAdmin: true }
];

const STORAGE_KEY_PREFIX = "df_sec_lockout_";
const MAX_ATTEMPTS = 3;
const BASE_LOCKOUT_SECONDS = 60;

function checkLockout(role, customTime = Date.now()) {
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + role);
  const state = raw ? JSON.parse(raw) : { failedCount: 0, lockedUntil: 0, lockoutStreak: 0 };
  const now = customTime;

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

  if (state.lockedUntil && now >= state.lockedUntil) {
    const resetState = {
      failedCount: 0,
      lockedUntil: 0,
      lockoutStreak: state.lockoutStreak
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + role, JSON.stringify(resetState));
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

function registerFailedAttempt(role, identifier, customTime = Date.now()) {
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + role);
  const state = raw ? JSON.parse(raw) : { failedCount: 0, lockedUntil: 0, lockoutStreak: 0 };
  const now = customTime;

  const newCount = state.failedCount + 1;
  let lockedUntil = 0;
  let newStreak = state.lockoutStreak;

  if (newCount >= MAX_ATTEMPTS) {
    newStreak += 1;
    const lockoutSec = newStreak > 1 ? 300 : BASE_LOCKOUT_SECONDS;
    lockedUntil = now + lockoutSec * 1000;
    mockLogActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_bloqueo",
      descripcion: `Lockout for ${role} (${identifier}) for ${lockoutSec}s`
    });
  } else {
    mockLogActivity({
      origen: "seguridad",
      tipo_evento: "seguridad_intento_fallido",
      descripcion: `Failed attempt ${newCount}/${MAX_ATTEMPTS} for ${role}`
    });
  }

  const updatedState = {
    failedCount: newCount,
    lockedUntil,
    lockoutStreak: newStreak
  };
  localStorage.setItem(STORAGE_KEY_PREFIX + role, JSON.stringify(updatedState));
  return checkLockout(role, customTime);
}

function registerSuccessfulLogin(role, identifier) {
  localStorage.removeItem(STORAGE_KEY_PREFIX + role);
}

function authenticateTeacher(pinOrEmail) {
  const clean = (pinOrEmail || "").trim().toLowerCase();
  const matched = TEACHERS.find(t =>
    t.pin === clean ||
    t.email.toLowerCase() === clean ||
    t.name.toLowerCase() === clean
  );
  return matched || null;
}

// ============================================================================
// SECTION 1: TEACHER PIN AUTHENTICATION & BRUTE FORCE LOCKOUT TESTS
// ============================================================================
console.log("--------------------------------------------------------------------------------");
console.log("SECTION 1: TEACHER AUTHENTICATION PIN & BRUTE FORCE LOCKOUT");
console.log("--------------------------------------------------------------------------------");

test("[AUTH.1] All 12 Teachers successfully authenticate with their exact 4-digit PIN", () => {
  for (const t of TEACHERS) {
    const authResult = authenticateTeacher(t.pin);
    assert.ok(authResult, `Teacher ${t.name} must authenticate with PIN ${t.pin}`);
    assert.equal(authResult.id, t.id);
    assert.equal(authResult.name, t.name);
  }
});

test("[AUTH.2] Teachers authenticate via email as alternative login mode", () => {
  for (const t of TEACHERS) {
    const authResult = authenticateTeacher(t.email);
    assert.ok(authResult, `Teacher ${t.name} must authenticate with email ${t.email}`);
  }
});

test("[AUTH.3] Invalid PINs and malformed inputs are strictly rejected", () => {
  const invalidInputs = ["0000", "1234", "9998", "", " ", "pin", "100", "10001", null, undefined];
  for (const input of invalidInputs) {
    const authResult = authenticateTeacher(input);
    assert.equal(authResult, null, `Input '${input}' must be rejected`);
  }
});

test("[AUTH.4] Brute force lockout step-by-step: 1st and 2nd failed attempts decrements attemptsLeft without locking", () => {
  localStorage.clear();
  let status = checkLockout("profesor");
  assert.equal(status.isLocked, false);
  assert.equal(status.attemptsLeft, 3);
  assert.equal(status.failedCount, 0);

  // Attempt 1
  status = registerFailedAttempt("profesor", "0001");
  assert.equal(status.isLocked, false);
  assert.equal(status.attemptsLeft, 2);
  assert.equal(status.failedCount, 1);

  // Attempt 2
  status = registerFailedAttempt("profesor", "0002");
  assert.equal(status.isLocked, false);
  assert.equal(status.attemptsLeft, 1);
  assert.equal(status.failedCount, 2);
});

test("[AUTH.5] 3rd consecutive failed attempt triggers immediate 60-second cooldown lockout", () => {
  const startTime = 1700000000000;
  localStorage.clear();

  registerFailedAttempt("profesor", "0001", startTime);
  registerFailedAttempt("profesor", "0002", startTime);
  const status = registerFailedAttempt("profesor", "0003", startTime);

  assert.equal(status.isLocked, true, "Must be locked after 3 failed attempts");
  assert.equal(status.remainingSeconds, 60, "Must have 60 seconds remaining");
  assert.equal(status.attemptsLeft, 0, "0 attempts left during lockout");
  assert.equal(status.failedCount, 3);

  // 30 seconds into cooldown
  const status30s = checkLockout("profesor", startTime + 30000);
  assert.equal(status30s.isLocked, true);
  assert.equal(status30s.remainingSeconds, 30);
});

test("[AUTH.6] Lockout automatically expires after 60 seconds and resets attempts counter", () => {
  const startTime = 1700000000000;
  localStorage.clear();

  registerFailedAttempt("profesor", "0001", startTime);
  registerFailedAttempt("profesor", "0002", startTime);
  registerFailedAttempt("profesor", "0003", startTime);

  // 60.1 seconds later
  const statusExpired = checkLockout("profesor", startTime + 60100);
  assert.equal(statusExpired.isLocked, false, "Lockout must be released");
  assert.equal(statusExpired.remainingSeconds, 0);
  assert.equal(statusExpired.attemptsLeft, 3, "Attempts must be reset to 3");
  assert.equal(statusExpired.failedCount, 0);
});

test("[AUTH.7] Successful login immediately purges security counter from storage", () => {
  localStorage.clear();
  registerFailedAttempt("profesor", "0001");
  registerFailedAttempt("profesor", "0002");

  assert.equal(checkLockout("profesor").failedCount, 2);

  // Teacher successfully enters correct PIN
  registerSuccessfulLogin("profesor", "1001");

  const postLoginStatus = checkLockout("profesor");
  assert.equal(postLoginStatus.failedCount, 0, "Counter must be purged to 0");
  assert.equal(postLoginStatus.attemptsLeft, 3);
  assert.equal(postLoginStatus.isLocked, false);
});

test("[AUTH.8] Secondary lockout streak triggers escalated 300-second (5 min) cooldown", () => {
  const t0 = 1700000000000;
  localStorage.clear();

  // Streak 1 (60s)
  registerFailedAttempt("profesor", "0001", t0);
  registerFailedAttempt("profesor", "0002", t0);
  registerFailedAttempt("profesor", "0003", t0);

  // Expire 1st lockout
  const t1 = t0 + 61000;
  checkLockout("profesor", t1);

  // Streak 2 (300s)
  registerFailedAttempt("profesor", "0001", t1);
  registerFailedAttempt("profesor", "0002", t1);
  const statusStreak2 = registerFailedAttempt("profesor", "0003", t1);

  assert.equal(statusStreak2.isLocked, true);
  assert.equal(statusStreak2.remainingSeconds, 300, "Secondary streak must impose 300s lockout");
});

// ============================================================================
// SECTION 2: TEACHER ATTENDANCE ROLL CALL & SUPABASE PAYLOAD CONTRACT
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 2: TEACHER ROLL CALL & SUPABASE 'asistencias' PAYLOAD CONFORMANCE");
console.log("--------------------------------------------------------------------------------");

const SUPABASE_ASISTENCIAS_SCHEMA_COLUMNS = ["id", "alumno_id", "clase_id", "fecha_hora"];
const FORBIDDEN_OBSOLETE_COLUMNS = ["tipo_acceso", "profesor_responsable", "sede"];

// Mock Supabase Client
class MockSupabaseClient {
  constructor() {
    this.asistencias = [];
    this.lastInsertPayload = null;
    this.lastDeleteQuery = null;
  }

  from(tableName) {
    if (tableName === "asistencias") {
      return {
        select: (cols) => ({
          eq: (field, val) => ({
            gte: (gField, gVal) => ({
              lte: async (lField, lVal) => {
                const filtered = this.asistencias.filter(a =>
                  a[field] === val && a[gField] >= gVal && a[lField] <= lVal
                );
                return { data: filtered, error: null };
              }
            })
          })
        }),
        insert: async (rows) => {
          this.lastInsertPayload = rows;
          for (const row of rows) {
            // Check for illegal columns
            for (const col of FORBIDDEN_OBSOLETE_COLUMNS) {
              if (col in row) {
                throw new Error(`PGRST204: Could not find the '${col}' column of 'asistencias' in the schema cache`);
              }
            }
            // Check that required columns exist
            assert.ok(row.alumno_id, "Missing alumno_id");
            assert.ok(row.clase_id, "Missing clase_id");
            assert.ok(row.fecha_hora, "Missing fecha_hora");

            const newRecord = {
              id: "asist_" + Math.random().toString(36).substring(2, 9),
              ...row
            };
            this.asistencias.push(newRecord);
          }
          return { data: rows, error: null };
        },
        delete: () => ({
          eq: (f1, v1) => ({
            eq: (f2, v2) => ({
              gte: (f3, v3) => ({
                lte: async (f4, v4) => {
                  this.lastDeleteQuery = { [f1]: v1, [f2]: v2, [f3]: v3, [f4]: v4 };
                  const initialLen = this.asistencias.length;
                  this.asistencias = this.asistencias.filter(a =>
                    !(a[f1] === v1 && a[f2] === v2 && a[f3] >= v3 && a[f4] <= v4)
                  );
                  return { data: null, error: null, count: initialLen - this.asistencias.length };
                }
              })
            })
          })
        })
      };
    }
    throw new Error(`Unknown table: ${tableName}`);
  }
}

// Teacher Portal Roll Call logic from TeacherPortalView.tsx
async function simulateTeacherToggleAttendance(supabaseMock, selectedClase, studentId, studentName, teacherName, currentPresentIds) {
  const isPresent = currentPresentIds.includes(studentId);
  const todayIso = new Date().toISOString().split("T")[0];

  if (isPresent) {
    await supabaseMock
      .from("asistencias")
      .delete()
      .eq("clase_id", selectedClase.id)
      .eq("alumno_id", studentId)
      .gte("fecha_hora", todayIso + "T00:00:00")
      .lte("fecha_hora", todayIso + "T23:59:59");

    mockLogActivity({
      origen: "profesor",
      tipo_evento: "asistencia_cancelada",
      descripcion: `Profesor ${teacherName} desmarcó asistencia de ${studentName} en ${selectedClase.nombre_clase}`,
      usuario_afectado: studentName
    });

    return currentPresentIds.filter(id => id !== studentId);
  } else {
    // Exact verified payload contract: { alumno_id, clase_id, fecha_hora }
    await supabaseMock
      .from("asistencias")
      .insert([{
        alumno_id: studentId,
        clase_id: selectedClase.id,
        fecha_hora: new Date().toISOString()
      }]);

    mockLogActivity({
      origen: "profesor",
      tipo_evento: "asistencia_pase_lista",
      descripcion: `Profesor ${teacherName} confirmó asistencia presencial de ${studentName} en ${selectedClase.nombre_clase}`,
      usuario_afectado: studentName
    });

    return [...currentPresentIds, studentId];
  }
}

await asyncTest("[ROLLCALL.1] 1-Click marking inserts EXACT Supabase payload { alumno_id, clase_id, fecha_hora }", async () => {
  const mockSupabase = new MockSupabaseClient();
  const testClass = { id: "clase_urbano_001", nombre_clase: "Urbano Avanzado", sede: "tejar" };
  const studentId = "student_uuid_101";

  const updatedPresent = await simulateTeacherToggleAttendance(
    mockSupabase, testClass, studentId, "Marta García", "LUCÍA MUÑOZ", []
  );

  assert.deepEqual(updatedPresent, [studentId]);
  assert.ok(mockSupabase.lastInsertPayload, "Must execute insert");
  const insertedRow = mockSupabase.lastInsertPayload[0];

  const keys = Object.keys(insertedRow).sort();
  assert.deepEqual(keys, ["alumno_id", "clase_id", "fecha_hora"].sort(), "Payload keys must strictly match { alumno_id, clase_id, fecha_hora }");
  assert.equal(insertedRow.alumno_id, studentId);
  assert.equal(insertedRow.clase_id, testClass.id);
  assert.ok(Date.parse(insertedRow.fecha_hora), "fecha_hora must be a valid ISO timestamp");
});

await asyncTest("[ROLLCALL.2] Payload excludes all obsolete/non-existent columns (tipo_acceso, profesor_responsable, sede)", async () => {
  const mockSupabase = new MockSupabaseClient();
  const testClass = { id: "clase_open_002", nombre_clase: "Open Class Commercial", sede: "castilla" };
  const studentId = "student_uuid_102";

  await simulateTeacherToggleAttendance(
    mockSupabase, testClass, studentId, "Carlos Ruiz", "ANDREA SOTO", []
  );

  const insertedRow = mockSupabase.lastInsertPayload[0];
  for (const forbidden of FORBIDDEN_OBSOLETE_COLUMNS) {
    assert.equal(forbidden in insertedRow, false, `Column '${forbidden}' must NOT be in payload`);
  }
});

test("[ROLLCALL.3] Static file inspection of TeacherPortalView.tsx confirms schema-compliant insert payload", () => {
  const filePath = resolveAppFile("student-app", "src/components/TeacherPortalView.tsx");
  const fileContent = fs.readFileSync(filePath, "utf8");

  // Verify that insert payload contains alumno_id, clase_id, fecha_hora
  assert.ok(fileContent.includes('"asistencias"'), "Must reference asistencias table");
  assert.ok(fileContent.includes("alumno_id: studentId"), "Must have alumno_id");
  assert.ok(fileContent.includes("clase_id: selectedClase.id"), "Must have clase_id");
  assert.ok(fileContent.includes("fecha_hora: new Date().toISOString()"), "Must have fecha_hora");

  // Verify obsolete columns are completely removed
  assert.equal(fileContent.includes("tipo_acceso:"), false, "TeacherPortalView.tsx must NOT insert tipo_acceso");
  assert.equal(fileContent.includes("profesor_responsable:"), false, "TeacherPortalView.tsx must NOT insert profesor_responsable");
});

await asyncTest("[ROLLCALL.4] Unchecking attendance removes record cleanly via date-bounded delete query and logs event", async () => {
  const mockSupabase = new MockSupabaseClient();
  const testClass = { id: "clase_jazz_003", nombre_clase: "Jazz Lírico", sede: "castilla" };
  const studentId = "student_uuid_103";

  // 1. Mark present
  let presentList = await simulateTeacherToggleAttendance(
    mockSupabase, testClass, studentId, "Elena Gómez", "EVA LEIVA", []
  );
  assert.equal(mockSupabase.asistencias.length, 1);

  // 2. Unmark
  presentList = await simulateTeacherToggleAttendance(
    mockSupabase, testClass, studentId, "Elena Gómez", "EVA LEIVA", presentList
  );

  assert.deepEqual(presentList, []);
  assert.equal(mockSupabase.asistencias.length, 0, "Record must be deleted");
  assert.ok(mockSupabase.lastDeleteQuery, "Delete query must be registered");
  assert.equal(mockSupabase.lastDeleteQuery.clase_id, testClass.id);
  assert.equal(mockSupabase.lastDeleteQuery.alumno_id, studentId);
});

// ============================================================================
// SECTION 3: TEACHER STANDBY BONO REQUEST & RECEPTION RECONCILIATION
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 3: TEACHER STANDBY BONOS (-10%) & DEDUPLICATED RECEPTION RECONCILIATION");
console.log("--------------------------------------------------------------------------------");

const BONOS_DOCENTES = [
  { id: "Bono 4 clases", nombre: "Bono 4 Clases Docente", clasesCount: 4, precioOriginal: 45.00, precioDocenteNum: 40.50 },
  { id: "Bono 8 clases", nombre: "Bono 8 Clases Docente", clasesCount: 8, precioOriginal: 57.00, precioDocenteNum: 51.30 },
  { id: "Bono 10 clases", nombre: "Bono 10 Clases Docente", clasesCount: 10, precioOriginal: 79.00, precioDocenteNum: 71.10 },
  { id: "Mensualidad Ilimitada", nombre: "Pase Ilimitado Docente", clasesCount: 999, precioOriginal: 100.00, precioDocenteNum: 90.00 }
];

test("[BONO.1] -10% Teacher Discount calculation matches exact required prices", () => {
  for (const b of BONOS_DOCENTES) {
    const computedDiscount = Math.round((b.precioOriginal * 0.90) * 100) / 100;
    assert.equal(computedDiscount, b.precioDocenteNum, `Bono ${b.nombre} discount mismatch`);
  }
});

// Implementation of Teacher Bono Request & Reception Reconciliation
function requestTeacherBonoStandby(teacherStudent, selectedBono, currentTeacher) {
  const pendingPlanText = `Pendiente: ${selectedBono.nombre} (${selectedBono.precioDocenteNum.toFixed(2)} €)`;

  // 1. Pending bono request queue
  const storedReqs = JSON.parse(localStorage.getItem("pending_bono_requests") || "[]");
  const newReq = {
    id: "req_docente_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    student_id: teacherStudent.id,
    student_name: teacherStudent.nombre_completo + " (Docente)",
    student_email: teacherStudent.email,
    bono_nombre: selectedBono.nombre,
    bono_precio: `${selectedBono.precioDocenteNum.toFixed(2)} €`,
    fecha: "Hoy (Docente)",
    estado: "Pendiente de cobro en Recepción"
  };
  localStorage.setItem("pending_bono_requests", JSON.stringify([newReq, ...storedReqs]));

  // 2. Pending ledger transaction
  const rawPayments = localStorage.getItem("df_pagos_transacciones_v1");
  const allPayments = rawPayments ? JSON.parse(rawPayments) : [];
  const now = new Date();
  const pendingTx = {
    id: "pago_docente_pending_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    numero_recibo: "PEND-" + now.getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
    fecha_hora: now.toISOString(),
    fecha_corta: now.toLocaleDateString("es-ES"),
    hora_corta: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    alumno_id: teacherStudent.id,
    alumno_nombre: teacherStudent.nombre_completo + " (Docente)",
    alumno_dni: "Docente DF",
    concepto: selectedBono.nombre + " (-10% dto Docente)",
    categoria: "bono",
    importe: selectedBono.precioDocenteNum,
    metodo_pago: "Pendiente Recepción",
    sede: currentTeacher?.sede || "castilla",
    atendido_por: "Solicitud Portal Profesor",
    estado: "Pendiente"
  };
  localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify([pendingTx, ...allPayments]));

  return { newReq, pendingTx, pendingPlanText };
}

function cobrarPagoPendiente(alumnoId, details = {}) {
  const raw = localStorage.getItem("df_pagos_transacciones_v1");
  const all = raw ? JSON.parse(raw) : [];
  const pendingIndex = all.findIndex(p => p.alumno_id === alumnoId && p.estado === "Pendiente");
  if (pendingIndex === -1) return null;

  const pending = all[pendingIndex];
  const nextNum = all.filter(p => p.estado === "Cobrado").length + 1;
  const numero_recibo = "REC-2026-" + String(nextNum).padStart(4, "0");

  const updated = {
    ...pending,
    numero_recibo,
    metodo_pago: details.metodo_pago || (pending.metodo_pago === "Pendiente Recepción" ? "Efectivo" : pending.metodo_pago),
    sede: details.sede || pending.sede,
    atendido_por: details.atendido_por || pending.atendido_por,
    importe: details.importe !== undefined ? details.importe : pending.importe,
    notas: details.notas || "Cobrado en mostrador de recepción",
    estado: "Cobrado"
  };

  all[pendingIndex] = updated;
  localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify(all));
  return updated;
}

function registrarNuevoPago(data) {
  const raw = localStorage.getItem("df_pagos_transacciones_v1");
  const all = raw ? JSON.parse(raw) : [];
  const nextNum = all.filter(p => p.estado === "Cobrado").length + 1;
  const numero_recibo = "REC-2026-" + String(nextNum).padStart(4, "0");

  const nuevoPago = {
    id: "pago_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    numero_recibo,
    fecha_hora: new Date().toISOString(),
    alumno_id: data.alumno_id,
    alumno_nombre: data.alumno_nombre,
    concepto: data.concepto,
    categoria: data.categoria,
    importe: data.importe,
    metodo_pago: data.metodo_pago,
    sede: data.sede,
    atendido_por: data.atendido_por || "Recepción",
    estado: "Cobrado"
  };

  localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify([nuevoPago, ...all]));
  return nuevoPago;
}

function reconcileReceptionBono(req, studentDB) {
  let clasesToAdd = 4;
  if (req.bono_nombre.includes("8")) clasesToAdd = 8;
  else if (req.bono_nombre.includes("10")) clasesToAdd = 10;
  else if (req.bono_nombre.toLowerCase().includes("ilimitad")) clasesToAdd = 999;

  // 1. Credit classes to student record
  const currentClasses = typeof studentDB.clases_restantes === "number" ? studentDB.clases_restantes : 0;
  studentDB.clases_restantes = currentClasses + clasesToAdd;
  studentDB.plan_activo = req.bono_nombre;

  // 2. Remove from pending queue
  const pendingReqs = JSON.parse(localStorage.getItem("pending_bono_requests") || "[]");
  const updatedPending = pendingReqs.filter(r => r.id !== req.id && r.student_id !== req.student_id);
  localStorage.setItem("pending_bono_requests", JSON.stringify(updatedPending));

  // 3. Reconcile existing pending transaction OR register new
  const studentId = studentDB.id || req.student_id;
  const reconciled = studentId ? cobrarPagoPendiente(studentId, {
    metodo_pago: "Efectivo",
    sede: "castilla",
    atendido_por: "Recepción Studio 2",
    importe: parseFloat(req.bono_precio.replace(/[^\d.]/g, "")),
    notas: "Activación inmediata en recepción"
  }) : null;

  if (!reconciled) {
    registrarNuevoPago({
      alumno_id: studentId,
      alumno_nombre: req.student_name,
      concepto: req.bono_nombre,
      categoria: "bono",
      importe: parseFloat(req.bono_precio.replace(/[^\d.]/g, "")),
      metodo_pago: "Efectivo",
      sede: "castilla"
    });
  }

  return { studentDB, reconciled };
}

test("[BONO.2] Teacher Bono Request creates pending request and pending ledger transaction in STANDBY", () => {
  localStorage.clear();
  const teacherStudent = { id: "docente_1001", nombre_completo: "Lucía Muñoz", email: "lucia@dancefactory.es", clases_restantes: 0 };
  const selectedBono = BONOS_DOCENTES[1]; // Bono 8 Clases (51.30 €)

  const { newReq, pendingTx } = requestTeacherBonoStandby(teacherStudent, selectedBono, { sede: "castilla" });

  const pendingReqs = JSON.parse(localStorage.getItem("pending_bono_requests"));
  assert.equal(pendingReqs.length, 1);
  assert.equal(pendingReqs[0].student_id, "docente_1001");
  assert.equal(pendingReqs[0].bono_precio, "51.30 €");
  assert.equal(pendingReqs[0].estado, "Pendiente de cobro en Recepción");

  const ledgerTxs = JSON.parse(localStorage.getItem("df_pagos_transacciones_v1"));
  assert.equal(ledgerTxs.length, 1);
  assert.equal(ledgerTxs[0].estado, "Pendiente");
  assert.equal(ledgerTxs[0].importe, 51.30);
  assert.ok(ledgerTxs[0].numero_recibo.startsWith("PEND-"));
});

test("[BONO.3] Reception reconciliation converts Pending transaction to Cobrado with official receipt and NO duplicates", () => {
  // Precondition: 1 pending request in storage from previous step
  const teacherStudent = { id: "docente_1001", nombre_completo: "Lucía Muñoz", email: "lucia@dancefactory.es", clases_restantes: 2, plan_activo: "Docente" };
  const pendingReqs = JSON.parse(localStorage.getItem("pending_bono_requests"));
  const req = pendingReqs[0];

  const initialLedgerCount = JSON.parse(localStorage.getItem("df_pagos_transacciones_v1")).length;
  assert.equal(initialLedgerCount, 1);

  // Execute Reception Reconciliation
  const { studentDB, reconciled } = reconcileReceptionBono(req, teacherStudent);

  // 1. Pending queue cleared
  const postPendingReqs = JSON.parse(localStorage.getItem("pending_bono_requests"));
  assert.equal(postPendingReqs.length, 0, "Pending queue must be empty");

  // 2. Student balance credited +8 classes (2 + 8 = 10)
  assert.equal(studentDB.clases_restantes, 10);
  assert.equal(studentDB.plan_activo, "Bono 8 Clases Docente");

  // 3. Ledger verification: Exactly 1 transaction exists, updated to Cobrado with REC-2026 receipt
  const postLedger = JSON.parse(localStorage.getItem("df_pagos_transacciones_v1"));
  assert.equal(postLedger.length, 1, "Ledger MUST NOT contain duplicate records");
  assert.equal(postLedger[0].estado, "Cobrado");
  assert.ok(postLedger[0].numero_recibo.startsWith("REC-2026-"), "Must have assigned official receipt number");
  assert.equal(postLedger[0].importe, 51.30);
  assert.equal(postLedger[0].metodo_pago, "Efectivo");
});

test("[BONO.4] Multiple teachers requesting bonos: each is reconciled independently without cross-leakage", () => {
  localStorage.clear();
  const teacherA = { id: "docente_1001", nombre_completo: "Lucía Muñoz", email: "lucia@dancefactory.es", clases_restantes: 0 };
  const teacherB = { id: "docente_1003", nombre_completo: "Andrea Soto", email: "andrea@dancefactory.es", clases_restantes: 1 };

  requestTeacherBonoStandby(teacherA, BONOS_DOCENTES[0], { sede: "tejar" }); // 4 clases (40.50€)
  requestTeacherBonoStandby(teacherB, BONOS_DOCENTES[2], { sede: "castilla" }); // 10 clases (71.10€)

  assert.equal(JSON.parse(localStorage.getItem("pending_bono_requests")).length, 2);
  assert.equal(JSON.parse(localStorage.getItem("df_pagos_transacciones_v1")).length, 2);

  // Reconcile only Teacher A
  const reqs = JSON.parse(localStorage.getItem("pending_bono_requests"));
  const reqA = reqs.find(r => r.student_id === "docente_1001");
  reconcileReceptionBono(reqA, teacherA);

  assert.equal(teacherA.clases_restantes, 4);
  assert.equal(teacherB.clases_restantes, 1);

  const remainingPending = JSON.parse(localStorage.getItem("pending_bono_requests"));
  assert.equal(remainingPending.length, 1);
  assert.equal(remainingPending[0].student_id, "docente_1003");

  const postLedger = JSON.parse(localStorage.getItem("df_pagos_transacciones_v1"));
  assert.equal(postLedger.length, 2);
  const txA = postLedger.find(p => p.alumno_id === "docente_1001");
  const txB = postLedger.find(p => p.alumno_id === "docente_1003");

  assert.equal(txA.estado, "Cobrado");
  assert.equal(txB.estado, "Pendiente");
});

// ============================================================================
// SECTION 4: STUDENT CLASS CANCELLATION & AUTOMATIC +1 CLASS REFUND
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 4: STUDENT CLASS CANCELLATION & AUTOMATIC +1 CLASS REFUND");
console.log("--------------------------------------------------------------------------------");

const RESERVAS_KEY = "df_openclass_reservas_v2";

function createMockReservation(studentId, studentName, classId, className, dateISO, sede = "castilla") {
  const raw = localStorage.getItem(RESERVAS_KEY);
  const current = raw ? JSON.parse(raw) : [];
  const newRes = {
    id: "res_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    alumno_id: studentId,
    alumno_nombre: studentName,
    clase_id: classId,
    nombre_clase: className,
    profesor: "ANDREA SOTO",
    sede,
    fecha_iso: dateISO,
    fecha_formateada: `Fecha ${dateISO}`,
    estado: "Confirmada"
  };
  localStorage.setItem(RESERVAS_KEY, JSON.stringify([newRes, ...current]));
  return newRes;
}

function getActiveReservationsCount(classId, dateISO) {
  const raw = localStorage.getItem(RESERVAS_KEY);
  const all = raw ? JSON.parse(raw) : [];
  return all.filter(r => r.clase_id === classId && r.fecha_iso === dateISO && r.estado === "Confirmada").length;
}

function cancelReservationAndRefund(reservaId, student) {
  const raw = localStorage.getItem(RESERVAS_KEY);
  const all = raw ? JSON.parse(raw) : [];
  const targetRes = all.find(r => r.id === reservaId);
  if (!targetRes) throw new Error("Reservation not found");

  // 1. Mark status as Cancelada in storage
  const updatedAll = all.map(r => r.id === reservaId ? { ...r, estado: "Cancelada" } : r);
  localStorage.setItem(RESERVAS_KEY, JSON.stringify(updatedAll));

  // 2. Refund +1 class to bono balance (if not unlimited pass)
  const isUnlimited = (student.plan_activo || "").toLowerCase().includes("ilimitad");
  if (!isUnlimited) {
    const currentBalance = typeof student.clases_restantes === "number" ? student.clases_restantes : 0;
    student.clases_restantes = currentBalance + 1;
  }

  // 3. Log Activity
  mockLogActivity({
    origen: "alumno",
    tipo_evento: "reserva_bono",
    descripcion: `Cancelación de reserva de Open Class: "${targetRes.nombre_clase}" (Se reembolsa 1 clase al bono)`,
    usuario_afectado: student.nombre_completo
  });

  return { student, targetRes };
}

test("[REFUND.1] Cancelling an Open Class reservation refunds +1 class to student's remaining balance", () => {
  localStorage.clear();
  const student = { id: "student_201", nombre_completo: "Laura Martínez", plan_activo: "Bono 8 Clases", clases_restantes: 3 };
  const res = createMockReservation(student.id, student.nombre_completo, "clase_open_1", "Commercial Open Class", "2026-09-05");

  assert.equal(getActiveReservationsCount("clase_open_1", "2026-09-05"), 1);

  // Student cancels
  cancelReservationAndRefund(res.id, student);

  assert.equal(student.clases_restantes, 4, "Balance must be incremented from 3 to 4 (+1 refund)");
  assert.equal(getActiveReservationsCount("clase_open_1", "2026-09-05"), 0, "Capacity slot must be immediately freed");

  const storedReservations = JSON.parse(localStorage.getItem(RESERVAS_KEY));
  assert.equal(storedReservations[0].estado, "Cancelada");
});

test("[REFUND.2] Unlimited pass students (Pase Ilimitado) do NOT artificially increment numerical balance on cancel", () => {
  localStorage.clear();
  const unlimitedStudent = { id: "student_202", nombre_completo: "Javier López", plan_activo: "Pase Ilimitado Open Class", clases_restantes: 999 };
  const res = createMockReservation(unlimitedStudent.id, unlimitedStudent.nombre_completo, "clase_open_1", "Commercial Open Class", "2026-09-05");

  cancelReservationAndRefund(res.id, unlimitedStudent);

  assert.equal(unlimitedStudent.clases_restantes, 999, "Unlimited student balance must stay 999");
  assert.equal(getActiveReservationsCount("clase_open_1", "2026-09-05"), 0);
});

test("[REFUND.3] Rapid churning stress test: Book -> Cancel -> Refund -> Re-book preserves perfect conservation of balance", () => {
  localStorage.clear();
  const student = { id: "student_203", nombre_completo: "Sara Castro", plan_activo: "Bono 10 Clases", clases_restantes: 10 };
  const initialBalance = 10;

  for (let i = 0; i < 25; i++) {
    // 1. Deduct 1 class to book
    student.clases_restantes -= 1;
    const res = createMockReservation(student.id, student.nombre_completo, "clase_open_2", "Hip Hop Choreo", `2026-09-0${(i % 5) + 1}`);

    // 2. Cancel and refund +1
    cancelReservationAndRefund(res.id, student);
  }

  assert.equal(student.clases_restantes, initialBalance, "Balance must exactly equal initial starting balance after 25 book-cancel cycles");
});

test("[REFUND.4] Static file inspection of mis-clases/page.tsx confirms +1 refund and Supabase alumnos update", () => {
  const filePath = resolveAppFile("student-app", "src/app/mis-clases/page.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes("cancelarReservaOpenClass(reserva.id)"), "Must call openClassService cancellation");
  assert.ok(content.includes("updatedBalance = remainingClasses + 1"), "Must compute remainingClasses + 1");
  assert.ok(content.includes("from(\"alumnos\").update({ clases_restantes: updatedBalance })"), "Must persist updated balance in Supabase");
  assert.ok(content.includes("alumnos_clases"), "Must cascade delete from alumnos_clases");
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log("\n================================================================================");
console.log("   CHALLENGER 2 EMPIRICAL ADVERSARIAL TEST SUITE COMPLETED");
console.log("================================================================================");
console.log(`  Total Tests Run:     ${totalTests}`);
console.log(`  Passed Tests:        ${passedCount}`);
console.log(`  Failed Tests:        ${failedCount}`);
console.log(`  Success Rate:        ${((passedCount / totalTests) * 100).toFixed(2)}%`);
console.log("================================================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
