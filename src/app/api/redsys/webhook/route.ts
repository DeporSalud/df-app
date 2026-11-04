import { NextRequest, NextResponse } from "next/server";
import {
  REDSYS_CONFIG,
  verifyRedsysSignature,
  isRedsysResponseApproved,
  decodeMerchantParameters,
  normalizeBase64,
} from "@/lib/redsys";
import { createClient } from "@supabase/supabase-js";
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

export async function POST(req: NextRequest) {
  try {
    let merchantParamsB64 = "";
    let signature = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      merchantParamsB64 =
        body.Ds_MerchantParameters || body.ds_merchantparameters || "";
      signature = body.Ds_Signature || body.ds_signature || "";
    } else {
      const formData = await req.formData();
      merchantParamsB64 =
        (formData.get("Ds_MerchantParameters") as string) ||
        (formData.get("ds_merchantparameters") as string) ||
        "";
      signature =
        (formData.get("Ds_Signature") as string) ||
        (formData.get("ds_signature") as string) ||
        "";
    }

    if (!merchantParamsB64 || !signature) {
      console.warn("[Redsys Webhook] Petición sin parámetros de Redsys requeridos.");
      return new NextResponse("Parámetros ausentes", { status: 400 });
    }

    // 1. Validar la firma HMAC-SHA256 con la clave del banco
    const verification = verifyRedsysSignature({
      secretKey: REDSYS_CONFIG.secretKey,
      merchantParamsB64,
      receivedSignature: signature,
    });

    if (!verification.isValid) {
      console.error("[Redsys Webhook] ❌ Firma inválida recibida:", {
        receivedSignature: signature,
        order: verification.order,
        error: verification.error,
      });
      return new NextResponse("Firma de Redsys inválida", { status: 400 });
    }

    const params = verification.params || decodeMerchantParameters(merchantParamsB64);
    const order = verification.order || params.Ds_Order;
    const responseCode = params.Ds_Response;
    const authCode = params.Ds_AuthorisationCode || "";
    const amountCents = parseInt(params.Ds_Amount || "0", 10);
    const amountEuros = (amountCents / 100).toFixed(2);
    const payType = params.Ds_PayMethod || (params.Ds_Card_Brand ? "Tarjeta" : "TPV");

    console.log(
      `[Redsys Webhook] ✅ Operación recibida: Pedido=${order}, Respuesta=${responseCode}, Importe=${amountEuros}€, Método=${payType}`
    );

    // 2. Verificar si la operación fue autorizada (0000 - 0099)
    if (!isRedsysResponseApproved(responseCode)) {
      console.warn(
        `[Redsys Webhook] ⚠️ Operación no autorizada o denegada: Pedido=${order}, Código=${responseCode}`
      );
      return new NextResponse("OK", { status: 200 });
    }

    await withPaymentFulfillmentLock(`redsys:${order}`, async () => {
      // 3. Extraer metadatos del alumno y bono desde Ds_MerchantData
      let metadata: any = {};
      if (params.Ds_MerchantData) {
        try {
          const rawData = decodeURIComponent(params.Ds_MerchantData);
          if (rawData.startsWith("{")) {
            metadata = JSON.parse(rawData);
          } else {
            const decodedData = Buffer.from(normalizeBase64(rawData), "base64").toString("utf8");
            metadata = JSON.parse(decodedData);
          }
        } catch (e) {
          console.warn("[Redsys Webhook] No se pudo parsear Ds_MerchantData:", e);
        }
      }

      const {
        studentId,
        studentEmail,
        studentName,
        bonoId,
        bonoName,
        clasesCount,
      } = metadata;

      const count = parseInt(clasesCount || "4", 10);
      const isUnlimited = count >= 999;

      function isValidUUID(str?: string | null): boolean {
        if (!str) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
      }

      // 4. Buscar alumno en Supabase (con protección de sintaxis UUID)
      let student: any = null;
      let targetStudentId = studentId;

      if (studentId && isValidUUID(studentId)) {
        const { data } = await supabase
          .from("alumnos")
          .select("*")
          .eq("id", studentId)
          .maybeSingle();
        student = data;
      }

      if (!student && studentEmail) {
        const { data } = await supabase
          .from("alumnos")
          .select("*")
          .ilike("email", studentEmail.trim().toLowerCase())
          .maybeSingle();
        student = data;
        if (student) targetStudentId = student.id;
      }

      // 4.1 Evitar duplicados (Idempotencia en nube vía DF_PAGOS en alumnos.direccion)
      const receiptCode = `TPV-${order}`;
      const txId = `redsys_${order}`;
      const existingStudentPagos = parseStudentPagosMeta(student?.direccion);
      if (existingStudentPagos.some((p: any) => p.numero_recibo === receiptCode || p.id === txId)) {
        console.log(`[Redsys Webhook] ⚠️ Pedido ${order} ya fue procesado con anterioridad. Confirmando 200 OK sin duplicar saldo.`);
        return;
      }

      const isPromo =
        isPromoSeptiembreBono(bonoId) ||
        isPromoSeptiembreBono(bonoName) ||
        metadata.isPromo === "true";

      const bonoCaducidadISO = isPromo
        ? "2026-09-30T23:59:59.000Z"
        : addOneCalendarMonthMadrid(new Date()).toISOString();

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

      const chargeMatricula =
        metadata.isFirstBono === "true" || parseFloat(metadata.matriculaCost || "0") > 0;
      const metodoFinal = payType.toLowerCase().includes("bizum") || payType === "z" ? "Bizum" : "TPV";
      const bonoLabel = bonoName || "Bono de Clases";
      const categoriaFinal = bonoLabel.toLowerCase().includes("suelta") ? "clase_suelta" : "bono";
      const sedeFinal = ["castilla", "alcorcon", "studio 2"].includes(String(student?.sede || "").toLowerCase().trim())
        ? "castilla"
        : "tejar";

      const buildCloudPagoRecord = (resolvedStudentId?: string | null, resolvedStudent?: any) => ({
        id: txId,
        numero_recibo: receiptCode,
        fecha_hora: purchaseNowISO,
        fecha_corta: fechaCorta,
        hora_corta: horaCorta,
        alumno_id: resolvedStudentId && isValidUUID(resolvedStudentId) ? resolvedStudentId : undefined,
        alumno_nombre: resolvedStudent?.nombre_completo || studentName || "Alumno Online",
        alumno_dni: resolvedStudent?.dni || undefined,
        alumno_telefono: resolvedStudent?.telefono || undefined,
        concepto: `Bono: ${bonoLabel}${chargeMatricula && metadata.matriculaCost ? ` (+${metadata.matriculaCost}€ Matrícula)` : ""} (TPV CaixaBank)`,
        categoria: categoriaFinal,
        importe: parseFloat(amountEuros),
        metodo_pago: metodoFinal,
        sede: sedeFinal,
        atendido_por: "TPV Virtual Redsys CaixaBank",
        notas: `Aut: ${authCode} | Pedido: ${order}${studentEmail ? ` | Email: ${studentEmail}` : ""}`,
        periodo_mes: periodoMes,
        estado: "Cobrado",
      });

      if (student && targetStudentId) {
        const { updatedBalance } = computeNewBonoBalance(student, count);
        const cloudPago = buildCloudPagoRecord(targetStudentId, student);
        const updatedDireccion = upsertStudentPagoInDireccion(student.direccion, cloudPago);

        const updatePayload: Record<string, any> = {
          plan_activo: bonoLabel,
          clases_restantes: updatedBalance,
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
          .eq("id", targetStudentId);

        if (updateErr && (updateErr.code === "42703" || updateErr.message?.includes("matricula"))) {
          await supabase
            .from("alumnos")
            .update({
              plan_activo: bonoLabel,
              clases_restantes: updatedBalance,
              creado_en: purchaseNowISO,
              direccion: updatedDireccion,
            })
            .eq("id", targetStudentId);
        } else if (updateErr) {
          console.warn("[Redsys Webhook] Error actualización alumno:", updateErr.message);
        }

        console.log(
          `[Redsys Webhook] 💃 Alumno ${student.nombre_completo || targetStudentId} actualizado con éxito + cobro ${receiptCode} (${amountEuros}€) persistido en nube.`
        );
      } else if (!student && studentEmail) {
        try {
          const initialPago = buildCloudPagoRecord(undefined, null);
          const newStudentPayload = {
            nombre_completo: studentName || "Alumno Online",
            email: studentEmail.trim().toLowerCase(),
            clases_restantes: isUnlimited ? 999 : count,
            plan_activo: bonoLabel,
            sede: "castilla",
            estado: "Activo",
            direccion: upsertStudentPagoInDireccion("", initialPago),
          };
          const { data: createdStudent, error: createErr } = await supabase
            .from("alumnos")
            .insert([newStudentPayload])
            .select()
            .maybeSingle();

          if (createdStudent) {
            student = createdStudent;
            targetStudentId = createdStudent.id;
            const linkedPago = buildCloudPagoRecord(createdStudent.id, createdStudent);
            await supabase
              .from("alumnos")
              .update({ direccion: upsertStudentPagoInDireccion(createdStudent.direccion, linkedPago) })
              .eq("id", createdStudent.id);
            console.log(`[Redsys Webhook] 🌟 Nuevo alumno registrado y cobro ${receiptCode} persistido: ${studentName} (${studentEmail})`);
          } else if (createErr) {
            console.warn("[Redsys Webhook] Info creación alumno:", createErr.message);
          }
        } catch (e) {
          console.warn("[Redsys Webhook] Fallback creación alumno:", e);
        }
      } else {
        // Fallback: persistir recibo en fila maestra de Dirección para no perder ningún cobro bancario
        try {
          const { data: fallbackRow } = await supabase
            .from("alumnos")
            .select("id, direccion")
            .eq("id", FALLBACK_LEDGER_ROW_ID)
            .maybeSingle();
          if (fallbackRow) {
            const unlinkedPago = buildCloudPagoRecord(undefined, null);
            await supabase
              .from("alumnos")
              .update({ direccion: upsertStudentPagoInDireccion(fallbackRow.direccion, unlinkedPago) })
              .eq("id", FALLBACK_LEDGER_ROW_ID);
          }
        } catch (fallbackLedgerErr) {
          console.warn("[Redsys Webhook] Fallback ledger warning:", fallbackLedgerErr);
        }
      }

      // 6. Registrar en registros de actividad para visibilidad en CRM
      try {
        await supabase.from("registros_actividad").insert([
          {
            id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
            created_at: new Date().toISOString(),
            origen: "alumno",
            tipo_evento: "compra_bono_stripe",
            descripcion: `Pago completado en TPV CaixaBank: ${bonoName || "Bono"} (${amountEuros}€, Pedido: ${order})`,
            usuario_afectado: student?.nombre_completo || studentName || studentEmail || "Alumno Online",
            detalles: JSON.stringify({
              order,
              authCode,
              amount: amountEuros,
              bonoName,
              clasesCount: count,
            }),
            sede: "General",
          },
        ]);
      } catch (logErr) {
        // Silencioso
      }
    });

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("[Redsys Webhook Error]:", error);
    return new NextResponse("OK", { status: 200 });
  }
}
