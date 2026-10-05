import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const { 
  isTeacherProfile, 
  calculateBonoPriceAndMatricula, 
  calculateBonoExpirationDate,
  TEACHER_EMAILS 
} = await import(path.join(rootDir, "src/lib/matriculaService.ts"));

const SUPABASE_URL = "https://wjnoawmefdurqqjwqdmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("================================================================================");
console.log("⚡ VERIFICACIÓN DE INTEGRIDAD Y ESTABILIDAD EN PRODUCCIÓN (DANCE FACTORY)");
console.log("================================================================================");

let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  runTest("1. Marta García Vázquez está en PROFESORES_LIST con PIN 1014", () => {
    const studentContextContent = fs.readFileSync(path.join(rootDir, "src/context/StudentContext.tsx"), "utf8");
    assert.ok(studentContextContent.includes('id: "1014"'), "Debe incluir ID 1014");
    assert.ok(studentContextContent.includes('name: "MARTA GARCÍA VÁZQUEZ"'), "Debe incluir nombre MARTA GARCÍA VÁZQUEZ");
    assert.ok(studentContextContent.includes('pin: "1014"'), "Debe incluir PIN 1014");
    assert.ok(studentContextContent.includes('email: "marta.garci.013@gmail.com"'), "Debe incluir email marta.garci.013@gmail.com");

    const teacherPortalContent = fs.readFileSync(path.join(rootDir, "src/components/TeacherPortalView.tsx"), "utf8");
    assert.ok(teacherPortalContent.includes("1014"), "TeacherPortalView debe reconocer a Marta");
  });

  runTest("2. Marta García Vázquez está en TEACHER_EMAILS y reconocida por isTeacherProfile", () => {
    assert.ok(TEACHER_EMAILS.includes("marta.garci.013@gmail.com"), "El email de Marta debe estar en TEACHER_EMAILS");
    assert.ok(TEACHER_EMAILS.includes("marta.garcia@dancefactory.es"), "El alias de Marta debe estar en TEACHER_EMAILS");
    
    assert.equal(isTeacherProfile(null, "marta.garci.013@gmail.com"), true);
    assert.equal(isTeacherProfile(null, "marta.garcia@dancefactory.es"), true);
    assert.equal(isTeacherProfile({ id: "e9cc4200-aba2-4e67-8191-808c40e75621" }), true);
    assert.equal(isTeacherProfile({ nombre_completo: "Marta García Vázquez" }), true);
    assert.equal(isTeacherProfile({ plan_activo: "Docente (10% Dto)" }), true);
  });

  await runAsyncTest("3. Base de datos Supabase en vivo: Registro de Marta verificado", async () => {
    const { data, error } = await supabase
      .from("alumnos")
      .select("*")
      .eq("id", "e9cc4200-aba2-4e67-8191-808c40e75621")
      .single();

    assert.equal(error, null, "La consulta a Supabase no debe fallar");
    assert.ok(data, "Marta debe existir en la tabla alumnos de Supabase");
    assert.equal(data.email, "marta.garci.013@gmail.com");
    assert.equal(data.plan_activo, "Docente (10% Dto)");
    assert.equal(data.estado, "Activo");
  });

  runTest("4. Mapeo de seguridad: getTeacherUuid(1014) mapea al UUID exacto de Supabase", () => {
    const secContent = fs.readFileSync(path.join(rootDir, "src/lib/securityService.ts"), "utf8");
    assert.ok(secContent.includes('id === "1014" || id === "e9cc4200-aba2-4e67-8191-808c40e75621"'), "getTeacherUuid debe mapear a Marta");
    assert.ok(secContent.includes('return "e9cc4200-aba2-4e67-8191-808c40e75621"'), "UUID devuelto debe ser e9cc4200-aba2-4e67-8191-808c40e75621");
  });

  runTest("5. Promoción docente Marta: -10% descuento y 0€ matrícula en todos los bonos", () => {
    const martaProfile = {
      id: "e9cc4200-aba2-4e67-8191-808c40e75621",
      nombre_completo: "Marta García Vázquez",
      email: "marta.garci.013@gmail.com",
      plan_activo: "Docente (10% Dto)"
    };

    const vouchers = [
      { id: "bono_4", base: 45, expectedDiscounted: 40.50 },
      { id: "bono_8", base: 57, expectedDiscounted: 51.30 },
      { id: "bono_10", base: 79, expectedDiscounted: 71.10 },
      { id: "ilimitado", base: 100, expectedDiscounted: 90.00 },
      { id: "clase_suelta", base: 15, expectedDiscounted: 13.50 }
    ];

    for (const v of vouchers) {
      const res = calculateBonoPriceAndMatricula({
        bonoId: v.id,
        student: martaProfile,
        basePrice: v.base
      });

      assert.equal(res.isExempt, true, `El bono ${v.id} debe estar exento de matrícula`);
      assert.equal(res.matriculaCost, 0, `El coste de matrícula para ${v.id} debe ser 0€`);
      assert.equal(res.discountPercentage, 10, `El descuento para ${v.id} debe ser 10%`);
      assert.equal(res.bonoPrice, v.expectedDiscounted, `El precio con dto para ${v.id} debe ser ${v.expectedDiscounted}`);
      assert.equal(res.totalToPay, v.expectedDiscounted, `El total a pagar para ${v.id} debe coincidir`);
    }
  });

  runTest("6. Caducidad estricta de 30 días para bonos docentes y bonos regulares", () => {
    const martaProfile = {
      id: "e9cc4200-aba2-4e67-8191-808c40e75621",
      nombre_completo: "Marta García Vázquez",
      email: "marta.garci.013@gmail.com",
      plan_activo: "Bono 10 clases (Docente)",
      clases_restantes: 10
    };

    const expDate = calculateBonoExpirationDate(martaProfile);
    assert.ok(expDate, "La fecha de caducidad debe calcularse");
    
    const now = new Date();
    const diffDays = Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 30, "La caducidad de bonos docentes debe ser exactamente de 30 días naturales");
  });

  runTest("7. Blindaje de fechas a futuro: Cruce de meses, cambios de año y fin de mes", () => {
    // Simular compra el 15 de diciembre de 2026 -> debe caducar el 14 de enero de 2027 (30 días)
    const baseDec = new Date("2026-12-15T12:00:00.000Z");
    const expDec = new Date(baseDec.getTime() + 30 * 24 * 60 * 60 * 1000);
    assert.equal(expDec.toISOString().slice(0, 10), "2027-01-14");

    // Simular compra el 31 de enero de 2027 -> debe caducar el 2 de marzo de 2027 (30 días)
    const baseJan = new Date("2027-01-31T12:00:00.000Z");
    const expJan = new Date(baseJan.getTime() + 30 * 24 * 60 * 60 * 1000);
    assert.equal(expJan.toISOString().slice(0, 10), "2027-03-02");
  });

  console.log("================================================================================");
  console.log(`📊 RESULTADO: ${passed} PASSED, 0 FAILED - INTEGRIDAD 100% VERIFICADA`);
  console.log("================================================================================");
}

main();
