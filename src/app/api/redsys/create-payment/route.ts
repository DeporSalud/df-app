import { NextRequest, NextResponse } from "next/server";
import {
  REDSYS_CONFIG,
  createRedsysOrder,
  createMerchantSignature,
} from "@/lib/redsys";
import {
  isTeacherProfile,
  isRegularClassStudent,
  hasPaidSeasonMatricula,
  isPromoSeptiembreBono,
  isPromoSeptiembreActive,
} from "@/lib/matriculaService";

interface BonoDefinition {
  id: string;
  nombre: string;
  precio: number;
  clasesCount: number;
  desc: string;
}

const BONOS_DATA: Record<string, BonoDefinition> = {
  // --- BONOS REGULARES OPEN CLASS ---
  "Bono 4 clases": {
    id: "Bono 4 clases",
    nombre: "Bono 4 Clases",
    precio: 45.0,
    clasesCount: 4,
    desc: "Válido para 4 clases de danza en Dance Factory",
  },
  "Bono 8 clases": {
    id: "Bono 8 clases",
    nombre: "Bono 8 Clases",
    precio: 57.0,
    clasesCount: 8,
    desc: "Válido para 8 clases de danza en Dance Factory",
  },
  "Bono 10 clases": {
    id: "Bono 10 clases",
    nombre: "Bono 10 Clases",
    precio: 79.0,
    clasesCount: 10,
    desc: "Válido para 10 clases de danza en Dance Factory",
  },
  "Mensualidad Ilimitada": {
    id: "Mensualidad Ilimitada",
    nombre: "Pase Mensual Ilimitado",
    precio: 100.0,
    clasesCount: 999,
    desc: "Acceso ilimitado a clases de danza durante 30 días",
  },
  "Clase Suelta": {
    id: "Clase Suelta",
    nombre: "Clase Suelta Open Class",
    precio: 15.0,
    clasesCount: 1,
    desc: "Entrada para 1 sesión de Open Class",
  },

  // --- PROMO OPEN CLASS • SOLO SEPTIEMBRE 2026 ---
  "promo_sep_4_alumno": {
    id: "promo_sep_4_alumno",
    nombre: "Promo Septiembre • 4 Clases (Alumno DF)",
    precio: 25.0,
    clasesCount: 4,
    desc: "4 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_4_no_alumno": {
    id: "promo_sep_4_no_alumno",
    nombre: "Promo Septiembre • 4 Clases (No Alumno)",
    precio: 30.0,
    clasesCount: 4,
    desc: "4 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_8_alumno": {
    id: "promo_sep_8_alumno",
    nombre: "Promo Septiembre • 8 Clases (Alumno DF)",
    precio: 35.0,
    clasesCount: 8,
    desc: "8 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_8_no_alumno": {
    id: "promo_sep_8_no_alumno",
    nombre: "Promo Septiembre • 8 Clases (No Alumno)",
    precio: 42.0,
    clasesCount: 8,
    desc: "8 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_12_alumno": {
    id: "promo_sep_12_alumno",
    nombre: "Promo Septiembre • 12 Clases (Alumno DF)",
    precio: 45.0,
    clasesCount: 12,
    desc: "12 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_12_no_alumno": {
    id: "promo_sep_12_no_alumno",
    nombre: "Promo Septiembre • 12 Clases (No Alumno)",
    precio: 55.0,
    clasesCount: 12,
    desc: "12 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_4": {
    id: "promo_sep_4",
    nombre: "Promo Septiembre • 4 Clases",
    precio: 30.0,
    clasesCount: 4,
    desc: "4 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_8": {
    id: "promo_sep_8",
    nombre: "Promo Septiembre • 8 Clases",
    precio: 42.0,
    clasesCount: 8,
    desc: "8 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
  "promo_sep_12": {
    id: "promo_sep_12",
    nombre: "Promo Septiembre • 12 Clases",
    precio: 55.0,
    clasesCount: 12,
    desc: "12 clases Open Class • Válido hasta 30 de Septiembre • Matrícula Gratuita",
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      bonoId,
      studentId,
      studentName,
      studentEmail,
      isFirstBonoOfYear,
      isTeacher: clientIsTeacher,
      isRegularStudent: clientIsRegular,
      calculatedPrice,
      payMethod, // optional: 'z' for Bizum, 'T' for Card, or undefined for all
    } = body;

    const idClean = (bonoId || "").toLowerCase().trim();

    // 1. Búsqueda exacta primero
    let bono: BonoDefinition | undefined = BONOS_DATA[bonoId];

    // 2. Si es promo de septiembre, buscar específicamente entre bonos promo
    if (!bono && isPromoSeptiembreBono(idClean)) {
      bono = Object.values(BONOS_DATA).find((b) => {
        const bId = b.id.toLowerCase();
        if (!isPromoSeptiembreBono(bId)) return false;
        if (idClean.includes("alumno") && !idClean.includes("no_alumno") && !idClean.includes("no alumno")) {
          if (bId.includes("alumno") && !bId.includes("no")) {
            if (idClean.includes("4") && bId.includes("4")) return true;
            if (idClean.includes("8") && bId.includes("8")) return true;
            if (idClean.includes("12") && bId.includes("12")) return true;
          }
        }
        if (idClean.includes("no_alumno") || idClean.includes("no alumno")) {
          if (bId.includes("no_alumno") || bId.includes("no alumno")) {
            if (idClean.includes("4") && bId.includes("4")) return true;
            if (idClean.includes("8") && bId.includes("8")) return true;
            if (idClean.includes("12") && bId.includes("12")) return true;
          }
        }
        if (idClean.includes("4") && bId.includes("4")) return true;
        if (idClean.includes("8") && bId.includes("8")) return true;
        if (idClean.includes("12") && bId.includes("12")) return true;
        return false;
      });
    }

    // 3. Si no es promo, buscar entre bonos regulares
    if (!bono) {
      bono = Object.values(BONOS_DATA).find((b) => {
        if (isPromoSeptiembreBono(b.id)) return false;
        const bId = b.id.toLowerCase();
        if (bId === idClean) return true;
        if (idClean.includes("4") && bId.includes("4")) return true;
        if (idClean.includes("8") && bId.includes("8")) return true;
        if (idClean.includes("10") && bId.includes("10")) return true;
        if (
          (idClean.includes("ilimitad") || idClean.includes("pase")) &&
          bId.includes("ilimitad")
        )
          return true;
        if (
          (idClean.includes("suelta") || idClean.includes("1")) &&
          bId.includes("suelta")
        )
          return true;
        return false;
      });
    }

    if (!bono) {
      return NextResponse.json(
        { success: false, error: "Bono no encontrado o no válido." },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://app.dancefactoryalcorcon.es";

    // Validar alumno en Supabase para determinar descuentos y matrícula
    let isTeacher = Boolean(clientIsTeacher) || isTeacherProfile(undefined, studentEmail);
    let isRegular = Boolean(clientIsRegular);
    let isAlreadyPaid = false;
    let studentVerifiedInDb = false;

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

    if (studentId || studentEmail) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          "https://wjnoawmefdurqqjwqdmi.supabase.co";
        const supabaseAnonKey =
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        let dbStudent: any = null;
        if (studentId && isValidUUID(studentId)) {
          const { data } = await supabase
            .from("alumnos")
            .select("*")
            .eq("id", studentId)
            .maybeSingle();
          dbStudent = data;
        }
        if (!dbStudent && studentEmail) {
          const { data } = await supabase
            .from("alumnos")
            .select("*")
            .ilike("email", studentEmail.trim().toLowerCase())
            .maybeSingle();
          dbStudent = data;
        }

        if (dbStudent) {
          studentVerifiedInDb = true;

          // Regla Docente (-10%)
          if (isTeacherProfile(dbStudent, studentEmail)) {
            isTeacher = true;
          }

          // Matrícula exenta si tiene clases regulares asignadas
          const { data: enrollments } = await supabase
            .from("alumnos_clases")
            .select("clase_id")
            .eq("alumno_id", dbStudent.id);

          const hasEnrollments = Array.isArray(enrollments) && enrollments.length > 0;
          const assignedIds = hasEnrollments
            ? enrollments.map((e: any) => e.clase_id)
            : [];

          isRegular = isRegularClassStudent(dbStudent, {
            assignedClassIds: assignedIds,
            enrollmentsCount: assignedIds.length,
          });

          // Ya pagada esta temporada
          if (hasPaidSeasonMatricula(dbStudent)) {
            isAlreadyPaid = true;
          }
        }
      } catch (checkErr) {
        console.warn("[Redsys Create Payment] Error al consultar Supabase:", checkErr);
        if (clientIsRegular !== undefined) {
          isRegular = Boolean(clientIsRegular);
        }
        if (isFirstBonoOfYear !== undefined) {
          isAlreadyPaid = !Boolean(isFirstBonoOfYear);
        }
      }
    }

    // Regla de Promo de Septiembre
    const isPromo =
      isPromoSeptiembreBono(bono.id) ||
      isPromoSeptiembreBono(bonoId) ||
      Boolean(body.isPromo);

    if (isPromo && !isPromoSeptiembreActive()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La promoción de Open Class de septiembre ha finalizado (vigencia hasta el 30 de septiembre de 2026).",
        },
        { status: 400 }
      );
    }

    // Regla de Matrícula:
    // ¡Los bonos de Promo Septiembre tienen MATRÍCULA 0,00€ GRATUITA SIEMPRE!
    // Para bonos regulares: Exenta si es regular, profesor o ya la pagó.
    const chargeMatricula =
      !isPromo &&
      !isTeacher &&
      !isRegular &&
      !isAlreadyPaid &&
      (studentVerifiedInDb ? true : Boolean(isFirstBonoOfYear !== false));

    // Determinar precio base del bono
    let basePrice = bono.precio;

    // Ajuste dinámico de tarifa DF para bonos promo genéricos
    if (isPromo && (isRegular || isTeacher)) {
      if (bono.id === "promo_sep_4" || bono.id.includes("4")) basePrice = 25.0;
      if (bono.id === "promo_sep_8" || bono.id.includes("8")) basePrice = 35.0;
      if (bono.id === "promo_sep_12" || bono.id.includes("12")) basePrice = 45.0;
    }

    // Calcular precio unitario sin duplicar el descuento docente
    let unitAmount: number;
    if (typeof calculatedPrice === "number" && calculatedPrice > 0) {
      // El cliente ya calculó el precio (con descuento si correspondía)
      // Validamos que el precio calculado sea consistente para evitar manipulaciones
      if (calculatedPrice >= basePrice * 0.85 && calculatedPrice <= basePrice * 1.05) {
        unitAmount = Math.round(calculatedPrice * 100);
      } else {
        unitAmount = isTeacher ? Math.round(basePrice * 0.90 * 100) : Math.round(basePrice * 100);
      }
    } else {
      unitAmount = isTeacher ? Math.round(basePrice * 0.90 * 100) : Math.round(basePrice * 100);
    }

    const matriculaCents = chargeMatricula ? 1500 : 0;
    const totalCents = unitAmount + matriculaCents;
    const totalEurosStr = (totalCents / 100).toFixed(2);

    // Generar identificador de pedido único oficial Redsys (12 caracteres, 4 primeros numéricos)
    const order = createRedsysOrder();

    // Guardar metadatos del pedido para procesar en el webhook
    const metadataObj = {
      studentId: studentId || "",
      studentName: studentName || "",
      studentEmail: studentEmail || "",
      bonoId: bono.id,
      bonoName: bono.nombre,
      clasesCount: bono.clasesCount,
      isTeacher: isTeacher ? "true" : "false",
      isRegularStudent: isRegular ? "true" : "false",
      isPromo: isPromo ? "true" : "false",
      isFirstBono: chargeMatricula ? "true" : "false",
      matriculaCost: chargeMatricula ? "15.00" : "0.00",
      totalAmount: totalEurosStr,
    };

    const merchantDataB64 = Buffer.from(JSON.stringify(metadataObj)).toString("base64");

    const merchantUrl = `${origin}/api/redsys/webhook`;
    const urlOk = `${origin}/clases?tab=bonos&payment=success&order=${order}`;
    const urlKo = `${origin}/clases?tab=bonos&payment=cancelled&order=${order}`;

    // Limpiar descripción de producto eliminando acentos, % o símbolos especiales para Redsys
    const cleanDesc = (bono.nombre + " Dance Factory")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);

    // Parámetros oficiales Redsys SIS
    const merchantParams: Record<string, any> = {
      DS_MERCHANT_AMOUNT: totalCents.toString(),
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_MERCHANTCODE: REDSYS_CONFIG.merchantCode,
      DS_MERCHANT_CURRENCY: REDSYS_CONFIG.currency,
      DS_MERCHANT_TRANSACTIONTYPE: "0",
      DS_MERCHANT_TERMINAL: REDSYS_CONFIG.terminal,
      DS_MERCHANT_MERCHANTURL: merchantUrl,
      DS_MERCHANT_URLOK: urlOk,
      DS_MERCHANT_URLKO: urlKo,
      DS_MERCHANT_PRODUCTDESCRIPTION: cleanDesc,
      DS_MERCHANT_MERCHANTNAME: "Dance Factory",
      DS_MERCHANT_MERCHANTDATA: merchantDataB64,
    };

    // Si el usuario eligió Bizum explícitamente, o tarjeta
    if (payMethod === "z") {
      merchantParams.DS_MERCHANT_PAYMETHODS = "z";
    } else if (payMethod === "T") {
      merchantParams.DS_MERCHANT_PAYMETHODS = "T";
    }

    const merchantParamsB64 = Buffer.from(JSON.stringify(merchantParams)).toString(
      "base64"
    );

    const signature = createMerchantSignature({
      secretKey: REDSYS_CONFIG.secretKey,
      order,
      merchantParamsB64,
    });

    console.log(
      `[Redsys Create Payment] Bono=${bono.nombre}, Base=${basePrice}€, Matrícula=${chargeMatricula ? "15€" : "0€"}, Total=${totalEurosStr}€ (Order: ${order})`
    );

    return NextResponse.json({
      success: true,
      order,
      formUrl: REDSYS_CONFIG.url,
      params: {
        Ds_SignatureVersion: "HMAC_SHA256_V1",
        Ds_MerchantParameters: merchantParamsB64,
        Ds_Signature: signature,
      },
      amountEuros: totalEurosStr,
      chargeMatricula,
      bono,
    });
  } catch (error: any) {
    console.error("[Redsys Create Payment Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al generar la sesión de pago de Redsys.",
      },
      { status: 500 }
    );
  }
}
