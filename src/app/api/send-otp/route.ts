import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/mailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wjnoawmefdurqqjwqdmi.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_dWudcdKMOeKH22g0IRKV7w_bxWNtEh2";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, name } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Correo electrónico no válido." },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Código OTP inválido (debe tener 6 dígitos)." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // 1. Sync OTP directly to Supabase alumnos.nfc_token for 100% reliable verification
    try {
      await supabase
        .from("alumnos")
        .update({ nfc_token: cleanCode })
        .ilike("email", cleanEmail);
    } catch (dbErr) {
      console.warn("[API /api/send-otp] Aviso al guardar token en Supabase:", dbErr);
    }

    // 2. Send email using Hostinger SMTP
    const result = await sendOtpEmail({
      email: cleanEmail,
      code: cleanCode,
      studentName: name ? String(name).trim() : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "No se pudo enviar el correo electrónico." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Código enviado con éxito a ${cleanEmail}`,
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error("[API /api/send-otp] Error en el servidor:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar el envío de OTP." },
      { status: 500 }
    );
  }
}
