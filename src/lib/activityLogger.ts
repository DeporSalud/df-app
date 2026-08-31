import { supabase } from './supabase/client';

export type ActivityOrigin = 'recepcion' | 'profesor' | 'alumno' | 'seguridad';
export type ActivityType = 
  | 'checkin'
  | 'reserva_bono'
  | 'cobro_bono'
  | 'compra_bono_stripe'
  | 'inscripcion_clase'
  | 'alta_alumno'
  | 'baja_alumno'
  | 'edicion_alumno'
  | 'asistencia_profesor'
  | 'asistencia_pase_lista'
  | 'asistencia_cancelada'
  | 'solicitud_bono'
  | 'seguridad_intento_fallido'
  | 'seguridad_bloqueo'
  | 'seguridad_desbloqueo'
  | 'email_credenciales';

export interface ActivityLogItem {
  id?: string;
  created_at?: string;
  origen: ActivityOrigin;
  tipo_evento: ActivityType;
  descripcion: string;
  usuario_afectado: string;
  detalles?: string;
  sede?: string;
}

export async function logActivity(item: ActivityLogItem) {
  try {
    const payload = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
      origen: item.origen,
      tipo_evento: item.tipo_evento,
      descripcion: item.descripcion,
      usuario_afectado: item.usuario_afectado,
      detalles: item.detalles || "",
      sede: item.sede || "General"
    };

    // Save to local logs queue for instant sync
    saveToLocalLogs(payload);

    // Persist to Supabase asynchronously without blocking execution
    (async () => {
      try {
        const { error } = await supabase.from("registros_actividad").insert([payload]);
        if (error) {
          console.log("Registros actividad DB note:", error.message);
        }
      } catch (err) {
        // Silent catch
      }
    })();
  } catch (e) {
    console.warn("Activity logger silent catch:", e);
  }
}

function saveToLocalLogs(payload: any) {
  try {
    if (typeof window === "undefined") return;
    const logs = JSON.parse(localStorage.getItem("df_activity_logs") || "[]");
    if (!logs.some((l: any) => l.id === payload.id)) {
      logs.unshift(payload);
      if (logs.length > 300) logs.length = 300;
      localStorage.setItem("df_activity_logs", JSON.stringify(logs));
      window.dispatchEvent(new Event("df_activity_updated"));
    }
  } catch (e) {
    // Silent catch
  }
}
