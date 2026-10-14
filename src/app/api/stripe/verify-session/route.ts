import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { isPromoSeptiembreBono, getCurrentSeason, addOneCalendarMonthMadrid } from "@/lib/matriculaService";
import { withPaymentFulfillmentLock, computeNewBonoBalance } from "@/lib/paymentFulfillmentLock";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wjnoawmefdurqqjwqdmi.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID no proporcionado." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        paid: false,
        message: "El pago aún no ha sido confirmado por Stripe.",
      });
    }

    const {
      studentId,
      studentEmail,
      bonoId,
      bonoName,
      clasesCount,
      totalAmount,
      isFirstBono,
    } = session.metadata || {};

    const count = parseInt(clasesCount || "4", 10);
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as any)?.id;

    const lockKey = `stripe:${paymentIntentId || sessionId}`;

    const { alreadyFulfilled, result: fulfillmentResult } = await withPaymentFulfillmentLock(
      lockKey,
      async () => {
        // 1. Check idempotency on Stripe PaymentIntent to prevent duplicate additions
        if (paymentIntentId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (pi.metadata?.processed === "true") {
              let existingStudent: any = null;
              if (studentId) {
                const { data } = await supabase
                  .from("alumnos")
                  .select("id, clases_restantes, plan_activo, creado_en")
                  .eq("id", studentId)
                  .maybeSingle();
                existingStudent = data;
              }
              const resolvedEmail = studentEmail || session.customer_details?.email;
              if (!existingStudent && resolvedEmail) {
                const { data } = await supabase
                  .from("alumnos")
                  .select("id, clases_restantes, plan_activo, creado_en")
                  .ilike("email", resolvedEmail.trim().toLowerCase())
                  .maybeSingle();
                existingStudent = data;
              }
              const currentBalance = existingStudent?.clases_restantes ?? Number(pi.metadata?.updatedBalance || count);
              return {
                alreadyProcessed: true,
                updatedBalance: currentBalance,
              };
            }
          } catch (stripeErr) {
            console.warn("[Stripe Verify] Could not check PaymentIntent metadata:", stripeErr);
          }
        }

        let student: any = null;
        let targetStudentId = studentId;

        if (studentId) {
          const { data } = await supabase
            .from("alumnos")
            .select("id, clases_restantes, plan_activo, creado_en")
            .eq("id", studentId)
            .maybeSingle();
          student = data;
        }

        const resolvedEmail = studentEmail || session.customer_details?.email;
        if (!student && resolvedEmail) {
          const { data } = await supabase
            .from("alumnos")
            .select("id, clases_restantes, plan_activo, creado_en")
            .ilike("email", resolvedEmail.trim().toLowerCase())
            .maybeSingle();
          student = data;
          if (student) targetStudentId = student.id;
        }

        let updatedBalance = count;

        if (student && targetStudentId) {
          const { updatedBalance: computedBal } = computeNewBonoBalance(student, count);
          updatedBalance = computedBal;

          const purchaseNowISO = new Date().toISOString();
          const updatePayload: Record<string, any> = {
            plan_activo: bonoName || "Bono de Clases",
            clases_restantes: updatedBalance,
            creado_en: purchaseNowISO,
          };

          const chargeMatricula = isFirstBono === "true" || parseFloat(session.metadata?.matriculaCost || "0") > 0;
          if (chargeMatricula) {
            updatePayload.matricula_pagada = true;
            updatePayload.matricula_fecha = purchaseNowISO;
            updatePayload.temporada_matricula = getCurrentSeason();
          }

          let { error: updateErr } = await supabase
            .from("alumnos")
            .update(updatePayload)
            .eq("id", targetStudentId);

          if (updateErr && (updateErr.code === "42703" || updateErr.message?.includes("matricula"))) {
            console.warn("[Stripe Verify] Falling back to standard columns without matricula:", updateErr.message);
            const fallbackRes = await supabase
              .from("alumnos")
              .update({
                plan_activo: bonoName || "Bono de Clases",
                clases_restantes: updatedBalance,
                creado_en: purchaseNowISO,
              })
              .eq("id", targetStudentId);
            updateErr = fallbackRes.error;
          }

          if (updateErr) {
            throw new Error(`Error actualizando clases en Supabase: ${updateErr.message}`);
          }

          // Mark as processed in Stripe ONLY AFTER Supabase successfully updated
          if (paymentIntentId) {
            try {
              await stripe.paymentIntents.update(paymentIntentId, {
                metadata: {
                  processed: "true",
                  studentId: targetStudentId || "",
                  bonoId: bonoId || "",
                  updatedBalance: String(updatedBalance),
                },
              });
            } catch (stripeErr) {
              console.warn("[Stripe Verify] Could not update PaymentIntent metadata:", stripeErr);
            }
          }
        }

        return {
          alreadyProcessed: false,
          updatedBalance,
        };
      }
    );

    return NextResponse.json({
      success: true,
      alreadyProcessed: alreadyFulfilled || fulfillmentResult.alreadyProcessed,
      paid: true,
      bonoName: bonoName || "Bono de Clases",
      clasesCount: count,
      updatedBalance: fulfillmentResult.updatedBalance,
      bonoCaducidad: (isPromoSeptiembreBono(bonoId) || isPromoSeptiembreBono(bonoName) || session.metadata?.isPromoSeptiembre === "true")
        ? "2026-09-30T23:59:59.000Z"
        : addOneCalendarMonthMadrid(new Date()).toISOString(),
      totalAmount: totalAmount || "0.00",
      customerEmail: session.customer_details?.email || studentEmail,
      receiptUrl: (session as any).receipt_url || null,
    });
  } catch (error: any) {
    console.error("[Stripe Verify Session Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al verificar la sesión de Stripe." },
      { status: 500 }
    );
  }
}
