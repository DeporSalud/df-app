import { NextRequest, NextResponse } from "next/server";
import {
  REDSYS_CONFIG,
  verifyRedsysSignature,
  isRedsysResponseApproved,
  decodeMerchantParameters,
  normalizeBase64,
} from "@/lib/redsys";
import { createClient } from "@supabase/supabase-js";
import { isPromoSeptiembreBono } from "@/lib/matriculaService";

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
    let signatureVersion = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      merchantParamsB64 =
        body.Ds_MerchantParameters || body.ds_merchantparameters || "";
      signature = body.Ds_Signature || body.ds_signature || "";
      signatureVersion =
        body.Ds_SignatureVersion || body.ds_signatureversion || "";
    } else {
      // Redsys envía por defecto application/x-www-form-urlencoded
      const formData = await req.formData();
      merchantParamsB64 =
        (formData.get("Ds_MerchantParameters") as string) ||
        (formData.get("ds_merchantparameters") as string) ||
        "";
      signature =
        (formData.get("Ds_Signature") as string) ||
        (formData.get("ds_signature") as string) ||
        "";
      signatureVersion =
        (formData.get("Ds_SignatureVersion") as string) ||
        (formData.get("ds_signatureversion") as string) ||
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
      // Responder 200 OK a Redsys para confirmar la recepción del estado denegado
      return new NextResponse("OK", { status: 200 });
    }

    // 2.1 Evitar duplicados (Idempotencia)
    try {
      const { data: existingPago } = await supabase
        .from("pagos")
        .select("id")
        .ilike("numero_recibo", `%${order}%`)
        .maybeSingle();

      if (existingPago) {
        console.log(`[Redsys Webhook] ⚠️ Pedido ${order} ya fue procesado con anterioridad. Confirmando 200 OK sin duplicar saldo.`);
        return new NextResponse("OK", { status: 200 });
      }
    } catch (checkDupErr) {
      console.warn("[Redsys Webhook] Warning comprobando duplicados:", checkDupErr);
    }

    // 3. Extraer metadatos del alumno y bono desde Ds_MerchantData
    let metadata: any = {};
    if (params.Ds_MerchantData) {
      try {
        const rawData = decodeURIComponent(params.Ds_MerchantData);
        if (rawData.startsWith("{")) {
          metadata = JSON.parse(rawData);
        } else {
          // Si está en Base64
          const decodedData = Buffer.from(normalizeBase64(rawData), "base64").toString(
            "utf8"
          );
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
      isFirstBono,
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
        .select("id, nombre_completo, email, clases_restantes, plan_activo, matricula_pagada")
        .eq("id", studentId)
        .maybeSingle();
      student = data;
    }

    if (!student && studentEmail) {
      const { data } = await supabase
        .from("alumnos")
        .select("id, nombre_completo, email, clases_restantes, plan_activo, matricula_pagada")
        .ilike("email", studentEmail.trim().toLowerCase())
        .maybeSingle();
      student = data;
      if (student) targetStudentId = student.id;
    }

    // Calcular fecha de caducidad
    const isPromo =
      isPromoSeptiembreBono(bonoId) ||
      isPromoSeptiembreBono(bonoName) ||
      metadata.isPromo === "true";

    let bonoCaducidadISO: string;
    if (isPromo) {
      bonoCaducidadISO = "2026-09-30T23:59:59.000Z";
    } else {
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + 1);
      bonoCaducidadISO = expDate.toISOString();
    }

    if (student && targetStudentId) {
      const currentBalance =
        typeof student.clases_restantes === "number" ? student.clases_restantes : 0;
      const updatedBalance = isUnlimited ? 999 : currentBalance + count;

      const updatePayload: Record<string, any> = {
        plan_activo: bonoName || "Bono de Clases",
        clases_restantes: updatedBalance,
        bono_caducidad: bonoCaducidadISO,
      };

      if (isFirstBono === "true" || isFirstBono === true || isPromo) {
        updatePayload.matricula_pagada = true;
        updatePayload.matricula_fecha = new Date().toISOString().split("T")[0];
      }

      const { error: updateErr } = await supabase
        .from("alumnos")
        .update(updatePayload)
        .eq("id", targetStudentId);

      if (updateErr) {
        console.warn("[Redsys Webhook] Fallback actualización alumno:", updateErr.message);
        // Reintento con campos mínimos
        const fallbackPayload: Record<string, any> = {
          plan_activo: bonoName || "Bono de Clases",
          clases_restantes: updatedBalance,
        };
        if (isFirstBono === "true" || isFirstBono === true) {
          fallbackPayload.matricula_pagada = true;
        }
        await supabase
          .from("alumnos")
          .update(fallbackPayload)
          .eq("id", targetStudentId);
      }

      console.log(
        `[Redsys Webhook] 💃 Alumno ${student.nombre_completo || targetStudentId} actualizado con éxito: +${count} clases (Saldo: ${updatedBalance})`
      );
    } else if (!student && studentEmail) {
      // Si el alumno no existe en Supabase aún (ej. primera compra online), crearlo automáticamente
      try {
        const newStudentPayload = {
          nombre_completo: studentName || "Alumno Online",
          email: studentEmail.trim().toLowerCase(),
          clases_restantes: isUnlimited ? 999 : count,
          plan_activo: bonoName || "Bono de Clases",
          bono_caducidad: bonoCaducidadISO,
          matricula_pagada: true,
          matricula_fecha: new Date().toISOString().split("T")[0],
          sede: "castilla",
          estado: "Activo"
        };
        const { data: createdStudent, error: createErr } = await supabase
          .from("alumnos")
          .insert([newStudentPayload])
          .select()
          .maybeSingle();

        if (createdStudent) {
          student = createdStudent;
          targetStudentId = createdStudent.id;
          console.log(`[Redsys Webhook] 🌟 Nuevo alumno registrado y activado: ${studentName} (${studentEmail})`);
        } else if (createErr) {
          console.warn("[Redsys Webhook] Info creación alumno:", createErr.message);
        }
      } catch (e) {
        console.warn("[Redsys Webhook] Fallback creación alumno:", e);
      }
    }

    // 5. Registrar transacción en la tabla pagos SIEMPRE (Garantía financiera y de arqueo)
    try {
      const metodoFinal = payType.toLowerCase().includes("bizum") ? "Bizum" : "TPV";
      const validStudentUUID = isValidUUID(targetStudentId) ? targetStudentId : null;
      await supabase.from("pagos").insert([
        {
          numero_recibo: `TPV-${order}`,
          fecha_hora: new Date().toISOString(),
          alumno_id: validStudentUUID,
          alumno_nombre: student?.nombre_completo || studentName || "Alumno Online",
          concepto: `${bonoName || "Bono de Clases"} (TPV CaixaBank)`,
          categoria: "bono",
          importe: parseFloat(amountEuros),
          metodo_pago: metodoFinal,
          sede: "castilla", // Sede por defecto para ventas online
          atendido_por: "TPV Virtual Redsys",
          notas: `Aut: ${authCode} | Pedido: ${order}`,
          estado: "Cobrado",
        },
      ]);
    } catch (pagoErr) {
      console.log("[Redsys Webhook] Info inserción pagos:", pagoErr);
    }

    // 6. Registrar en registros de actividad para visibilidad en CRM
    try {
      await supabase.from("registros_actividad").insert([
        {
          id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          created_at: new Date().toISOString(),
          origen: "alumno",
          tipo_evento: "compra_bono_stripe", // Mantiene compatibilidad con filtros del CRM
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

    // Redsys requiere estrictamente una respuesta HTTP 200 OK
    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("[Redsys Webhook Error]:", error);
    // Responder 200 OK para no bloquear el reintento de Redsys si fue error de logging interno
    return new NextResponse("OK", { status: 200 });
  }
}
