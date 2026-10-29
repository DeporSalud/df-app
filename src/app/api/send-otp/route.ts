import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/mailer";
import { storeServerOtp } from "@/lib/serverOtpStore";

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

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json(
        { success: false, error: "Código OTP inválido (debe tener 6 dígitos)." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // 1. Guardar código en el almacén rolling del servidor + generar firma HMAC sin estado
    const { otpToken, expiresAt } = storeServerOtp(cleanEmail, cleanCode);

    // 2. Enviar correo usando Hostinger SMTP oficial (con reintento automático)
    const result = await sendOtpEmail({
      email: cleanEmail,
      code: cleanCode,
      studentName: name ? String(name).trim() : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            "No se pudo entregar el correo en este momento. Inténtalo de nuevo o pide tu código de acceso en Recepción.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Código enviado con éxito a ${cleanEmail}`,
      messageId: result.messageId,
      otpToken,
      expiresAt,
    });
  } catch (error: any) {
    console.error("[API /api/send-otp] Error en el servidor:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar el envío de OTP." },
      { status: 500 }
    );
  }
}
