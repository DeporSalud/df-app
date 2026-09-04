import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { sendBonoExpiringEmail } from "@/lib/mailer";
import { logActivity } from "@/lib/activityLogger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleExpirationCheck(request);
}

export async function POST(request: NextRequest) {
  return handleExpirationCheck(request);
}

async function handleExpirationCheck(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const testEmail = searchParams.get("testEmail");

    const now = new Date();
    const processedList: any[] = [];
    let emailsSent = 0;

    // 1. Obtener alumnos con clases restantes a su favor
    let query = supabase
      .from("alumnos")
      .select("id, nombre_completo, email, plan_activo, clases_restantes, bono_caducidad, creado_en")
      .not("clases_restantes", "is", null)
      .gt("clases_restantes", 0);

    if (testEmail) {
      query = query.ilike("email", testEmail);
    }

    const { data: students, error } = await query;

    if (error) {
      console.error("[Check Expirations] Error al consultar alumnos:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No se encontraron alumnos con bonos activos o saldo de clases pendiente.",
        processedCount: 0,
        emailsSent: 0,
      });
    }

    // 2. Comprobar cada alumno
    for (const student of students) {
      const email = student.email?.trim();
      if (!email) continue;

      // Calcular fecha de expiración (desde base de datos o por defecto a 30 días de la creación)
      let expDate: Date;
      if (student.bono_caducidad) {
        expDate = new Date(student.bono_caducidad);
      } else {
        const base = student.creado_en ? new Date(student.creado_en) : new Date("2026-09-04T00:00:00Z");
        expDate = new Date(base);
        expDate.setMonth(expDate.getMonth() + 1);
      }

      const diffMs = expDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Si le quedan 7 días o menos y el bono aún no ha expirado del todo
      const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
      const isExpired = daysLeft <= 0;

      const fechaCaducidadStr = expDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const studentReport: any = {
        id: student.id,
        nombre: student.nombre_completo,
        email,
        clases_restantes: student.clases_restantes,
        fecha_caducidad: fechaCaducidadStr,
        dias_restantes: daysLeft,
        estado_aviso: "no_requerido",
      };

      if (isExpiringSoon || (force && student.clases_restantes > 0)) {
        // Comprobar si ya se le envió aviso en las últimas 24 horas para evitar duplicados
        let yaNotificado = false;
        if (!force) {
          try {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recentLogs } = await supabase
              .from("registros_actividad")
              .select("id")
              .eq("usuario_afectado", student.id)
              .eq("tipo_evento", "aviso_caducidad_bono")
              .gte("created_at", yesterday)
              .limit(1);

            if (recentLogs && recentLogs.length > 0) {
              yaNotificado = true;
            }
          } catch {
            // Continuar si la tabla no está disponible
          }
        }

        if (yaNotificado) {
          studentReport.estado_aviso = "ya_notificado_recientemente";
        } else {
          // Enviar correo de aviso
          const mailResult = await sendBonoExpiringEmail({
            email,
            studentName: student.nombre_completo,
            clasesRestantes: student.clases_restantes,
            fechaCaducidad: fechaCaducidadStr,
            diasRestantes: Math.max(1, daysLeft),
          });

          if (mailResult.success) {
            emailsSent++;
            studentReport.estado_aviso = "enviado";
            studentReport.messageId = mailResult.messageId;

            // Registrar en historial de actividad
            await logActivity({
              origen: "recepcion",
              tipo_evento: "aviso_caducidad_bono" as any,
              descripcion: `Aviso de caducidad de bono enviado (${student.clases_restantes} clases restantes, caduca el ${fechaCaducidadStr})`,
              usuario_afectado: student.id,
              detalles: `Enviado a ${email}. Quedan ${daysLeft} días.`,
              sede: "Studio 2 Paseo Castilla",
            });
          } else {
            studentReport.estado_aviso = "error_envio";
            studentReport.error = mailResult.error;
          }
        }
      } else if (isExpired) {
        studentReport.estado_aviso = "bono_ya_caducado";
      }

      processedList.push(studentReport);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount: processedList.length,
      emailsSent,
      students: processedList,
    });
  } catch (error: any) {
    console.error("[Check Expirations Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar la verificación de caducidad." },
      { status: 500 }
    );
  }
}
