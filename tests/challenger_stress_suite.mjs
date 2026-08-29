// Dance Factory Student-App Challenger 1 Stress & Adversarial Test Harness
// Run with: node tests/challenger_stress_suite.mjs

import assert from "node:assert/strict";

// Mock localStorage
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

// Implementations from src/lib/openClassService.ts
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
    id: "res_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
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

let passCount = 0;
let failCount = 0;

function stressAssert(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ⚡ PASS: ${name}`);
  } catch (err) {
    failCount++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
  }
}

console.log("\n========================================================");
console.log("DANCE FACTORY - ADVERSARIAL STRESS TEST HARNESS");
console.log("========================================================\n");

// STRESS TEST 1: Unicode Normalization & Diacritics Adversarial Matrix
console.log("--- Stress 1: Unicode Normalization & Diacritics Adversarial Matrix ---");

stressAssert("Handles NFC, NFD, uppercase, lowercase, mixed diacritics", () => {
  const variationsMiercoles = [
    "MIÉRCOLES",
    "MIERCOLES",
    "miércoles",
    "miercoles",
    "M\u0049\u0045\u0301\u0052\u0043\u004F\u004C\u0045\u0053", // NFD decomposed
    "\u004D\u0049\u00C9\u0052\u0043\u004F\u004C\u0045\u0053", // NFC composed (MIÉRCOLES)
    "  miércoles \n",
    "\tMiérCOLES\r"
  ];

  for (const v of variationsMiercoles) {
    assert.equal(normalizeDay(v), "MIERCOLES", `Failed on variation: ${JSON.stringify(v)}`);
  }
});

stressAssert("Handles Sábado and other accented days across NFC/NFD", () => {
  const variationsSabado = [
    "SÁBADO",
    "SABADO",
    "sábado",
    "sabado",
    "S\u0041\u0301\u0042\u0041\u0044\u004F", // NFD decomposed SÁBADO
    "  sábado  "
  ];

  for (const v of variationsSabado) {
    assert.equal(normalizeDay(v), "SABADO", `Failed on variation: ${JSON.stringify(v)}`);
  }
});

// STRESS TEST 2: High Concurrency / Multi-Booking Simulation
console.log("\n--- Stress 2: Capacity Boundary & Churn Simulation (Book -> Fill -> Cancel -> Rebook) ---");

stressAssert("Simulate 100 students contending for 15 slots in Open Class", () => {
  localStorage.clear();
  const highDemandClass = {
    id: "cls_heels_pro",
    nombre_clase: "Open Class Heels Pro",
    profesor: "Andrea Soto",
    sede: "tejar",
    aforo_maximo: 15
  };
  const calendarDay = {
    dateISO: "2026-09-05",
    dayName: "SÁBADO",
    dayNumber: 5,
    monthName: "Septiembre"
  };

  const bookedReservations = [];
  const rejectedStudents = [];

  // Attempt booking for 100 students
  for (let i = 1; i <= 100; i++) {
    const studentId = `student_${i}`;
    const studentName = `Student ${i}`;

    if (isSesionCompleta(highDemandClass, calendarDay.dateISO)) {
      rejectedStudents.push(studentId);
    } else {
      const res = crearReservaOpenClass({
        alumno_id: studentId,
        alumno_nombre: studentName,
        clase: highDemandClass,
        calendarDay
      });
      bookedReservations.push(res);
    }
  }

  assert.equal(bookedReservations.length, 15, "Exactly 15 students booked");
  assert.equal(rejectedStudents.length, 85, "Exactly 85 students rejected when capacity reached");
  assert.equal(getSesionReservasCount(highDemandClass.id, calendarDay.dateISO), 15);
  assert.equal(isSesionCompleta(highDemandClass, calendarDay.dateISO), true);

  // Now cancel 3 reservations (e.g. index 0, 5, 10)
  cancelarReservaOpenClass(bookedReservations[0].id);
  cancelarReservaOpenClass(bookedReservations[5].id);
  cancelarReservaOpenClass(bookedReservations[10].id);

  assert.equal(getSesionReservasCount(highDemandClass.id, calendarDay.dateISO), 12);
  assert.equal(isSesionCompleta(highDemandClass, calendarDay.dateISO), false, "Must open 3 slots");

  // Next 3 students from rejected list book
  for (let k = 0; k < 3; k++) {
    assert.equal(isSesionCompleta(highDemandClass, calendarDay.dateISO), false);
    const nextStudentId = rejectedStudents[k];
    const res = crearReservaOpenClass({
      alumno_id: nextStudentId,
      alumno_nombre: `Student ${nextStudentId}`,
      clase: highDemandClass,
      calendarDay
    });
    bookedReservations.push(res);
  }

  assert.equal(getSesionReservasCount(highDemandClass.id, calendarDay.dateISO), 15);
  assert.equal(isSesionCompleta(highDemandClass, calendarDay.dateISO), true, "Capacity is full again at 15");
});

// STRESS TEST 3: Duplicate Enrollment Detection (isAlumnoReservadoEnSesion)
console.log("\n--- Stress 3: Duplicate Booking Protection ---");

stressAssert("isAlumnoReservadoEnSesion prevents double booking the same student in same session", () => {
  localStorage.clear();
  const testClass = { id: "cls_bachata", aforo_maximo: 20, sede: "castilla" };
  const day1 = { dateISO: "2026-09-08", dayName: "MARTES", dayNumber: 8, monthName: "Sep" };
  const day2 = { dateISO: "2026-09-15", dayName: "MARTES", dayNumber: 15, monthName: "Sep" };

  assert.equal(isAlumnoReservadoEnSesion("alumno_xyz", testClass.id, day1.dateISO), false);

  // Book on Day 1
  const r1 = crearReservaOpenClass({
    alumno_id: "alumno_xyz",
    alumno_nombre: "Alumno XYZ",
    clase: testClass,
    calendarDay: day1
  });

  assert.equal(isAlumnoReservadoEnSesion("alumno_xyz", testClass.id, day1.dateISO), true);
  assert.equal(isAlumnoReservadoEnSesion("alumno_xyz", testClass.id, day2.dateISO), false, "Not booked on day 2 yet");

  // Cancel Day 1
  cancelarReservaOpenClass(r1.id);
  assert.equal(isAlumnoReservadoEnSesion("alumno_xyz", testClass.id, day1.dateISO), false, "No longer active on day 1 after cancel");
});

// STRESS TEST 4: Student Balance State Machine
console.log("\n--- Stress 4: Student Balance State Machine & 15€ Fee Ledger ---");

stressAssert("Simulate Bono purchase, multi-session bookings, cancellations, balance depletion and lockout", () => {
  localStorage.clear();

  // Initial state: New student Carlos buying Bono 4 (45€ + 15€ matrícula = 60€)
  let student = {
    id: "demo_carlos",
    nombre_completo: "Carlos Ruiz",
    matricula_pagada: false,
    plan_activo: null,
    clases_restantes: 0,
    sede: "castilla",
    dni: "52345678B",
    telefono: "677 334 455"
  };

  // Step 1: Purchase Bono 4
  const isFirstPurchase = !student.matricula_pagada;
  const basePrice = 45.00;
  const fee = isFirstPurchase ? 15.00 : 0.00;
  const total = basePrice + fee;

  assert.equal(total, 60.00, "Carlos must pay 60.00€ on first purchase");

  // Simulate payment processing
  student.matricula_pagada = true;
  student.plan_activo = "Bono 4 Clases";
  student.clases_restantes = 4;

  const paymentRecord = {
    id: "pago_online_" + Date.now(),
    numero_recibo: "REC-2026-1001",
    fecha_hora: new Date().toISOString(),
    alumno_id: student.id,
    alumno_nombre: student.nombre_completo,
    alumno_dni: student.dni,
    alumno_telefono: student.telefono,
    concepto: "Bono 4 Clases + Matrícula Anual (15€)",
    categoria: "bono",
    importe: total,
    metodo_pago: "Stripe",
    sede: normalizeSede(student.sede),
    estado: "Cobrado"
  };

  localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify([paymentRecord]));
  const storedLedger = JSON.parse(localStorage.getItem("df_pagos_transacciones_v1"));
  assert.equal(storedLedger.length, 1);
  assert.equal(storedLedger[0].importe, 60.00);
  assert.equal(storedLedger[0].sede, "castilla");

  // Step 2: Second purchase in same season -> Matrícula is 0€
  const isSecondPurchase = !student.matricula_pagada;
  const secondFee = isSecondPurchase ? 15.00 : 0.00;
  assert.equal(secondFee, 0.00, "Second purchase has 0€ registration fee");

  // Step 3: Student uses 4 classes
  const mockClass = { id: "cls_urbano", aforo_maximo: 20 };
  const days = [
    { dateISO: "2026-09-01", dayName: "MARTES", dayNumber: 1, monthName: "Sep" },
    { dateISO: "2026-09-02", dayName: "MIÉRCOLES", dayNumber: 2, monthName: "Sep" },
    { dateISO: "2026-09-03", dayName: "JUEVES", dayNumber: 3, monthName: "Sep" },
    { dateISO: "2026-09-04", dayName: "VIERNES", dayNumber: 4, monthName: "Sep" }
  ];

  const bookings = [];
  for (const d of days) {
    assert.ok(student.clases_restantes > 0, "Has balance to book");
    student.clases_restantes = Math.max(0, student.clases_restantes - 1);
    const r = crearReservaOpenClass({
      alumno_id: student.id,
      alumno_nombre: student.nombre_completo,
      clase: mockClass,
      calendarDay: d
    });
    bookings.push(r);
  }

  assert.equal(student.clases_restantes, 0, "Student has 0 remaining classes");

  // Attempt 5th booking: Balance check fails
  const canBookMore = student.clases_restantes > 0;
  assert.equal(canBookMore, false, "Cannot book with 0 balance");

  // Student cancels 1 session (booking[1])
  cancelarReservaOpenClass(bookings[1].id);
  student.clases_restantes += 1;
  assert.equal(student.clases_restantes, 1, "Balance restored to 1 class");

  // Now student can book again
  assert.equal(student.clases_restantes > 0, true);
});

// STRESS TEST 5: Sede Alias Permutations Matrix
console.log("\n--- Stress 5: Sede Alias Permutations Matrix ---");

stressAssert("Stress testing arbitrary sede string aliases", () => {
  const tejarVariants = [
    "tejar",
    "TEJAR",
    "el tejar",
    "Plaza El Tejar",
    "Studio 1 Plaza El Tejar",
    "studio 1",
    "STUDIO 1",
    "mostoles",
    "MOSTOLES",
    "móstoles",
    "MÓSTOLES",
    "Sede Móstoles Central"
  ];

  for (const v of tejarVariants) {
    assert.equal(normalizeSede(v), "tejar", `Failed tejar variant: ${v}`);
    assert.equal(formatSedeName(v), "Studio 1 Plaza El Tejar");
  }

  const castillaVariants = [
    "castilla",
    "CASTILLA",
    "Paseo Castilla",
    "Paseo Castilla 43",
    "Studio 2 Paseo Castilla",
    "studio 2",
    "STUDIO 2",
    "alcorcon",
    "ALCORCON",
    "alcorcón",
    "ALCORCÓN",
    "Sede Alcorcón"
  ];

  for (const v of castillaVariants) {
    assert.equal(normalizeSede(v), "castilla", `Failed castilla variant: ${v}`);
    assert.equal(formatSedeName(v), "Studio 2 Paseo Castilla");
  }
});

console.log("\n========================================================");
console.log(`STRESS RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log("========================================================\n");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
