import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  REDSYS_CONFIG,
  verifyRedsysSignature,
  isRedsysResponseApproved,
  decodeMerchantParameters,
  normalizeBase64,
} from "@/lib/redsys";
import { isPromoSeptiembreBono, getCurrentSeason, addOneCalendarMonthMadrid } from "@/lib/matriculaService";
import { withPaymentFulfillmentLock, computeNewBonoBalance } from "@/lib/paymentFulfillmentLock";
import { parseStudentPagosMeta, upsertStudentPagoInDireccion } from "@/lib/teacherRegistryService";

const FALLBACK_LEDGER_ROW_ID = "7a101100-0000-4000-a000-000000001011";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wjnoawmefdurqqjwqdmi.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const order = searchParams.get("order");
    const studentId = searchParams.get("studentId");
    const studentEmail = searchParams.get("studentEmail");
    const merchantParamsB64 = searchParams.get("merchantParams") || searchParams.get("Ds_MerchantParameters") || "";
    const receivedSignature = searchParams.get("signature") || searchParams.get("Ds_Signature") || "";

    if (!studentId && !studentEmail && !order) {
      return NextResponse.json(
        { success: false, error: "Parámetros insuficientes." },
        { status: 400 }
      );
    }

    // 1. Buscar alumno y verificar si el recibo TPV-{order} ya figura en su libro cloud DF_PAGOS
    let pagoData: any = null;
    let initialStudentRow: any = null;
    if (studentId && isValidUUID(studentId)) {
      const { data } = await supabase.from("alumnos").select("*").eq("id", studentId).maybeSingle();
      initialStudentRow = data;
    }
    if (!initialStudentRow && studentEmail) {
      const { data } = await supabase.from("alumnos").select("*").ilike("email", studentEmail.trim().toLowerCase()).maybeSingle();
      initialStudentRow = data;
    }

    if (order && initialStudentRow) {
      const existingPagos = parseStudentPagosMeta(initialStudentRow.direccion);
      pagoData = existingPagos.find((p: any) => p.numero_recibo === `TPV-${order}` || p.id === `redsys_${order}`) || null;
    }

    let calculatedCaducidad: string = addOneCalendarMonthMadrid(new Date()).toISOString();

    // 2. Si el webhook aún no llegó pero el navegador trajo los parámetros firmados por CaixaBank:
    if (!pagoData && merchantParamsB64 && receivedSignature && order) {
      try {
        const verification = verifyRedsysSignature({
          secretKey: REDSYS_CONFIG.secretKey,
          merchantParamsB64,
          receivedSignature,
        });

        if (verification.isValid) {
          const params = verification.params || decodeMerchantParameters(merchantParamsB64);
          if (isRedsysResponseApproved(params.Ds_Response)) {
            await withPaymentFulfillmentLock(`redsys:${order}`, async () => {
              let metadata: any = {};
              if (params.Ds_MerchantData) {
                try {
                  const raw = decodeURIComponent(params.Ds_MerchantData);
                  metadata = raw.startsWith("{")
                    ? JSON.parse(raw)
                    : JSON.parse(Buffer.from(normalizeBase64(raw), "base64").toString("utf8"));
                } catch (e) {}
              }

              const bonoName = metadata.bonoName || "Bono de Clases";
              const clasesCount = parseInt(metadata.clasesCount || "4", 10);
              const amountCents = parseInt(params.Ds_Amount || "0", 10);
              const amountEuros = (amountCents / 100).toFixed(2);
              const authCode = params.Ds_AuthorisationCode || "";
              const payType = params.Ds_PayMethod || (params.Ds_Card_Brand ? "Tarjeta" : "TPV");

              let studentToUpdate: any = null;
              let targetUUID = metadata.studentId;

              if (metadata.studentId && isValidUUID(metadata.studentId)) {
                const { data } = await supabase.from("alumnos").select("*").eq("id", metadata.studentId).maybeSingle();
                studentToUpdate = data;
              }
              if (!studentToUpdate && (metadata.studentEmail || studentEmail)) {
                const emailToUse = (metadata.studentEmail || studentEmail).trim().toLowerCase();
                const { data } = await supabase.from("alumnos").select("*").ilike("email", emailToUse).maybeSingle();
                studentToUpdate = data;
                if (studentToUpdate) targetUUID = studentToUpdate.id;
              }

              const receiptCode = `TPV-${order}`;
              const txId = `redsys_${order}`;
              const alreadyProcessed = parseStudentPagosMeta(studentToUpdate?.direccion).find(
                (p: any) => p.numero_recibo === receiptCode || p.id === txId
              );
              if (alreadyProcessed) {
                pagoData = alreadyProcessed;
                return;
              }

              const isPromo = isPromoSeptiembreBono(metadata.bonoId) || metadata.isPromo === "true";
              const expISO = isPromo ? "2026-09-30T23:59:59.000Z" : addOneCalendarMonthMadrid(new Date()).toISOString();
              calculatedCaducidad = expISO;

              const nowDate = new Date();
              const purchaseNowISO = nowDate.toISOString();
              const fechaCorta = nowDate.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "Europe/Madrid",
              });
              const horaCorta = nowDate.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Madrid",
              });
              const madridParts = fechaCorta.split("/");
              const periodoMes = madridParts.length === 3 ? `${madridParts[2]}-${madridParts[1]}` : purchaseNowISO.slice(0, 7);

              const chargeMatricula = metadata.isFirstBono === "true" || parseFloat(metadata.matriculaCost || "0") > 0;
              const metodoFinal = payType.toLowerCase().includes("bizum") || payType === "z" ? "Bizum" : "TPV";
              const categoriaFinal = bonoName.toLowerCase().includes("suelta") ? "clase_suelta" : "bono";
              const sedeFinal = "castilla";

              const newPagoObj = {
                id: txId,
                numero_recibo: receiptCode,
                fecha_hora: purchaseNowISO,
                fecha_corta: fechaCorta,
                hora_corta: horaCorta,
                alumno_id: isValidUUID(targetUUID) ? targetUUID : undefined,
                alumno_nombre: studentToUpdate?.nombre_completo || metadata.studentName || "Alumno Online",
                alumno_dni: studentToUpdate?.dni || undefined,
                alumno_telefono: studentToUpdate?.telefono || undefined,
                concepto: `Bono: ${bonoName}${chargeMatricula && metadata.matriculaCost ? ` (+${metadata.matriculaCost}€ Matrícula)` : ""} (TPV CaixaBank)`,
                categoria: categoriaFinal,
                importe: parseFloat(amountEuros),
                metodo_pago: metodoFinal,
                sede: sedeFinal,
                atendido_por: "TPV Virtual Redsys CaixaBank",
                notas: `Aut: ${authCode} | Pedido: ${order}`,
                periodo_mes: periodoMes,
                estado: "Cobrado",
              };

              if (studentToUpdate && targetUUID) {
                const { updatedBalance: newBal } = computeNewBonoBalance(studentToUpdate, clasesCount);
                const updatedDireccion = upsertStudentPagoInDireccion(studentToUpdate.direccion, newPagoObj);
                const updatePayload: Record<string, any> = {
                  clases_restantes: newBal,
                  plan_activo: bonoName,
                  creado_en: purchaseNowISO,
                  direccion: updatedDireccion,
                };

                if (chargeMatricula) {
                  updatePayload.matricula_pagada = true;
                  updatePayload.matricula_fecha = purchaseNowISO;
                  updatePayload.temporada_matricula = getCurrentSeason();
                }

                const { error: updateErr } = await supabase
                  .from("alumnos")
                  .update(updatePayload)
                  .eq("id", targetUUID);

                if (updateErr && (updateErr.code === "42703" || updateErr.message?.includes("matricula"))) {
                  console.warn("[Redsys Verify] Falling back to standard columns without matricula:", updateErr.message);
                  await supabase.from("alumnos").update({
                    clases_restantes: newBal,
                    plan_activo: bonoName,
                    creado_en: purchaseNowISO,
                    direccion: updatedDireccion,
                  }).eq("id", targetUUID);
                }
                pagoData = newPagoObj;
              } else {
                try {
                  const { data: fallbackRow } = await supabase
                    .from("alumnos")
                    .select("id, direccion")
                    .eq("id", FALLBACK_LEDGER_ROW_ID)
                    .maybeSingle();
                  if (fallbackRow) {
                    await supabase
                      .from("alumnos")
                      .update({ direccion: upsertStudentPagoInDireccion(fallbackRow.direccion, newPagoObj) })
                      .eq("id", FALLBACK_LEDGER_ROW_ID);
                  }
                  pagoData = newPagoObj;
                } catch {}
              }
            });
          }
        }
      } catch (browserVerifyErr) {
        console.warn("[Redsys Verify Order] Info verificación retorno navegador:", browserVerifyErr);
      }
    }

    // 3. Obtener el perfil actualizado del alumno
    let studentData: any = null;

    if (studentId && isValidUUID(studentId)) {
      const { data } = await supabase
        .from("alumnos")
        .select("id, nombre_completo, clases_restantes, plan_activo")
        .eq("id", studentId)
        .maybeSingle();
      studentData = data;
    }

    if (!studentData && studentEmail) {
      const { data } = await supabase
        .from("alumnos")
        .select("id, nombre_completo, clases_restantes, plan_activo")
        .ilike("email", studentEmail.trim().toLowerCase())
        .maybeSingle();
      studentData = data;
    }

    return NextResponse.json({
      success: true,
      order,
      paid: true,
      student: studentData,
      payment: pagoData,
      bonoName: pagoData?.concepto || studentData?.plan_activo || "Bono de Clases",
      amount: pagoData?.importe ? `${pagoData.importe.toFixed(2)} €` : null,
      updatedBalance: studentData?.clases_restantes ?? null,
      planActivo: studentData?.plan_activo ?? null,
      bonoCaducidad: calculatedCaducidad,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al verificar pedido." },
      { status: 500 }
    );
  }
}
