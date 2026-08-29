// Dance Factory Student-App Challenger 2 Empirical Test Suite
// Run with: node student-app/tests/challenger_2_suite.mjs

import assert from "node:assert/strict";

// ============================================================================
// ENVIRONMENT & MOCK SETUP
// ============================================================================
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = String(value); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => {
    for (const k in localStorageStore) delete localStorageStore[k];
  },
  _dump: () => ({ ...localStorageStore })
};

globalThis.localStorage = localStorageMock;

const dispatchedEvents = [];
globalThis.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event.type);
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// ============================================================================
// LOGIC EXTRACTIONS UNDER TEST
// ============================================================================

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

// Student app bono rates
const bonosTarifas = [
  { 
    id: "Bono 4 clases", 
    nombre: "Bono 4 Clases", 
    precio: "45 €", 
    desc: "4 clases • Validez 30 días naturales • Acceso exclusivo a OPEN CLASS" 
  },
  { 
    id: "Bono 8 clases", 
    nombre: "Bono 8 Clases", 
    precio: "57 €", 
    desc: "8 clases (Recomendado) • Validez 30 días naturales • Acceso exclusivo a OPEN CLASS" 
  },
  { 
    id: "Bono 10 clases", 
    nombre: "Bono 10 Clases", 
    precio: "79 €", 
    desc: "10 clases • Validez 30 días naturales • Acceso exclusivo a OPEN CLASS" 
  },
  { 
    id: "Mensualidad Ilimitada", 
    nombre: "Pase Ilimitado Open Class", 
    precio: "100 € / mes", 
    desc: "Tarifa plana mensual • Acceso ilimitado a todas las OPEN CLASS de la escuela" 
  },
  { 
    id: "Clase Suelta", 
    nombre: "Clase Suelta Open Class", 
    precio: "15 €", 
    desc: "1 sesión puntual • Acceso a 1 sesión de OPEN CLASS" 
  }
];

// Calculation formula from student-app/src/app/clases/page.tsx
function calculateBonoFee(bono, currentStudent) {
  const basePrice = parseFloat(bono.precio.replace(/[^0-9.]/g, "")) || 45;
  const isFirstBonoOfYear = !currentStudent?.matricula_pagada;
  const matriculaCost = isFirstBonoOfYear ? 15.00 : 0.00;
  const totalAmount = basePrice + matriculaCost;

  return {
    basePrice,
    isFirstBonoOfYear,
    matriculaCost,
    totalAmount
  };
}

// Student App logic for "Abonar en Recepción"
function requestBonoEnRecepcion(selectedBono, currentStudent) {
  const { basePrice, isFirstBonoOfYear, matriculaCost, totalAmount } = calculateBonoFee(selectedBono, currentStudent);
  
  const rawReqs = localStorage.getItem("pending_bono_requests");
  const reqs = rawReqs ? JSON.parse(rawReqs) : [];
  const newReq = {
    id: "req_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    student_id: currentStudent.id,
    student_name: currentStudent.nombre_completo,
    student_email: currentStudent.email || "",
    bono_nombre: isFirstBonoOfYear 
      ? `${selectedBono.nombre} (+15€ Matrícula)` 
      : selectedBono.nombre,
    bono_precio: `${totalAmount.toFixed(2)} €`,
    fecha: new Date().toLocaleDateString("es-ES"),
    sede: normalizeSede(currentStudent.sede || "tejar")
  };
  localStorage.setItem("pending_bono_requests", JSON.stringify([newReq, ...reqs]));
  window.dispatchEvent({ type: "df_pending_bonos_updated" });

  return newReq;
}

// CRM App logic for processing pending bono requests
function crmProcessPendingBono(req, studentDB, activeSede = "tejar") {
  let clasesToAdd = 4;
  if (req.bono_nombre.includes("8")) clasesToAdd = 8;
  else if (req.bono_nombre.includes("10")) clasesToAdd = 10;
  else if (req.bono_nombre.toLowerCase().includes("ilimitad")) clasesToAdd = 999;
  else if (req.bono_nombre.toLowerCase().includes("suelta")) clasesToAdd = 1;

  // Amount parsing from CRM (crm-app/src/app/admin/page.tsx:397-411)
  let importeNum = 45;
  if (req.bono_precio && typeof req.bono_precio === "string") {
    const cleaned = req.bono_precio.replace(/[^\d.,]/g, '').replace(',', '.');
    if (cleaned && !isNaN(parseFloat(cleaned))) {
      importeNum = parseFloat(cleaned);
    } else {
      const nameLower = (req.bono_nombre || "").toLowerCase();
      if (nameLower.includes("suelta") || nameLower.includes("1 clase")) importeNum = 15;
      else if (nameLower.includes("4")) importeNum = 45;
      else if (nameLower.includes("8")) importeNum = 75;
      else if (nameLower.includes("10")) importeNum = 79;
      else if (nameLower.includes("ilimitad")) importeNum = 95;
      else importeNum = 45;
    }
  }

  // Remove from pending_bono_requests in localStorage
  const rawReqs = localStorage.getItem("pending_bono_requests");
  const storedReqs = rawReqs ? JSON.parse(rawReqs) : [];
  const updatedReqs = storedReqs.filter(r => r.id !== req.id && r.student_id !== req.student_id);
  localStorage.setItem("pending_bono_requests", JSON.stringify(updatedReqs));

  const updatedStudent = {
    ...studentDB,
    plan_activo: req.bono_nombre,
    clases_restantes: (typeof studentDB.clases_restantes === "number" ? studentDB.clases_restantes : 0) + clasesToAdd,
    matricula_pagada: true
  };

  const paymentRecord = {
    alumno_id: studentDB.id,
    alumno_nombre: req.student_name,
    concepto: `Bono: ${req.bono_nombre} (Adquisición Mostrador)`,
    categoria: "bono",
    importe: importeNum,
    metodo_pago: "Efectivo",
    sede: activeSede === "castilla" ? "castilla" : "tejar"
  };

  return {
    clasesToAdd,
    importeNum,
    updatedStudent,
    paymentRecord,
    remainingPendingCount: updatedReqs.length
  };
}

// Registration validation functions
function validateSpanishPhone(rawPhone) {
  const cleanPhone = (rawPhone || "").replace(/[\s\-\.]/g, "");
  const phoneRegex = /^(\+34|0034)?[6789]\d{8}$/;
  return {
    isValid: phoneRegex.test(cleanPhone),
    cleanPhone
  };
}

function validateSpanishDniNie(rawDni) {
  const cleanDni = (rawDni || "").trim().toUpperCase();
  const dniNieRegex = /^(\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/;
  return {
    isValid: dniNieRegex.test(cleanDni),
    cleanDni
  };
}

// ============================================================================
// TEST RUNNER
// ============================================================================
const testResults = [];
let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    testResults.push({ desc, status: "PASS" });
    passCount++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    testResults.push({ desc, status: "FAIL", error: err.message, stack: err.stack });
    failCount++;
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log("\n================================================================================");
console.log("CHALLENGER 2: EMPIRICAL STRESS & CROSS-APP AUDIT TEST SUITE");
console.log("================================================================================\n");

// ============================================================================
// TASK 1: 15€ ANNUAL ENROLLMENT FEE CALCULATION EMPIRICAL TESTS
// ============================================================================
console.log("--- Task 1: 15€ Annual Enrollment Fee Calculation Across All 5 Bono Products ---");

it("1.1 Bono 4 Clases: 45€ base -> 60€ with first purchase vs 45€ subsequent", () => {
  const bono = bonosTarifas.find(b => b.id === "Bono 4 clases");
  assert.ok(bono, "Bono 4 must exist");

  // First purchase (matricula_pagada: false)
  const studentNew = { id: "st_1", matricula_pagada: false };
  const calcNew = calculateBonoFee(bono, studentNew);
  assert.equal(calcNew.basePrice, 45.00);
  assert.equal(calcNew.isFirstBonoOfYear, true);
  assert.equal(calcNew.matriculaCost, 15.00);
  assert.equal(calcNew.totalAmount, 60.00, "First purchase total must be 60.00€");

  // Subsequent purchase (matricula_pagada: true)
  const studentPaid = { id: "st_1", matricula_pagada: true };
  const calcPaid = calculateBonoFee(bono, studentPaid);
  assert.equal(calcPaid.basePrice, 45.00);
  assert.equal(calcPaid.isFirstBonoOfYear, false);
  assert.equal(calcPaid.matriculaCost, 0.00);
  assert.equal(calcPaid.totalAmount, 45.00, "Subsequent purchase total must be 45.00€");
});

it("1.2 Bono 8 Clases: 57€ base -> 72€ with first purchase vs 57€ subsequent", () => {
  const bono = bonosTarifas.find(b => b.id === "Bono 8 clases");
  assert.ok(bono, "Bono 8 must exist");

  // First purchase
  const studentNew = { id: "st_2", matricula_pagada: false };
  const calcNew = calculateBonoFee(bono, studentNew);
  assert.equal(calcNew.basePrice, 57.00);
  assert.equal(calcNew.matriculaCost, 15.00);
  assert.equal(calcNew.totalAmount, 72.00, "First purchase total must be 72.00€");

  // Subsequent purchase
  const studentPaid = { id: "st_2", matricula_pagada: true };
  const calcPaid = calculateBonoFee(bono, studentPaid);
  assert.equal(calcPaid.basePrice, 57.00);
  assert.equal(calcPaid.matriculaCost, 0.00);
  assert.equal(calcPaid.totalAmount, 57.00, "Subsequent purchase total must be 57.00€");
});

it("1.3 Bono 10 Clases: 79€ base -> 94€ with first purchase vs 79€ subsequent", () => {
  const bono = bonosTarifas.find(b => b.id === "Bono 10 clases");
  assert.ok(bono, "Bono 10 must exist");

  // First purchase
  const studentNew = { id: "st_3", matricula_pagada: false };
  const calcNew = calculateBonoFee(bono, studentNew);
  assert.equal(calcNew.basePrice, 79.00);
  assert.equal(calcNew.matriculaCost, 15.00);
  assert.equal(calcNew.totalAmount, 94.00, "First purchase total must be 94.00€");

  // Subsequent purchase
  const studentPaid = { id: "st_3", matricula_pagada: true };
  const calcPaid = calculateBonoFee(bono, studentPaid);
  assert.equal(calcPaid.basePrice, 79.00);
  assert.equal(calcPaid.matriculaCost, 0.00);
  assert.equal(calcPaid.totalAmount, 79.00, "Subsequent purchase total must be 79.00€");
});

it("1.4 Pase Ilimitado Open Class: 100€ base -> 115€ with first purchase vs 100€ subsequent", () => {
  const bono = bonosTarifas.find(b => b.id === "Mensualidad Ilimitada");
  assert.ok(bono, "Pase Ilimitado must exist");

  // First purchase
  const studentNew = { id: "st_4", matricula_pagada: false };
  const calcNew = calculateBonoFee(bono, studentNew);
  assert.equal(calcNew.basePrice, 100.00, "Parsed from '100 € / mes'");
  assert.equal(calcNew.matriculaCost, 15.00);
  assert.equal(calcNew.totalAmount, 115.00, "First purchase total must be 115.00€");

  // Subsequent purchase
  const studentPaid = { id: "st_4", matricula_pagada: true };
  const calcPaid = calculateBonoFee(bono, studentPaid);
  assert.equal(calcPaid.basePrice, 100.00);
  assert.equal(calcPaid.matriculaCost, 0.00);
  assert.equal(calcPaid.totalAmount, 100.00, "Subsequent purchase total must be 100.00€");
});

it("1.5 Clase Suelta Open Class: 15€ base -> 30€ with first purchase vs 15€ subsequent", () => {
  const bono = bonosTarifas.find(b => b.id === "Clase Suelta");
  assert.ok(bono, "Clase Suelta must exist");

  // First purchase
  const studentNew = { id: "st_5", matricula_pagada: false };
  const calcNew = calculateBonoFee(bono, studentNew);
  assert.equal(calcNew.basePrice, 15.00);
  assert.equal(calcNew.matriculaCost, 15.00);
  assert.equal(calcNew.totalAmount, 30.00, "First purchase total must be 30.00€");

  // Subsequent purchase
  const studentPaid = { id: "st_5", matricula_pagada: true };
  const calcPaid = calculateBonoFee(bono, studentPaid);
  assert.equal(calcPaid.basePrice, 15.00);
  assert.equal(calcPaid.matriculaCost, 0.00);
  assert.equal(calcPaid.totalAmount, 15.00, "Subsequent purchase total must be 15.00€");
});

it("1.6 Edge Cases: undefined, null, or missing matricula_pagada treats student as new (+15€)", () => {
  const bono = bonosTarifas[0];
  assert.equal(calculateBonoFee(bono, null).totalAmount, 60.00);
  assert.equal(calculateBonoFee(bono, {}).totalAmount, 60.00);
  assert.equal(calculateBonoFee(bono, { matricula_pagada: undefined }).totalAmount, 60.00);
  assert.equal(calculateBonoFee(bono, { matricula_pagada: null }).totalAmount, 60.00);
  assert.equal(calculateBonoFee(bono, { matricula_pagada: 0 }).totalAmount, 60.00);
});

// ============================================================================
// TASK 2: "ABONAR EN RECEPCIÓN" SYNC & CROSS-APP CONTRACT VERIFICATION
// ============================================================================
console.log("\n--- Task 2: 'Abonar en Recepción' Payload Sync & CRM Schema Compatibility ---");

it("2.1 Student App writes exact contract payload to pending_bono_requests", () => {
  localStorage.clear();
  dispatchedEvents.length = 0;

  const student = {
    id: "student_carlos_01",
    nombre_completo: "Carlos Ruiz García",
    email: "carlos.ruiz@test.com",
    sede: "tejar",
    matricula_pagada: false,
    clases_restantes: 0
  };
  const bono = bonosTarifas.find(b => b.id === "Bono 8 clases");

  const req = requestBonoEnRecepcion(bono, student);

  // Validate properties
  assert.ok(req.id.startsWith("req_"), "ID must have req_ prefix");
  assert.equal(req.student_id, "student_carlos_01");
  assert.equal(req.student_name, "Carlos Ruiz García");
  assert.equal(req.student_email, "carlos.ruiz@test.com");
  assert.equal(req.bono_nombre, "Bono 8 Clases (+15€ Matrícula)");
  assert.equal(req.bono_precio, "72.00 €");
  assert.ok(req.fecha.length > 0, "Fecha must be present");
  assert.equal(req.sede, "tejar");

  // Validate localStorage state
  const rawInStorage = localStorage.getItem("pending_bono_requests");
  assert.ok(rawInStorage, "Must be written to pending_bono_requests");
  const parsed = JSON.parse(rawInStorage);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], req);

  // Validate custom event dispatch
  assert.ok(dispatchedEvents.includes("df_pending_bonos_updated"), "Must dispatch df_pending_bonos_updated");
});

it("2.2 CRM successfully parses pending request and executes payment registration & student activation", () => {
  const studentDB = {
    id: "student_carlos_01",
    nombre_completo: "Carlos Ruiz García",
    email: "carlos.ruiz@test.com",
    dni: "50894721K",
    telefono: "695674305",
    sede: "tejar",
    clases_restantes: 0,
    matricula_pagada: false
  };

  const storedReq = JSON.parse(localStorage.getItem("pending_bono_requests"))[0];
  assert.ok(storedReq);

  const crmResult = crmProcessPendingBono(storedReq, studentDB, "tejar");

  // 1. Classes added
  assert.equal(crmResult.clasesToAdd, 8, "Bono 8 must add 8 classes");
  assert.equal(crmResult.updatedStudent.clases_restantes, 8, "Balance must become 0 + 8 = 8");
  assert.equal(crmResult.updatedStudent.plan_activo, "Bono 8 Clases (+15€ Matrícula)");

  // 2. Amount parsed by CRM financial ledger
  assert.equal(crmResult.importeNum, 72.00, "CRM must parse '72.00 €' as 72.00 numeric");
  assert.equal(crmResult.paymentRecord.importe, 72.00);
  assert.equal(crmResult.paymentRecord.metodo_pago, "Efectivo");

  // 3. Removed from pending queue
  assert.equal(crmResult.remainingPendingCount, 0);
  const remainingInStorage = JSON.parse(localStorage.getItem("pending_bono_requests"));
  assert.equal(remainingInStorage.length, 0);
});

it("2.3 Stress Test: All 5 Bonos in Reception Request -> CRM Processing Cycle", () => {
  localStorage.clear();

  const testCases = [
    { bonoId: "Bono 4 clases", isFirst: false, expectedPrice: "45.00 €", expectedNumeric: 45.00, expectedClasses: 4 },
    { bonoId: "Bono 4 clases", isFirst: true, expectedPrice: "60.00 €", expectedNumeric: 60.00, expectedClasses: 4 },
    { bonoId: "Bono 8 clases", isFirst: false, expectedPrice: "57.00 €", expectedNumeric: 57.00, expectedClasses: 8 },
    { bonoId: "Bono 8 clases", isFirst: true, expectedPrice: "72.00 €", expectedNumeric: 72.00, expectedClasses: 8 },
    { bonoId: "Bono 10 clases", isFirst: false, expectedPrice: "79.00 €", expectedNumeric: 79.00, expectedClasses: 10 },
    { bonoId: "Bono 10 clases", isFirst: true, expectedPrice: "94.00 €", expectedNumeric: 94.00, expectedClasses: 10 },
    { bonoId: "Mensualidad Ilimitada", isFirst: false, expectedPrice: "100.00 €", expectedNumeric: 100.00, expectedClasses: 999 },
    { bonoId: "Mensualidad Ilimitada", isFirst: true, expectedPrice: "115.00 €", expectedNumeric: 115.00, expectedClasses: 999 },
    { bonoId: "Clase Suelta", isFirst: false, expectedPrice: "15.00 €", expectedNumeric: 15.00, expectedClasses: 1 },
    { bonoId: "Clase Suelta", isFirst: true, expectedPrice: "30.00 €", expectedNumeric: 30.00, expectedClasses: 1 }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const bono = bonosTarifas.find(b => b.id === tc.bonoId);
    const student = {
      id: `student_stress_${i}`,
      nombre_completo: `Student ${i}`,
      email: `student${i}@dancefactory.es`,
      matricula_pagada: !tc.isFirst,
      clases_restantes: 2
    };

    const req = requestBonoEnRecepcion(bono, student);
    assert.equal(req.bono_precio, tc.expectedPrice, `Price for ${tc.bonoId} (isFirst: ${tc.isFirst})`);

    const crmRes = crmProcessPendingBono(req, student);
    assert.equal(crmRes.clasesToAdd, tc.expectedClasses, `Classes added for ${tc.bonoId}`);
    assert.equal(crmRes.importeNum, tc.expectedNumeric, `CRM numeric amount for ${tc.bonoId}`);
  }
});

// ============================================================================
// TASK 3: SPANISH PHONE VALIDATION REGEX EMPIRICAL STRESS TESTS
// ============================================================================
console.log("\n--- Task 3: Spanish Phone Validation Regex Empirical Tests ---");

it("3.1 Mandatory valid numbers from user request", () => {
  assert.equal(validateSpanishPhone("+34612345678").isValid, true, "+34612345678 must be VALID");
  assert.equal(validateSpanishPhone("695674305").isValid, true, "695674305 must be VALID");
  assert.equal(validateSpanishPhone("712345678").isValid, true, "712345678 must be VALID");
  assert.equal(validateSpanishPhone("912345678").isValid, true, "912345678 must be VALID");
});

it("3.2 Mandatory invalid numbers from user request", () => {
  assert.equal(validateSpanishPhone("12345").isValid, false, "12345 must be INVALID (short)");
  assert.equal(validateSpanishPhone("abcdef").isValid, false, "abcdef must be INVALID (letters)");
  assert.equal(validateSpanishPhone("+123456789").isValid, false, "+123456789 must be INVALID (non-Spanish prefix)");
});

it("3.3 Formats with spaces, hyphens, dots, and 0034 prefix", () => {
  assert.equal(validateSpanishPhone("+34 695 67 43 05").isValid, true);
  assert.equal(validateSpanishPhone("695-67-43-05").isValid, true);
  assert.equal(validateSpanishPhone("695.67.43.05").isValid, true);
  assert.equal(validateSpanishPhone("0034695674305").isValid, true);
  assert.equal(validateSpanishPhone("0034 695 67 43 05").isValid, true);
  assert.equal(validateSpanishPhone("+34 91 234 56 78").isValid, true);
});

it("3.4 Boundary & Fuzzing Phone Edge Cases", () => {
  // Too short
  assert.equal(validateSpanishPhone("61234567").isValid, false, "8 digits is invalid");
  assert.equal(validateSpanishPhone("").isValid, false, "empty is invalid");
  
  // Too long
  assert.equal(validateSpanishPhone("6123456789").isValid, false, "10 digits is invalid");
  assert.equal(validateSpanishPhone("+346123456789").isValid, false, "+34 with 10 digits is invalid");

  // Invalid initial digits (1, 2, 3, 4, 5)
  assert.equal(validateSpanishPhone("112345678").isValid, false, "Starts with 1");
  assert.equal(validateSpanishPhone("212345678").isValid, false, "Starts with 2");
  assert.equal(validateSpanishPhone("312345678").isValid, false, "Starts with 3");
  assert.equal(validateSpanishPhone("412345678").isValid, false, "Starts with 4");
  assert.equal(validateSpanishPhone("512345678").isValid, false, "Starts with 5");

  // Valid initial digits (6, 7, 8, 9)
  assert.equal(validateSpanishPhone("600000000").isValid, true, "Starts with 6");
  assert.equal(validateSpanishPhone("700000000").isValid, true, "Starts with 7");
  assert.equal(validateSpanishPhone("800000000").isValid, true, "Starts with 8");
  assert.equal(validateSpanishPhone("900000000").isValid, true, "Starts with 9");

  // Injection / malformed characters
  assert.equal(validateSpanishPhone("+34612345678<script>").isValid, false);
  assert.equal(validateSpanishPhone("612345678a").isValid, false, "Trailing letter");
  assert.equal(validateSpanishPhone("612345678#").isValid, false, "Special character #");
  assert.equal(validateSpanishPhone("612345678\n").isValid, true, "Trailing newline is safely stripped by \\s whitespace cleaner");
});

// ============================================================================
// TASK 4: DNI / NIE VALIDATION REGEX EMPIRICAL STRESS TESTS
// ============================================================================
console.log("\n--- Task 4: DNI / NIE Validation Regex Empirical Tests ---");

it("4.1 Mandatory valid DNI/NIE from user request", () => {
  assert.equal(validateSpanishDniNie("12345678Z").isValid, true, "12345678Z must be VALID DNI");
  assert.equal(validateSpanishDniNie("Y1234567A").isValid, true, "Y1234567A must be VALID NIE");
});

it("4.2 Mandatory invalid DNI/NIE from user request", () => {
  assert.equal(validateSpanishDniNie("123").isValid, false, "123 must be INVALID");
  assert.equal(validateSpanishDniNie("ABCD").isValid, false, "ABCD must be INVALID");
});

it("4.3 Comprehensive DNI and NIE Formats (X, Y, Z prefixes)", () => {
  // Valid DNI formats (8 digits + 1 uppercase letter)
  assert.equal(validateSpanishDniNie("50894721K").isValid, true, "Valid DNI 50894721K");
  assert.equal(validateSpanishDniNie("00000000T").isValid, true, "Valid DNI 00000000T");
  assert.equal(validateSpanishDniNie("99999999R").isValid, true, "Valid DNI 99999999R");

  // Valid NIE formats (X/Y/Z + 7 digits + 1 uppercase letter)
  assert.equal(validateSpanishDniNie("X1234567L").isValid, true, "Valid NIE X1234567L");
  assert.equal(validateSpanishDniNie("Y7654321M").isValid, true, "Valid NIE Y7654321M");
  assert.equal(validateSpanishDniNie("Z9999999P").isValid, true, "Valid NIE Z9999999P");

  // Auto-uppercase normalization in input handler
  assert.equal(validateSpanishDniNie("12345678z").cleanDni, "12345678Z");
  assert.equal(validateSpanishDniNie("12345678z").isValid, true);
  assert.equal(validateSpanishDniNie("y1234567a").cleanDni, "Y1234567A");
  assert.equal(validateSpanishDniNie("y1234567a").isValid, true);
});

it("4.4 Boundary & Malformed DNI/NIE Stress Cases", () => {
  // Length issues
  assert.equal(validateSpanishDniNie("1234567Z").isValid, false, "7 digits DNI is invalid");
  assert.equal(validateSpanishDniNie("123456789Z").isValid, false, "9 digits DNI is invalid");
  assert.equal(validateSpanishDniNie("X123456L").isValid, false, "6 digits NIE is invalid");
  assert.equal(validateSpanishDniNie("X12345678L").isValid, false, "8 digits NIE is invalid");

  // Missing letter
  assert.equal(validateSpanishDniNie("12345678").isValid, false, "DNI without letter is invalid");
  assert.equal(validateSpanishDniNie("X1234567").isValid, false, "NIE without letter is invalid");

  // Invalid NIE prefixes (A, B, C, K, W, etc.)
  assert.equal(validateSpanishDniNie("A1234567L").isValid, false, "A-prefix is invalid (CIF)");
  assert.equal(validateSpanishDniNie("B1234567L").isValid, false, "B-prefix is invalid");
  assert.equal(validateSpanishDniNie("W1234567L").isValid, false, "W-prefix is invalid");
  assert.equal(validateSpanishDniNie("K1234567L").isValid, false, "K-prefix is invalid");

  // Empty and special characters
  assert.equal(validateSpanishDniNie("").isValid, false);
  assert.equal(validateSpanishDniNie("12345678-Z").isValid, false, "With hyphen is invalid for pure DNI field");
  assert.equal(validateSpanishDniNie(" 12345678Z ").isValid, true, "Untrimmed space is handled by .trim()");
});

// ============================================================================
// FINAL REPORT
// ============================================================================
console.log("\n================================================================================");
console.log(`ALL CHALLENGER 2 TESTS COMPLETED: ${passCount} PASSED, ${failCount} FAILED`);
console.log("================================================================================\n");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
