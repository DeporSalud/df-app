import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/mailer";

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

    // Send email using Hostinger SMTP
    const result = await sendOtpEmail({
      email: email.trim().toLowerCase(),
      code: code.trim(),
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
      message: `Código enviado con éxito a ${email}`,
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
