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

import { isTeacherProfile, isRegularClassStudent, hasPaidSeasonMatricula } from "@/lib/matriculaService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bonoId, studentId, studentName, studentEmail, isFirstBonoOfYear, isTeacher: clientIsTeacher, isRegularStudent: clientIsRegular } = body;

    const idClean = (bonoId || "").toLowerCase().trim();
    const bono = BONOS_DATA[bonoId] || Object.values(BONOS_DATA).find(b => {
      const bId = b.id.toLowerCase();
      if (bId === idClean) return true;
      if (idClean.includes("4") && bId.includes("4")) return true;
      if (idClean.includes("8") && bId.includes("8")) return true;
      if (idClean.includes("10") && bId.includes("10")) return true;
      if ((idClean.includes("ilimitad") || idClean.includes("pase")) && bId.includes("ilimitad")) return true;
      if ((idClean.includes("suelta") || idClean.includes("1")) && bId.includes("suelta")) return true;
      return false;
    });

    if (!bono) {
      return NextResponse.json(
        { success: false, error: "Bono no encontrado o no válido." },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || "https://app.dancefactoryalcorcon.es";

    // Validate student against Supabase: regular class enrollments (alumnos_clases), plan_activo, cuota_mensual and teacher profile
    let isTeacher = Boolean(clientIsTeacher) || isTeacherProfile(undefined, studentEmail);
    let isRegular = Boolean(clientIsRegular);
    let isAlreadyPaid = false;
    let studentVerifiedInDb = false;

    if (studentId || studentEmail) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wjnoawmefdurqqjwqdmi.supabase.co";
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        let dbStudent: any = null;
        if (studentId) {
          const { data } = await supabase.from("alumnos").select("*").eq("id", studentId).maybeSingle();
          dbStudent = data;
        }
        if (!dbStudent && studentEmail) {
          const { data } = await supabase.from("alumnos").select("*").ilike("email", studentEmail.trim().toLowerCase()).maybeSingle();
          dbStudent = data;
        }

        if (dbStudent) {
          studentVerifiedInDb = true;

          // Check Teacher condition (R2)
          if (isTeacherProfile(dbStudent, studentEmail)) {
            isTeacher = true;
          }

          // Check junction table alumnos_clases for regular class enrollment
          const { data: enrollments } = await supabase
            .from("alumnos_clases")
            .select("clase_id")
            .eq("alumno_id", dbStudent.id);

          const hasEnrollments = Array.isArray(enrollments) && enrollments.length > 0;
          const assignedIds = hasEnrollments ? enrollments.map((e: any) => e.clase_id) : [];

          // Check if regular class student (R1)
          isRegular = isRegularClassStudent(dbStudent, { assignedClassIds: assignedIds, enrollmentsCount: assignedIds.length });

          // Check if matricula already paid (R3)
          if (hasPaidSeasonMatricula(dbStudent)) {
            isAlreadyPaid = true;
          }
        }
      } catch (checkErr) {
        console.warn("[Stripe Checkout] Warning checking student matricula in DB:", checkErr);
        if (clientIsRegular !== undefined) {
          isRegular = Boolean(clientIsRegular);
        }
        if (isFirstBonoOfYear !== undefined) {
          isAlreadyPaid = !Boolean(isFirstBonoOfYear);
        }
      }
    }

    // Matrícula charge rule:
    // EXEMPT (0,00€) if:
    // - Regular class student (R1)
    // - Teacher (R2)
    // - Repeat buyer who already paid matricula this season (R3)
    // ONLY charged (+15,00€) if exclusive Open Class student on first purchase of the season
    const chargeMatricula = !isTeacher && !isRegular && !isAlreadyPaid && (
      studentVerifiedInDb ? true : Boolean(isFirstBonoOfYear !== false)
    );

    // Apply 10% teacher discount if teacher
    const unitAmount = isTeacher 
      ? Math.round(bono.precio * 0.90 * 100) 
      : Math.round(bono.precio * 100);

    const lineItems: any[] = [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${bono.nombre}${isTeacher ? " (Tarifa Docente -10%)" : ""} • Dance Factory`,
            description: bono.desc,
            images: ["https://admindf.dancefactoryalcorcon.es/logo.jpg"],
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ];

    // Add Annual Registration Fee (+15€) ONLY if student is exclusive Open Class on first purchase
    if (chargeMatricula) {
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
        isTeacher: isTeacher ? "true" : "false",
        isRegularStudent: isRegular ? "true" : "false",
        isFirstBono: chargeMatricula ? "true" : "false",
        matriculaCost: chargeMatricula ? "15.00" : "0.00",
        totalAmount: ((unitAmount / 100) + (chargeMatricula ? 15.00 : 0.00)).toFixed(2),
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
