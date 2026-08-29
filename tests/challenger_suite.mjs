// Dance Factory Student-App Challenger 1 Empirical Test Suite
// Run with: node tests/challenger_suite.mjs

import assert from "node:assert/strict";

// Mock minimal browser environment for localStorage and window events
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => ({ ...store })
  };
})();

globalThis.localStorage = localStorageMock;
globalThis.window = {
  dispatchEvent: (event) => {},
  addEventListener: (name, cb) => {},
  removeEventListener: (name, cb) => {}
};

// Implementations under test from src/lib/openClassService.ts
function normalizeDay(day) {
  return (day || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function normalizeSede(sede) {
  const s = (sede || "").toLowerCase();
  if (s.includes("tejar") || s.includes("mostoles") || s.includes("móstoles") || s.includes("studio 1") || s.includes("el tejar")) {
    return "tejar";
  }
  return "castilla";
}

function formatSedeName(sede) {
  return normalizeSede(sede) === "tejar"
    ? "Studio 1 Plaza El Tejar"
    : "Studio 2 Paseo Castilla";
}

const STORAGE_KEY = "df_openclass_reservas_v2";

function getOpenClassReservas() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveOpenClassReservas(reservas) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
  } catch (e) {
    console.error("Error saving openclass reservas:", e);
  }
}

function getSesionReservasCount(claseId, fechaISO) {
  const all = getOpenClassReservas();
  return all.filter(r => r.clase_id === claseId && r.fecha_iso === fechaISO && r.estado === "Confirmada").length;
}

function isSesionCompleta(clase, fechaISO) {
  if (!clase) return false;
  const currentCount = getSesionReservasCount(clase.id, fechaISO);
  const maxCapacity = clase.aforo_maximo || 20;
  return currentCount >= maxCapacity;
}

function getReservasAlumno(alumnoId) {
  const all = getOpenClassReservas();
  return all.filter(r => r.alumno_id === alumnoId && r.estado === "Confirmada");
}

function isAlumnoReservadoEnSesion(alumnoId, claseId, fechaISO) {
  const all = getOpenClassReservas();
  return all.some(r => 
    r.alumno_id === alumnoId && 
    r.clase_id === claseId && 
    r.fecha_iso === fechaISO && 
    r.estado === "Confirmada"
  );
}

function crearReservaOpenClass(data) {
  const nueva = {
    id: "res_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    alumno_id: data.alumno_id,
    alumno_nombre: data.alumno_nombre,
    clase_id: data.clase.id,
    nombre_clase: data.clase.nombre_clase,
    profesor: data.clase.profesor,
    sede: normalizeSede(data.clase.sede || "tejar"),
    sala: data.clase.sala || "Sala 1",
    fecha_iso: data.calendarDay.dateISO,
    fecha_formateada: `${data.calendarDay.dayName.charAt(0) + data.calendarDay.dayName.slice(1).toLowerCase()} ${data.calendarDay.dayNumber} de ${data.calendarDay.monthName}`,
    dia_semana: data.calendarDay.dayName,
    hora_inicio: data.clase.hora_inicio,
    hora_fin: data.clase.hora_fin,
    creado_en: new Date().toISOString(),
    estado: "Confirmada"
  };

  const current = getOpenClassReservas();
  const updated = [nueva, ...current];
  saveOpenClassReservas(updated);
  return nueva;
}

function cancelarReservaOpenClass(reservaId) {
  const current = getOpenClassReservas();
  const updated = current.map(r => r.id === reservaId ? { ...r, estado: "Cancelada" } : r);
  saveOpenClassReservas(updated);
  return true;
}

// -------------------------------------------------------------
// Test Execution Runner
// -------------------------------------------------------------

const results = [];
let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    results.push({ name, status: "PASS" });
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, status: "FAIL", error: err.message, stack: err.stack });
    failCount++;
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log("\n========================================================");
console.log("DANCE FACTORY STUDENT-APP EMPIRICAL CHALLENGER TEST SUITE");
console.log("========================================================\n");

// =============================================================
// TEST SUITE 1: Calendar Date Filtering & Weekday Matching
// =============================================================
console.log("--- Suite 1: Calendar Date Filtering & Weekday Matching (normalizeDay) ---");

runTest("1.1 normalizeDay strips accents from MIÉRCOLES to MIERCOLES", () => {
  assert.equal(normalizeDay("MIÉRCOLES"), "MIERCOLES");
  assert.equal(normalizeDay("MIERCOLES"), "MIERCOLES");
  assert.equal(normalizeDay("miércoles"), "MIERCOLES");
  assert.equal(normalizeDay("miercoles"), "MIERCOLES");
  assert.equal(normalizeDay("MiÉrCoLeS"), "MIERCOLES");
});

runTest("1.2 normalizeDay matches SÁBADO and SABADO", () => {
  assert.equal(normalizeDay("SÁBADO"), "SABADO");
  assert.equal(normalizeDay("sabado"), "SABADO");
  assert.equal(normalizeDay("Sábado"), "SABADO");
});

runTest("1.3 normalizeDay handles all standard Spanish weekdays and cases", () => {
  assert.equal(normalizeDay("lunes"), "LUNES");
  assert.equal(normalizeDay("LUNES"), "LUNES");
  assert.equal(normalizeDay("martes"), "MARTES");
  assert.equal(normalizeDay("MARTES"), "MARTES");
  assert.equal(normalizeDay("jueves"), "JUEVES");
  assert.equal(normalizeDay("JUEVES"), "JUEVES");
  assert.equal(normalizeDay("viernes"), "VIERNES");
  assert.equal(normalizeDay("VIERNES"), "VIERNES");
  assert.equal(normalizeDay("domingo"), "DOMINGO");
  assert.equal(normalizeDay("DOMINGO"), "DOMINGO");
});

runTest("1.4 normalizeDay handles untrimmed spaces and null/undefined safely", () => {
  assert.equal(normalizeDay("  MIÉRCOLES  "), "MIERCOLES");
  assert.equal(normalizeDay("  lunes\t"), "LUNES");
  assert.equal(normalizeDay(""), "");
  assert.equal(normalizeDay(null), "");
  assert.equal(normalizeDay(undefined), "");
});

runTest("1.5 Weekday matching assertion between database record and UI filter", () => {
  const dbClass1 = { id: "c1", nombre_clase: "Hip Hop Intermedio", dia_semana: "MIÉRCOLES" };
  const dbClass2 = { id: "c2", nombre_clase: "Ballet Adultos", dia_semana: "MIERCOLES" };
  const uiSelectedDay = "MIÉRCOLES";
  const calendarDayItem = { dayName: "MIÉRCOLES" };

  const match1 = normalizeDay(dbClass1.dia_semana) === normalizeDay(uiSelectedDay);
  const match2 = normalizeDay(dbClass2.dia_semana) === normalizeDay(uiSelectedDay);
  const matchCalendar = normalizeDay(dbClass2.dia_semana) === normalizeDay(calendarDayItem.dayName);

  assert.equal(match1, true, "MIÉRCOLES matches MIÉRCOLES");
  assert.equal(match2, true, "MIERCOLES matches MIÉRCOLES");
  assert.equal(matchCalendar, true, "MIERCOLES matches calendar MIÉRCOLES");
});

// =============================================================
// TEST SUITE 2: Sede Normalization & Naming
// =============================================================
console.log("\n--- Suite 2: Sede Normalization & Naming ---");

runTest("2.1 normalizeSede maps all El Tejar / Móstoles aliases to 'tejar'", () => {
  assert.equal(normalizeSede("tejar"), "tejar");
  assert.equal(normalizeSede("mostoles"), "tejar");
  assert.equal(normalizeSede("móstoles"), "tejar");
  assert.equal(normalizeSede("MÓSTOLES"), "tejar");
  assert.equal(normalizeSede("Studio 1"), "tejar");
  assert.equal(normalizeSede("studio 1"), "tejar");
  assert.equal(normalizeSede("Plaza El Tejar"), "tejar");
  assert.equal(normalizeSede("Studio 1 Plaza El Tejar"), "tejar");
});

runTest("2.2 normalizeSede maps all Paseo Castilla / Alcorcón aliases to 'castilla'", () => {
  assert.equal(normalizeSede("castilla"), "castilla");
  assert.equal(normalizeSede("alcorcon"), "castilla");
  assert.equal(normalizeSede("ALCORCÓN"), "castilla");
  assert.equal(normalizeSede("Studio 2"), "castilla");
  assert.equal(normalizeSede("studio 2"), "castilla");
  assert.equal(normalizeSede("Paseo Castilla"), "castilla");
  assert.equal(normalizeSede("Studio 2 Paseo Castilla"), "castilla");
});

runTest("2.3 normalizeSede fallback behavior on unknown/null/empty strings", () => {
  assert.equal(normalizeSede(""), "castilla");
  assert.equal(normalizeSede(null), "castilla");
  assert.equal(normalizeSede(undefined), "castilla");
  assert.equal(normalizeSede("other"), "castilla");
});

runTest("2.4 formatSedeName produces official Studio display titles", () => {
  assert.equal(formatSedeName("tejar"), "Studio 1 Plaza El Tejar");
  assert.equal(formatSedeName("mostoles"), "Studio 1 Plaza El Tejar");
  assert.equal(formatSedeName("castilla"), "Studio 2 Paseo Castilla");
  assert.equal(formatSedeName("alcorcon"), "Studio 2 Paseo Castilla");
});

// =============================================================
// TEST SUITE 3: Capacity Limits & isSesionCompleta
// =============================================================
console.log("\n--- Suite 3: Capacity Limits & isSesionCompleta ---");

runTest("3.1 getSesionReservasCount returns 0 for a fresh session", () => {
  localStorage.clear();
  const count = getSesionReservasCount("cls_dance_1", "2026-09-01");
  assert.equal(count, 0);
});

runTest("3.2 isSesionCompleta correctly enforces custom aforo_maximo", () => {
  localStorage.clear();
  const testClass = {
    id: "cls_open_heels",
    nombre_clase: "Open Class Heels",
    profesor: "Andrea Soto",
    sede: "tejar",
    aforo_maximo: 3
  };
  const calendarDay = {
    dateISO: "2026-09-01",
    dayName: "MARTES",
    dayNumber: 1,
    monthName: "Septiembre"
  };

  assert.equal(isSesionCompleta(testClass, "2026-09-01"), false);

  // Add 1st reservation
  crearReservaOpenClass({
    alumno_id: "student_1",
    alumno_nombre: "Alumno Uno",
    clase: testClass,
    calendarDay
  });
  assert.equal(getSesionReservasCount(testClass.id, "2026-09-01"), 1);
  assert.equal(isSesionCompleta(testClass, "2026-09-01"), false);

  // Add 2nd reservation
  crearReservaOpenClass({
    alumno_id: "student_2",
    alumno_nombre: "Alumno Dos",
    clase: testClass,
    calendarDay
  });
  assert.equal(getSesionReservasCount(testClass.id, "2026-09-01"), 2);
  assert.equal(isSesionCompleta(testClass, "2026-09-01"), false);

  // Add 3rd reservation (reaches aforo_maximo = 3)
  crearReservaOpenClass({
    alumno_id: "student_3",
    alumno_nombre: "Alumno Tres",
    clase: testClass,
    calendarDay
  });
  assert.equal(getSesionReservasCount(testClass.id, "2026-09-01"), 3);
  assert.equal(isSesionCompleta(testClass, "2026-09-01"), true, "Session must be COMPLETE at 3/3");
});

runTest("3.3 isSesionCompleta uses default capacity (20) when aforo_maximo is undefined", () => {
  localStorage.clear();
  const testClassNoAforo = {
    id: "cls_no_aforo",
    nombre_clase: "Open Class Hip Hop",
    profesor: "Carlos",
    sede: "castilla"
  };
  const calendarDay = {
    dateISO: "2026-09-02",
    dayName: "MIÉRCOLES",
    dayNumber: 2,
    monthName: "Septiembre"
  };

  for (let i = 1; i <= 19; i++) {
    crearReservaOpenClass({
      alumno_id: `st_${i}`,
      alumno_nombre: `Student ${i}`,
      clase: testClassNoAforo,
      calendarDay
    });
  }
  assert.equal(isSesionCompleta(testClassNoAforo, "2026-09-02"), false, "19/20 is not complete");

  // 20th reservation
  crearReservaOpenClass({
    alumno_id: "st_20",
    alumno_nombre: "Student 20",
    clase: testClassNoAforo,
    calendarDay
  });
  assert.equal(isSesionCompleta(testClassNoAforo, "2026-09-02"), true, "20/20 is complete with default capacity");
});

runTest("3.4 Reservations on different dates/classes do not affect other sessions", () => {
  localStorage.clear();
  const classA = { id: "cls_A", aforo_maximo: 2 };
  const classB = { id: "cls_B", aforo_maximo: 2 };

  const day1 = { dateISO: "2026-09-01", dayName: "MARTES", dayNumber: 1, monthName: "Sep" };
  const day2 = { dateISO: "2026-09-02", dayName: "MIÉRCOLES", dayNumber: 2, monthName: "Sep" };

  // Fill Class A on Day 1
  crearReservaOpenClass({ alumno_id: "u1", alumno_nombre: "U1", clase: classA, calendarDay: day1 });
  crearReservaOpenClass({ alumno_id: "u2", alumno_nombre: "U2", clase: classA, calendarDay: day1 });

  assert.equal(isSesionCompleta(classA, "2026-09-01"), true);
  assert.equal(isSesionCompleta(classA, "2026-09-02"), false, "Class A on Day 2 must have 0 bookings");
  assert.equal(isSesionCompleta(classB, "2026-09-01"), false, "Class B on Day 1 must have 0 bookings");
});

// =============================================================
// TEST SUITE 4: Open Class Cancellation and Refund Logic
// =============================================================
console.log("\n--- Suite 4: Open Class Cancellation and Refund Logic ---");

runTest("4.1 Cancelling reservation marks state as Cancelada and reduces active count", () => {
  localStorage.clear();
  const testClass = { id: "cls_cancel_test", nombre_clase: "Commercial", aforo_maximo: 2, sede: "tejar" };
  const day = { dateISO: "2026-09-03", dayName: "JUEVES", dayNumber: 3, monthName: "Sep" };

  const r1 = crearReservaOpenClass({ alumno_id: "stud_alpha", alumno_nombre: "Alpha", clase: testClass, calendarDay: day });
  const r2 = crearReservaOpenClass({ alumno_id: "stud_beta", alumno_nombre: "Beta", clase: testClass, calendarDay: day });

  assert.equal(getSesionReservasCount(testClass.id, day.dateISO), 2);
  assert.equal(isSesionCompleta(testClass, day.dateISO), true);
  assert.equal(getReservasAlumno("stud_alpha").length, 1);

  // Cancel r1
  const cancelResult = cancelarReservaOpenClass(r1.id);
  assert.equal(cancelResult, true);

  // Verify counts
  assert.equal(getSesionReservasCount(testClass.id, day.dateISO), 1, "Count must drop to 1 after cancellation");
  assert.equal(isSesionCompleta(testClass, day.dateISO), false, "Session is no longer complete");
  assert.equal(getReservasAlumno("stud_alpha").length, 0, "Student alpha has 0 active bookings");
  assert.equal(getReservasAlumno("stud_beta").length, 1, "Student beta remains confirmed");
});

runTest("4.2 Bono Balance refund calculation simulation (+1 class)", () => {
  // Simulating the logic in mis-clases/page.tsx:
  // const remainingClasses = typeof currentStudent.clases_restantes === "number" ? currentStudent.clases_restantes : 0;
  // const updatedBalance = remainingClasses + 1;
  const initialStudent = {
    id: "demo_lucia",
    plan_activo: "Bono 10 clases",
    clases_restantes: 4
  };

  // Step 1: Student reserves a class (deduct 1)
  const afterBookingBalance = Math.max(0, initialStudent.clases_restantes - 1);
  assert.equal(afterBookingBalance, 3, "Balance after booking 4 -> 3");

  // Step 2: Student cancels the reservation (refund 1)
  const isUnlimited = initialStudent.plan_activo?.toLowerCase().includes("ilimitad");
  assert.equal(isUnlimited, false);
  const afterCancelBalance = afterBookingBalance + 1;
  assert.equal(afterCancelBalance, 4, "Balance after refund 3 -> 4");
});

runTest("4.3 Unlimited pass student does not increment balance on cancellation", () => {
  const unlimitedStudent = {
    id: "demo_unlimited",
    plan_activo: "Pase Ilimitado Open Class",
    clases_restantes: 999
  };

  const hasUnlimited = unlimitedStudent.plan_activo?.toLowerCase().includes("ilimitad");
  assert.equal(hasUnlimited, true);

  // Logic skips numeric refund if unlimited
  let finalBalance = unlimitedStudent.clases_restantes;
  if (!hasUnlimited) {
    finalBalance += 1;
  }
  assert.equal(finalBalance, 999, "Unlimited plan remains 999");
});

// =============================================================
// TEST SUITE 5: Regular Class Filtering in /mis-clases & /clases
// =============================================================
console.log("\n--- Suite 5: Regular Class Filtering (Exclusion of OPEN CLASS & FORMACI) ---");

runTest("5.1 Regular class filter excludes both OPEN CLASS and FORMACIÓN variants", () => {
  const mockClassQuadrant = [
    { id: "c1", nombre_clase: "Danza Urbana Iniciación", dia_semana: "LUNES" },
    { id: "c2", nombre_clase: "Ballet Adultos Básico", dia_semana: "LUNES" },
    { id: "c3", nombre_clase: "OPEN CLASS Comercial Andrea Soto", dia_semana: "LUNES" },
    { id: "c4", nombre_clase: "Open Class Sexy Style", dia_semana: "LUNES" },
    { id: "c5", nombre_clase: "open class Heels", dia_semana: "LUNES" },
    { id: "c6", nombre_clase: "FORMACIÓN PROFESIONAL URBAN DANCE", dia_semana: "LUNES" },
    { id: "c7", nombre_clase: "Formación Contemporáneo Nivel Avanzado", dia_semana: "LUNES" },
    { id: "c8", nombre_clase: "formacion Danza Moderna", dia_semana: "LUNES" },
    { id: "c9", nombre_clase: "Salsa y Bachata Intermedio", dia_semana: "LUNES" },
    { id: "c10", nombre_clase: "Flamenco Fusión", dia_semana: "LUNES" }
  ];

  // Exact filter from mis-clases/page.tsx & clases/page.tsx:
  const regularClasses = mockClassQuadrant.filter((c) =>
    !c.nombre_clase.toUpperCase().includes("OPEN CLASS") &&
    !c.nombre_clase.toUpperCase().includes("FORMACI")
  );

  const openClassesAndFormaciones = mockClassQuadrant.filter((c) =>
    c.nombre_clase.toUpperCase().includes("OPEN CLASS") ||
    c.nombre_clase.toUpperCase().includes("FORMACI")
  );

  assert.equal(regularClasses.length, 4, "Must have exactly 4 regular classes");
  assert.deepEqual(
    regularClasses.map(c => c.id),
    ["c1", "c2", "c9", "c10"],
    "Regular classes must only include non-OpenClass non-Formacion classes"
  );

  assert.equal(openClassesAndFormaciones.length, 6, "Must have 6 open class / formacion sessions");
  assert.deepEqual(
    openClassesAndFormaciones.map(c => c.id),
    ["c3", "c4", "c5", "c6", "c7", "c8"]
  );
});

// =============================================================
// TEST SUITE 6: Adversarial Boundary & Stress Cases
// =============================================================
console.log("\n--- Suite 6: Adversarial Edge Cases & Registration Validation ---");

runTest("6.1 Spanish phone regex validation (src/app/registro/page.tsx)", () => {
  const phoneRegex = /^(\+34|0034)?[6789]\d{8}$/;

  // Valid phones
  assert.equal(phoneRegex.test("612345678"), true);
  assert.equal(phoneRegex.test("712345678"), true);
  assert.equal(phoneRegex.test("812345678"), true);
  assert.equal(phoneRegex.test("912345678"), true);
  assert.equal(phoneRegex.test("+34612345678"), true);
  assert.equal(phoneRegex.test("0034612345678"), true);

  // Invalid phones
  assert.equal(phoneRegex.test("512345678"), false, "Starts with 5");
  assert.equal(phoneRegex.test("61234567"), false, "Too short (8 digits)");
  assert.equal(phoneRegex.test("6123456789"), false, "Too long (10 digits)");
  assert.equal(phoneRegex.test("abc612345678"), false, "Letters prefix");
});

runTest("6.2 Spanish DNI / NIE regex validation (src/app/registro/page.tsx)", () => {
  const dniNieRegex = /^(\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/;

  // Valid DNI
  assert.equal(dniNieRegex.test("50894721K"), true);
  assert.equal(dniNieRegex.test("00000000T"), true);

  // Valid NIE
  assert.equal(dniNieRegex.test("X1234567L"), true);
  assert.equal(dniNieRegex.test("Y7654321M"), true);
  assert.equal(dniNieRegex.test("Z9999999P"), true);

  // Invalid DNI/NIE
  assert.equal(dniNieRegex.test("50894721k"), false, "Lowercase letter");
  assert.equal(dniNieRegex.test("5089472K"), false, "7 digits DNI");
  assert.equal(dniNieRegex.test("W1234567L"), false, "Invalid NIE prefix");
});

runTest("6.3 Annual 15€ Registration Fee Calculation for First vs Subsequent Purchases", () => {
  // Bono 8 classes: 57€
  const basePrice = 57.00;

  // Case A: New student (matricula_pagada: false)
  const studentNew = { matricula_pagada: false };
  const feeNew = !studentNew.matricula_pagada ? 15.00 : 0.00;
  const totalNew = basePrice + feeNew;
  assert.equal(totalNew, 72.00, "57€ + 15€ = 72€");

  // Case B: Existing student (matricula_pagada: true)
  const studentExisting = { matricula_pagada: true };
  const feeExisting = !studentExisting.matricula_pagada ? 15.00 : 0.00;
  const totalExisting = basePrice + feeExisting;
  assert.equal(totalExisting, 57.00, "57€ + 0€ = 57€");
});

console.log("\n========================================================");
console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log("========================================================\n");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
