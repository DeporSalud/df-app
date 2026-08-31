import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

interface BonoDefinition {
  id: string;
  nombre: string;
  precio: number;
  clasesCount: number;
  desc: string;
}

const BONOS_DATA: Record<string, BonoDefinition> = {
  "Bono 4 clases": {
    id: "Bono 4 clases",
    nombre: "Bono 4 Clases",
    precio: 45.00,
    clasesCount: 4,
    desc: "Válido para 4 clases de danza en Dance Factory",
  },
  "Bono 8 clases": {
    id: "Bono 8 clases",
    nombre: "Bono 8 Clases",
    precio: 57.00,
    clasesCount: 8,
    desc: "Válido para 8 clases de danza en Dance Factory",
  },
  "Bono 10 clases": {
    id: "Bono 10 clases",
    nombre: "Bono 10 Clases",
    precio: 79.00,
    clasesCount: 10,
    desc: "Válido para 10 clases de danza en Dance Factory",
  },
  "Mensualidad Ilimitada": {
    id: "Mensualidad Ilimitada",
    nombre: "Pase Mensual Ilimitado",
    precio: 100.00,
    clasesCount: 999,
    desc: "Acceso ilimitado a clases de danza durante 30 días",
  },
  "Clase Suelta": {
    id: "Clase Suelta",
    nombre: "Clase Suelta Open Class",
    precio: 15.00,
    clasesCount: 1,
    desc: "Entrada para 1 sesión de Open Class",
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bonoId, studentId, studentName, studentEmail, isFirstBonoOfYear } = body;

    const bono = BONOS_DATA[bonoId] || Object.values(BONOS_DATA).find(b => b.id.toLowerCase() === (bonoId || "").toLowerCase());

    if (!bono) {
      return NextResponse.json(
        { success: false, error: "Bono no encontrado o no válido." },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || "https://app.dancefactoryalcorcon.es";

    const lineItems: any[] = [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${bono.nombre} • Dance Factory`,
            description: bono.desc,
            images: ["https://admindf.dancefactoryalcorcon.es/logo.jpg"],
          },
          unit_amount: Math.round(bono.precio * 100),
        },
        quantity: 1,
      },
    ];

    // Add Annual Registration Fee (+15€) if this is the student's first bono of the season
    if (isFirstBonoOfYear) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: "Matrícula Anual Oficial (Temporada 2026-2027)",
            description: "Cuota oficial de inscripción anual en Dance Factory Alcorcón",
          },
          unit_amount: 1500, // 15.00 €
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      customer_email: studentEmail || undefined,
      metadata: {
        studentId: studentId || "",
        studentName: studentName || "",
        studentEmail: studentEmail || "",
        bonoId: bono.id,
        bonoName: bono.nombre,
        clasesCount: bono.clasesCount.toString(),
        isFirstBono: isFirstBonoOfYear ? "true" : "false",
        matriculaCost: isFirstBonoOfYear ? "15.00" : "0.00",
        totalAmount: (bono.precio + (isFirstBonoOfYear ? 15.00 : 0.00)).toFixed(2),
      },
      success_url: `${origin}/clases?tab=bonos&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/clases?tab=bonos&payment=cancelled`,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error("[Stripe Create Checkout Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al generar sesión de pago de Stripe." },
      { status: 500 }
    );
  }
}
