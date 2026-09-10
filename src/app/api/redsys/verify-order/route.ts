import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  REDSYS_CONFIG,
  verifyRedsysSignature,
  isRedsysResponseApproved,
  decodeMerchantParameters,
  normalizeBase64,
} from "@/lib/redsys";
import { isPromoSeptiembreBono } from "@/lib/matriculaService";

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

    // 1. Buscar registro de pago en la tabla pagos
    let pagoData: any = null;
    if (order) {
      const { data } = await supabase
        .from("pagos")
        .select("*")
        .ilike("numero_recibo", `%${order}%`)
        .maybeSingle();
      pagoData = data;

      // Si el webhook aún está en tránsito, esperar 1 segundo y reintentar
      if (!pagoData) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { data: retryData } = await supabase
          .from("pagos")
          .select("*")
          .ilike("numero_recibo", `%${order}%`)
          .maybeSingle();
        pagoData = retryData;
      }
    }

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

            const isPromo = isPromoSeptiembreBono(metadata.bonoId) || metadata.isPromo === "true";
            const expISO = isPromo ? "2026-09-30T23:59:59.000Z" : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            if (studentToUpdate && targetUUID) {
              const curBal = typeof studentToUpdate.clases_restantes === "number" ? studentToUpdate.clases_restantes : 0;
              const newBal = clasesCount >= 999 ? 999 : curBal + clasesCount;
              await supabase.from("alumnos").update({
                clases_restantes: newBal,
                plan_activo: bonoName,
                bono_caducidad: expISO,
                matricula_pagada: true,
                matricula_fecha: new Date().toISOString().split("T")[0],
              }).eq("id", targetUUID);
            }

            const validStudentId = isValidUUID(targetUUID) ? targetUUID : null;
            const { data: newPago } = await supabase.from("pagos").insert([{
              numero_recibo: `TPV-${order}`,
              fecha_hora: new Date().toISOString(),
              alumno_id: validStudentId,
              alumno_nombre: studentToUpdate?.nombre_completo || metadata.studentName || "Alumno Online",
              concepto: `${bonoName} (TPV CaixaBank)`,
              categoria: "bono",
              importe: parseFloat(amountEuros),
              metodo_pago: "TPV",
              sede: "castilla",
              atendido_por: "TPV Virtual Redsys (Retorno)",
              notas: `Aut: ${authCode} | Pedido: ${order}`,
              estado: "Cobrado",
            }]).select().maybeSingle();

            pagoData = newPago;
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
        .select("id, nombre_completo, clases_restantes, plan_activo, matricula_pagada, bono_caducidad")
        .eq("id", studentId)
        .maybeSingle();
      studentData = data;
    }

    if (!studentData && studentEmail) {
      const { data } = await supabase
        .from("alumnos")
        .select("id, nombre_completo, clases_restantes, plan_activo, matricula_pagada, bono_caducidad")
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
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al verificar pedido." },
      { status: 500 }
    );
  }
}
