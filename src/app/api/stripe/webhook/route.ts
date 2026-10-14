import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { withPaymentFulfillmentLock, computeNewBonoBalance } from "@/lib/paymentFulfillmentLock";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wjnoawmefdurqqjwqdmi.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook Signature Error]:", err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
      }
    } else {
      // Parse event and verify against Stripe API
      try {
        event = JSON.parse(rawBody);
      } catch (err) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    if (event.type === "checkout.session.completed") {
      const sessionObj = event.data.object;
      const sessionId = sessionObj?.id;

      if (!sessionId) {
        return NextResponse.json({ received: true });
      }

      // Always retrieve fresh session directly from Stripe API to guarantee authenticity
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session && session.payment_status === "paid") {
        const {
          studentId,
          studentEmail,
          bonoId,
          bonoName,
          clasesCount,
        } = session.metadata || {};

        const count = parseInt(clasesCount || "4", 10);

        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent as any)?.id;

        const lockKey = `stripe:${paymentIntentId || sessionId}`;

        const { alreadyFulfilled } = await withPaymentFulfillmentLock(lockKey, async () => {
          // 1. Idempotency Check
          if (paymentIntentId) {
            try {
              const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
              if (pi.metadata?.processed === "true") {
                return { alreadyProcessed: true };
              }
            } catch (piErr) {
              console.warn("[Stripe Webhook] Error retrieving PaymentIntent:", piErr);
            }
          }

          // 2. Find Student in Supabase
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

          // 3. Update Student Balance with expiration-aware calculation
          if (student && targetStudentId) {
            const { updatedBalance } = computeNewBonoBalance(student, count);
            const purchaseNowISO = new Date().toISOString();

            const { error: updateErr } = await supabase
              .from("alumnos")
              .update({
                plan_activo: bonoName || "Bono de Clases",
                clases_restantes: updatedBalance,
                creado_en: purchaseNowISO,
              })
              .eq("id", targetStudentId);

            if (updateErr) {
              throw new Error(updateErr.message);
            }

            // 4. Mark as processed in Stripe
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
                console.warn("[Stripe Webhook] Error updating PaymentIntent metadata:", stripeErr);
              }
            }

            console.log(`[Stripe Webhook] Successfully credited ${count} classes to ${resolvedEmail || targetStudentId}`);
          }

          return { alreadyProcessed: false };
        });

        if (alreadyFulfilled) {
          return NextResponse.json({ received: true, alreadyProcessed: true });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook Fatal Error]:", err);
    return NextResponse.json({ error: err.message || "Internal Webhook Error" }, { status: 500 });
  }
}
