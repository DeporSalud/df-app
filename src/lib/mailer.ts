import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false";
const SMTP_USER = process.env.SMTP_USER || "registro@deporsalud.es";
const SMTP_PASS = process.env.SMTP_PASS || "=l7p*H=jaj2X";
const SMTP_FROM = process.env.SMTP_FROM || '"Dance Factory" <registro@deporsalud.es>';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendOtpEmail({
  email,
  code,
  studentName,
}: {
  email: string;
  code: string;
  studentName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const formattedCode = code.split("").join(" ");
    const nameGreeting = studentName ? `Hola ${studentName},` : "Hola,";

    const mailOptions = {
      from: SMTP_FROM,
      to: email,
      subject: `🔑 ${code} es tu código de acceso a Dance Factory`,
      text: `Dance Factory Alcorcón\n\n${nameGreeting}\n\nTu código de verificación de un solo uso (OTP) es: ${code}\n\nEste código es válido durante 10 minutos. Introdúcelo en la aplicación para activar tu carnet digital y acceder a tus clases.\n\nSi no has solicitado este código, puedes ignorar este mensaje.\n\nDance Factory Alcorcón • Plaza El Tejar 2 / Paseo Castilla 21`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Código de Verificación - Dance Factory</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #070b16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b16; padding: 30px 10px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="500" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #0b132b; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                  
                  <!-- Header Logo Banner -->
                  <tr>
                    <td style="padding: 32px 24px 20px 24px; text-align: center; background: linear-gradient(180deg, rgba(29,78,216,0.15) 0%, rgba(11,19,43,0) 100%);">
                      <div style="display: inline-block; background-color: #1c2541; padding: 12px 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 12px;">
                        <span style="font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #3b82f6;">DANCE FACTORY</span>
                      </div>
                      <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2.5px;">App Oficial • Alumnos</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 10px 28px 24px 28px; text-align: center;">
                      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Tu Código de Acceso OTP</h1>
                      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">
                        ${nameGreeting} introduce el siguiente código de 6 dígitos en la aplicación para activar tu cuenta de alumno:
                      </p>

                      <!-- 6-Digit Code Container -->
                      <div style="background-color: #1c2541; border: 2px solid #1d4ed8; border-radius: 18px; padding: 18px 24px; margin: 0 auto 24px auto; display: inline-block; box-shadow: 0 8px 24px rgba(29,78,216,0.25);">
                        <span style="font-size: 34px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 10px; color: #60a5fa;">
                          ${code}
                        </span>
                      </div>

                      <!-- Security Notice -->
                      <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; text-align: left;">
                        <table border="0" cellspacing="0" cellpadding="0" width="100%">
                          <tr>
                            <td width="20" style="vertical-align: top; padding-right: 8px;">
                              <span style="font-size: 14px;">⏱️</span>
                            </td>
                            <td style="font-size: 12px; color: #cbd5e1; line-height: 1.4;">
                              Este código es de <strong>un solo uso</strong> y caduca en <strong>10 minutos</strong>. Por seguridad, no lo compartas con nadie.
                            </td>
                          </tr>
                        </table>
                      </div>

                      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">
                        Si tú no has solicitado este código de registro, puedes desestimar este correo con total tranquilidad.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 18px 24px; background-color: #070b16; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                      <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #94a3b8;">
                        Dance Factory Alcorcón
                      </p>
                      <p style="margin: 0; font-size: 10px; color: #475569;">
                        Studio 1: Plaza El Tejar, 2 • Studio 2: Paseo Castilla, 21 • Alcorcón, Madrid
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] ✅ Correo OTP enviado con éxito a ${email}. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Mailer] ❌ Error al enviar correo OTP a ${email}:`, error);
    return { success: false, error: error.message || "Error al enviar el correo." };
  }
}

export async function sendBonoExpiringEmail({
  email,
  studentName,
  clasesRestantes,
  fechaCaducidad,
  diasRestantes,
}: {
  email: string;
  studentName: string;
  clasesRestantes: number;
  fechaCaducidad: string;
  diasRestantes: number;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const greeting = studentName ? `Hola ${studentName},` : "Hola,";
    const subject = `⏰ Te quedan ${clasesRestantes} clases • Tu bono Dance Factory caduca en ${diasRestantes} días`;

    const mailOptions = {
      from: SMTP_FROM,
      to: email,
      subject,
      text: `Dance Factory Alcorcón\n\n${greeting}\n\nTe recordamos que a tu bono de Open Classes le quedan ${diasRestantes} días de validez y caduca el próximo ${fechaCaducidad}.\n\nActualmente tienes ${clasesRestantes} clases disponibles por disfrutar. ¡Aprovecha estos días para no perderlas y reserva ya tu plaza desde la aplicación!\n\nReservar clases: https://app.dancefactoryalcorcon.es/clases?tab=openclass\n\nDance Factory Alcorcón • Studio 2: Paseo Castilla 21 • Tel / WhatsApp: +34 695 67 43 05`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aviso de Caducidad de Bono - Dance Factory</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #070b16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b16; padding: 30px 10px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="520" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #0b132b; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                  
                  <!-- Header Warning Banner -->
                  <tr>
                    <td style="padding: 28px 24px 18px 24px; text-align: center; background: linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(11, 19, 43, 0) 100%);">
                      <div style="display: inline-block; background-color: #1c2541; padding: 10px 18px; border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 12px;">
                        <span style="font-size: 18px; font-weight: 900; letter-spacing: 2px; color: #fbbf24;">DANCE FACTORY</span>
                      </div>
                      <p style="margin: 0; font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px;">⚠️ Aviso Importante de Bono</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 10px 28px 24px 28px; text-align: center;">
                      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                        ¡Tu bono de clases caduca pronto!
                      </h1>
                      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: left;">
                        ${greeting} queremos recordarte que la validez de tu bono de <strong>Open Classes</strong> está próxima a finalizar. Te quedan solo <strong>${diasRestantes} días</strong> para disfrutar de tus clases pendientes.
                      </p>

                      <!-- Balance & Expiration Card -->
                      <div style="background-color: #16203d; border: 2px solid #f59e0b; border-radius: 18px; padding: 20px; margin: 0 auto 24px auto; text-align: center; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.15);">
                        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #fbbf24;">
                          CLASES PENDIENTES
                        </p>
                        <p style="margin: 0 0 8px 0; font-size: 42px; font-weight: 900; font-family: 'Courier New', monospace; color: #ffffff;">
                          ${clasesRestantes} <span style="font-size: 18px; font-weight: 700; color: #fbbf24;">clases</span>
                        </p>
                        <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 6px 14px; border-radius: 20px;">
                          <span style="font-size: 12px; font-weight: 600; color: #fde68a;">
                            🗓️ Fecha límite: <strong>${fechaCaducidad}</strong>
                          </span>
                        </div>
                      </div>

                      <!-- Call to Action Button -->
                      <div style="margin: 24px 0;">
                        <a href="https://app.dancefactoryalcorcon.es/clases?tab=openclass" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #020617; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 14px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);">
                          👉 Reservar Mis Clases Ahora
                        </a>
                      </div>

                      <!-- Info details -->
                      <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; text-align: left;">
                        <table border="0" cellspacing="0" cellpadding="0" width="100%">
                          <tr>
                            <td width="24" style="vertical-align: top; padding-right: 10px;">
                              <span style="font-size: 16px;">📍</span>
                            </td>
                            <td style="font-size: 12px; color: #cbd5e1; line-height: 1.5;">
                              <strong>Ubicación de Open Classes:</strong><br/>
                              Studio 2 • Paseo Castilla, 21 (Alcorcón). Recuerda que las plazas por sesión son limitadas.
                            </td>
                          </tr>
                        </table>
                      </div>

                      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">
                        Si tienes cualquier duda o necesitas ampliar información, puedes escribirnos por WhatsApp al <strong>+34 695 67 43 05</strong>.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 18px 24px; background-color: #070b16; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                      <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #94a3b8;">
                        Dance Factory Alcorcón
                      </p>
                      <p style="margin: 0; font-size: 10px; color: #475569;">
                        Plaza El Tejar, 2 • Paseo Castilla, 21 • Alcorcón, Madrid
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] ✅ Correo de aviso de caducidad enviado a ${email}. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Mailer] ❌ Error al enviar aviso de caducidad a ${email}:`, error);
    return { success: false, error: error.message || "Error al enviar el correo." };
  }
}

