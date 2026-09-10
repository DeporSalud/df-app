import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { isPromoSeptiembreBono } from "@/lib/matriculaService";

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
      studentName,
      studentEmail,
      bonoId,
      bonoName,
      clasesCount,
      totalAmount,
      isFirstBono,
    } = session.metadata || {};

    const count = parseInt(clasesCount || "4", 10);
    const isUnlimited = count >= 999;

    let updatedBalance = count;

    // 1. Check idempotency on Stripe PaymentIntent to prevent duplicate additions
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as any)?.id;

    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.metadata?.processed === "true") {
          // Check student balance in DB
          let currentBalance = 0;
          let existingStudent: any = null;

          if (studentId) {
            const { data } = await supabase
              .from("alumnos")
              .select("id, clases_restantes, plan_activo")
              .eq("id", studentId)
              .maybeSingle();
            existingStudent = data;
          }

          const resolvedEmail = studentEmail || session.customer_details?.email;
          if (!existingStudent && resolvedEmail) {
            const { data } = await supabase
              .from("alumnos")
              .select("id, clases_restantes, plan_activo")
              .ilike("email", resolvedEmail.trim().toLowerCase())
              .maybeSingle();
            existingStudent = data;
          }

          currentBalance = existingStudent?.clases_restantes ?? 0;

          // Self-healing: if PaymentIntent was marked processed but student ended up with 0 classes, credit them now!
          if (existingStudent && currentBalance === 0) {
            const healedBalance = isUnlimited ? 999 : count;
            const healedPlan = bonoName || "Bono de Clases";
            await supabase
              .from("alumnos")
              .update({
                plan_activo: healedPlan,
                clases_restantes: healedBalance,
              })
              .eq("id", existingStudent.id);
            currentBalance = healedBalance;
          }

          return NextResponse.json({
            success: true,
            alreadyProcessed: true,
            paid: true,
            bonoName: bonoName || "Bono de Clases",
            clasesCount: count,
            updatedBalance: currentBalance,
            totalAmount: totalAmount || "0.00",
            customerEmail: session.customer_details?.email || studentEmail,
            receiptUrl: (session as any).receipt_url || null,
          });
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
        .select("id, clases_restantes, plan_activo")
        .eq("id", studentId)
        .maybeSingle();
      student = data;
    }

    const resolvedEmail = studentEmail || session.customer_details?.email;
    if (!student && resolvedEmail) {
      const { data } = await supabase
        .from("alumnos")
        .select("id, clases_restantes, plan_activo")
        .ilike("email", resolvedEmail.trim().toLowerCase())
        .maybeSingle();
      student = data;
      if (student) targetStudentId = student.id;
    }

    if (student && targetStudentId) {
      const currentBalance = typeof student.clases_restantes === "number" ? student.clases_restantes : 0;
      updatedBalance = isUnlimited ? 999 : currentBalance + count;

      // Update in Supabase: strictly target existing columns (plan_activo, clases_restantes)
      const { error: updateErr } = await supabase
        .from("alumnos")
        .update({
          plan_activo: bonoName || "Bono de Clases",
          clases_restantes: updatedBalance,
        })
        .eq("id", targetStudentId);

      if (updateErr) {
        console.error("[Stripe Verify] Error updating student in Supabase:", updateErr);
        return NextResponse.json(
          { success: false, error: `Error actualizando clases en Supabase: ${updateErr.message}` },
          { status: 500 }
        );
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

    return NextResponse.json({
      success: true,
      paid: true,
      bonoName: bonoName || "Bono de Clases",
      clasesCount: count,
      updatedBalance,
      bonoCaducidad: (isPromoSeptiembreBono(bonoId) || isPromoSeptiembreBono(bonoName) || session.metadata?.isPromoSeptiembre === "true")
        ? "2026-09-30T23:59:59.000Z"
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
