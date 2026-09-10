import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wjnoawmefdurqqjwqdmi.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const order = searchParams.get("order");
    const studentId = searchParams.get("studentId");

    if (!studentId && !order) {
      return NextResponse.json(
        { success: false, error: "Parámetros insuficientes." },
        { status: 400 }
      );
    }

    let studentData: any = null;

    if (studentId) {
      const { data } = await supabase
        .from("alumnos")
        .select("id, nombre_completo, clases_restantes, plan_activo, matricula_pagada, bono_caducidad")
        .eq("id", studentId)
        .maybeSingle();
      studentData = data;
    }

    // Comprobar si hay registro de pago para este pedido
    let pagoData: any = null;
    if (order) {
      const { data } = await supabase
        .from("pagos")
        .select("*")
        .ilike("numero_recibo", `%${order}%`)
        .maybeSingle();
      pagoData = data;
    }

    return NextResponse.json({
      success: true,
      order,
      paid: true,
      student: studentData,
      payment: pagoData,
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
