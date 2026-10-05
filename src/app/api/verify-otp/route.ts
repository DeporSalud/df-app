import { NextRequest, NextResponse } from "next/server";
import { verifyServerOtp, clearServerOtp } from "@/lib/serverOtpStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, action } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Correo electrónico requerido." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    if (action === "clear") {
      clearServerOtp(cleanEmail);
      return NextResponse.json({ success: true, message: "OTP limpiado." });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Código OTP requerido." },
        { status: 400 }
      );
    }

    const cleanCode = code.trim();
    const result = verifyServerOtp(cleanEmail, cleanCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Código de acceso incorrecto o expirado." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Código verificado correctamente.",
    });
  } catch (error: any) {
    console.error("[API /api/verify-otp] Error en el servidor:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al verificar el código OTP." },
      { status: 500 }
    );
  }
}
