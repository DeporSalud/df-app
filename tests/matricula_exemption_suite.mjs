// ============================================================================
// DANCE FACTORY: MATRÍCULA EXEMPTION OFFICIAL VERIFICATION SUITE (STUDENT-APP)
// ============================================================================

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const matriculaService = await import(path.join(rootDir, "src/lib/matriculaService.ts"));
const { 
  calculateBonoPriceAndMatricula, 
  isRegularClassStudent, 
  isTeacherProfile, 
  hasPaidSeasonMatricula 
} = matriculaService;

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    testsFailed++;
  }
}

console.log("================================================================================");
console.log("⚡ STARTING STUDENT-APP MATRÍCULA EXEMPTION VERIFICATION SUITE");
console.log("================================================================================\n");

test("[R1] Alumno regular: Bono 4 (45€), Bono 8 (57€), Bono 10 (79€), Pase Ilimitado (100€) con 0€ matrícula", () => {
  const student = { id: "s1", plan_activo: "Clases Regulares", matricula_pagada: false };
  
  const bonos = [
    { id: "Bono 4 clases", price: 45 },
    { id: "Bono 8 clases", price: 57 },
    { id: "Bono 10 clases", price: 79 },
    { id: "Mensualidad Ilimitada", price: 100 }
  ];

  for (const b of bonos) {
    const calc = calculateBonoPriceAndMatricula({
      bonoId: b.id,
      basePrice: b.price,
      student
    });
    assert.strictEqual(calc.bonoPrice, b.price);
    assert.strictEqual(calc.matriculaCost, 0.00);
    assert.strictEqual(calc.isExempt, true);
    assert.strictEqual(calc.exemptionLabel, "0,00€ (Exenta por ser alumno de Clases Regulares)");
    assert.strictEqual(calc.totalToPay, b.price);
  }
});

test("[R2] Profesor: Bonos con 10% dto y 0€ matrícula", () => {
  const calc4 = calculateBonoPriceAndMatricula({
    bonoId: "Bono 4 clases",
    basePrice: 45,
    userRole: "profesor"
  });
  assert.strictEqual(calc4.bonoPrice, 40.50);
  assert.strictEqual(calc4.matriculaCost, 0.00);
  assert.strictEqual(calc4.totalToPay, 40.50);

  const calc8 = calculateBonoPriceAndMatricula({
    bonoId: "Bono 8 clases",
    basePrice: 57,
    userRole: "profesor"
  });
  assert.strictEqual(calc8.bonoPrice, 51.30);
  assert.strictEqual(calc8.matriculaCost, 0.00);
  assert.strictEqual(calc8.totalToPay, 51.30);
});

test("[R3.1] Alumno Open Class nuevo: primer bono abona precio bono + 15,00€ matrícula anual", () => {
  const newStudent = { id: "new_oc", plan_activo: "Sin Plan Activo", clases_restantes: 0, matricula_pagada: false };
  const calc = calculateBonoPriceAndMatricula({
    bonoId: "Bono 4 clases",
    basePrice: 45,
    student: newStudent
  });
  assert.strictEqual(calc.bonoPrice, 45.00);
  assert.strictEqual(calc.matriculaCost, 15.00);
  assert.strictEqual(calc.totalToPay, 60.00);
  assert.strictEqual(calc.isFirstBonoOfYear, true);
});

test("[R3.2] Alumno Open Class 2ª compra: cargo de matrícula es de 0,00€", () => {
  const repeatStudent = { id: "rep_oc", plan_activo: "Bono 4 Clases", clases_restantes: 0, matricula_pagada: true };
  const calc = calculateBonoPriceAndMatricula({
    bonoId: "Bono 4 clases",
    basePrice: 45,
    student: repeatStudent
  });
  assert.strictEqual(calc.bonoPrice, 45.00);
  assert.strictEqual(calc.matriculaCost, 0.00);
  assert.strictEqual(calc.totalToPay, 45.00);
  assert.strictEqual(calc.isFirstBonoOfYear, false);
});

test("[R1.Edge] Alumno regular con cuota_mensual de texto ('30 €') o estilo danza ('K-Pop Juvenil')", () => {
  assert.strictEqual(isRegularClassStudent({ cuota_mensual: "30 €" }), true);
  assert.strictEqual(isRegularClassStudent({ plan_activo: "K-Pop Juvenil" }), true);
  assert.strictEqual(isRegularClassStudent({ clase_o_clases: "URBAN KIDS LyX 18:00" }), true);
});

test("[R2.Edge] Profesor con rol 'docente' o es_docente: true", () => {
  assert.strictEqual(isTeacherProfile({ rol: "docente" }), true);
  assert.strictEqual(isTeacherProfile({ es_docente: true }), true);
  assert.strictEqual(isTeacherProfile(undefined, undefined, "docente"), true);
});

test("[UI.Math] Desglose sin doble descuento: basePrice - discountAmount + matriculaCost === totalToPay", () => {
  const calc = calculateBonoPriceAndMatricula({
    bonoId: "Bono 4 clases",
    basePrice: 45,
    userRole: "profesor"
  });
  assert.strictEqual(calc.basePrice, 45.00);
  assert.strictEqual(calc.discountAmount, 4.50);
  assert.strictEqual(calc.matriculaCost, 0.00);
  assert.strictEqual(calc.totalToPay, 40.50);
  assert.strictEqual(calc.basePrice - calc.discountAmount + calc.matriculaCost, calc.totalToPay);
});

test("[R3.3] Alumno con plan_activo 'Open Class' y sin bono previo debe abonar la matrícula de 15€", () => {
  const ocStudent = { id: "oc_with_plan", plan_activo: "Open Class", clases_restantes: 0, matricula_pagada: false };
  const calc = calculateBonoPriceAndMatricula({
    bonoId: "Bono 4 clases",
    basePrice: 45,
    student: ocStudent
  });
  assert.strictEqual(calc.bonoPrice, 45.00);
  assert.strictEqual(calc.matriculaCost, 15.00);
  assert.strictEqual(calc.totalToPay, 60.00);
  assert.strictEqual(calc.isFirstBonoOfYear, true);
});

test("[R1.Edge2] clase_o_clases 'Ninguna' no otorga condición de alumno regular", () => {
  assert.strictEqual(isRegularClassStudent({ clase_o_clases: "Ninguna" }), false);
  assert.strictEqual(isRegularClassStudent({ clase_o_clases: "Sin asignar" }), false);
  assert.strictEqual(isRegularClassStudent({ cuota_mensual: "35,00 €" }), true);
});

test("[R3.4] Pase Mensual Ilimitado y Clase Suelta exentos de matrícula en 2ª compra", () => {
  const sPase = { id: "s_pase", plan_activo: "Pase Mensual Ilimitado", clases_restantes: 0 };
  assert.strictEqual(hasPaidSeasonMatricula(sPase), true);
  const calcPase = calculateBonoPriceAndMatricula({ bonoId: "Bono 4 clases", basePrice: 45, student: sPase });
  assert.strictEqual(calcPase.matriculaCost, 0.00);
  assert.strictEqual(calcPase.isExempt, true);

  const sSuelta = { id: "s_suelta", plan_activo: "Clase Suelta Open Class", clases_restantes: 0 };
  assert.strictEqual(hasPaidSeasonMatricula(sSuelta), true);
  const calcSuelta = calculateBonoPriceAndMatricula({ bonoId: "Bono 8 clases", basePrice: 57, student: sSuelta });
  assert.strictEqual(calcSuelta.matriculaCost, 0.00);
  assert.strictEqual(calcSuelta.isExempt, true);
});

test("[R1.Edge3] assignedClassIds vacíos o nulos no otorgan condición de alumno regular", () => {
  assert.strictEqual(isRegularClassStudent({ id: "s_assign" }, { assignedClassIds: ["", "  "] }), false);
  assert.strictEqual(isTeacherProfile(undefined, undefined, "PROFESOR"), true);
});

console.log("\n================================================================================");
console.log(`📊 STUDENT-APP VERIFICATION: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("================================================================================\n");

if (testsFailed > 0) process.exit(1);
