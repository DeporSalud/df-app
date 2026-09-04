import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

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
          // Already processed! Return current balance safely without re-adding
          let currentBalance = 0;
          if (studentId) {
            const { data: currentDbStudent } = await supabase
              .from("alumnos")
              .select("clases_restantes")
              .eq("id", studentId)
              .maybeSingle();
            currentBalance = currentDbStudent?.clases_restantes ?? 0;
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

        // Mark as processed in Stripe before updating database
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: { processed: "true", studentId: studentId || "", bonoId: bonoId || "" }
        });
      } catch (stripeErr) {
        console.warn("[Stripe Verify] Could not check/update PaymentIntent metadata:", stripeErr);
      }
    }

    if (studentId) {
      // Get current student balance
      const { data: student } = await supabase
        .from("alumnos")
        .select("id, clases_restantes, plan_activo")
        .eq("id", studentId)
        .single();

      if (student) {
        const currentBalance = typeof student.clases_restantes === "number" ? student.clases_restantes : 0;
        updatedBalance = isUnlimited ? 999 : currentBalance + count;

        await supabase
          .from("alumnos")
          .update({
            plan_activo: bonoName || "Bono de Clases",
            clases_restantes: updatedBalance,
          })
          .eq("id", studentId);
      }
    }

    return NextResponse.json({
      success: true,
      paid: true,
      bonoName: bonoName || "Bono de Clases",
      clasesCount: count,
      updatedBalance,
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
