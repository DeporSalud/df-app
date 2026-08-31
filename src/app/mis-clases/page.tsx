"use client";

import { useState, useEffect } from "react";
import { 
  QrCode, 
  Calendar, 
  User, 
  Clock, 
  MapPin, 
  CheckCircle, 
  Info, 
  BookmarkCheck, 
  ArrowRight, 
  Sparkles, 
  Trash2, 
  AlertTriangle,
  Flame,
  CheckCircle2,
  CalendarDays
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useStudent } from "@/context/StudentContext";
import AppModal, { ModalState } from "@/components/AppModal";
import { logActivity } from "@/lib/activityLogger";
import StudentBottomNav from "@/components/StudentBottomNav";
import TeacherPortalView from "@/components/TeacherPortalView";
import { 
  getReservasAlumno, 
  cancelarReservaOpenClass, 
  OpenClassReserva, 
  formatSedeName 
} from "@/lib/openClassService";

export default function MisClasesPage() {
  const router = useRouter();
  const { userRole, currentStudent, isLoading: isAuthLoading, isAuthenticated, refetchStudents } = useStudent();

  const [myRegularClasses, setMyRegularClasses] = useState<any[]>([]);
  const [openClassBookings, setOpenClassBookings] = useState<OpenClassReserva[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  if (userRole === "profesor") {
    return <TeacherPortalView initialTab="mis_clases" />;
  }

  const loadAllBookings = async () => {
    if (!currentStudent?.id) return;
    setIsLoading(true);

    // 1. Fetch regular classes assigned in Supabase (excluding Open Class and Formaciones)
    const { data: assigned } = await supabase
      .from("alumnos_clases")
      .select("clase_id, clases_cuadrante (*)")
      .eq("alumno_id", currentStudent.id);

    if (assigned && assigned.length > 0) {
      const regularList = assigned
        .map((a: any) => a.clases_cuadrante)
        .filter(Boolean)
        .filter((c: any) => 
          !c.nombre_clase.toUpperCase().includes("OPEN CLASS") &&
          !c.nombre_clase.toUpperCase().includes("FORMACI")
        );
      setMyRegularClasses(regularList);
    } else {
      setMyRegularClasses([]);
    }

    // 2. Fetch Open Class calendar bookings
    const bookings = getReservasAlumno(currentStudent.id);
    setOpenClassBookings(bookings);

    setIsLoading(false);
  };

  useEffect(() => {
    loadAllBookings();

    const handleUpdate = () => {
      if (currentStudent?.id) {
        setOpenClassBookings(getReservasAlumno(currentStudent.id));
      }
    };
    window.addEventListener("df_reservas_updated", handleUpdate);
    return () => window.removeEventListener("df_reservas_updated", handleUpdate);
  }, [currentStudent?.id]);

  const handleCancelarReservaOpenClass = (reserva: OpenClassReserva) => {
    setModal({
      isOpen: true,
      title: "¿Cancelar Reserva?",
      message: `¿Estás seguro de que deseas cancelar tu reserva para la sesión de "${reserva.nombre_clase}" del ${reserva.fecha_formateada}?\n\nAl cancelar, se reembolsará automáticamente 1 clase a tu saldo de bono.`,
      type: "warning",
      showCancel: true,
      confirmText: "Sí, Cancelar Reserva",
      onConfirm: () => executeCancelarReservaOpenClass(reserva)
    });
  };

  const executeCancelarReservaOpenClass = async (reserva: OpenClassReserva) => {
    if (!currentStudent?.id) return;

    // 1. Cancel in service
    cancelarReservaOpenClass(reserva.id);

    // 2. Refund 1 class to student's bono
    const hasUnlimited = currentStudent.plan_activo?.toLowerCase().includes("ilimitad");
    if (!hasUnlimited) {
      const remainingClasses = typeof currentStudent.clases_restantes === "number" ? currentStudent.clases_restantes : 0;
      const updatedBalance = remainingClasses + 1;
      await supabase.from("alumnos").update({ clases_restantes: updatedBalance }).eq("id", currentStudent.id);
      if (refetchStudents) await refetchStudents();
    }

    // 3. Delete from alumnos_clases in Supabase if exists
    try {
      if (reserva.clase_id && currentStudent.id) {
        await supabase
          .from("alumnos_clases")
          .delete()
          .eq("alumno_id", currentStudent.id)
          .eq("clase_id", reserva.clase_id);
      }
    } catch (e) {
      console.warn("Could not delete from alumnos_clases:", e);
    }

    // Audit Log
    logActivity({
      origen: "alumno",
      tipo_evento: "reserva_bono",
      descripcion: `Cancelación de reserva de Open Class para el ${reserva.fecha_formateada}: "${reserva.nombre_clase}" (Se reembolsa 1 clase al bono)`,
      usuario_afectado: currentStudent.nombre_completo,
      sede: formatSedeName(reserva.sede)
    });

    setModal({
      isOpen: true,
      title: "✓ Reserva Cancelada",
      message: `Has cancelado tu reserva para la sesión de "${reserva.nombre_clase}" del ${reserva.fecha_formateada}.\n\nSe ha devuelto 1 clase a tu saldo de bono.`,
      type: "success",
      confirmText: "Entendido"
    });

    loadAllBookings();
  };

  const totalClassesCount = myRegularClasses.length + openClassBookings.length;

  if (isAuthLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col flex-1 w-full bg-[var(--color-bg)] overflow-x-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36">
        {/* Header */}
        <header className="p-6 pt-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40">
          <div>
            <p className="text-[10px] text-[var(--color-secondary)] font-bold uppercase tracking-wider">Tus Clases & Reservas</p>
            <h1 className="text-2xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
              Mis Clases
            </h1>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs">
            <BookmarkCheck size={20} />
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-6">
          
          {isLoading ? (
            <div className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
              Cargando tus clases inscritas...
            </div>
          ) : totalClassesCount === 0 ? (
            /* Estado Vacío */
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 text-center space-y-5 shadow-xl my-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-secondary)] mx-auto flex items-center justify-center shadow-lg">
                <Sparkles size={32} />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">
                  Aún no tienes clases reservadas
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mx-auto">
                  Explora las sesiones de <strong>Open Class en el calendario</strong> o consulta tus cursos regulares para apuntarte.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <Link
                  href="/clases?tab=openclass"
                  className="w-full py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Flame size={16} />
                  <span>Ver Calendario de Open Class</span>
                  <ArrowRight size={14} />
                </Link>

                <Link
                  href="/clases?tab=regulares"
                  className="w-full py-3 px-4 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Explorar Clases Regulares</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* SECCIÓN 1: RESERVAS DE OPEN CLASS POR CALENDARIO */}
              {openClassBookings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <h2 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Flame size={14} className="text-amber-400" />
                      <span>Sesiones de Open Class en Calendario ({openClassBookings.length})</span>
                    </h2>
                    <span className="text-[10px] text-amber-400 font-mono font-bold">
                      Saldo: {currentStudent?.clases_restantes || 0} clases
                    </span>
                  </div>

                  <div className="space-y-3">
                    {openClassBookings.map((reserva) => (
                      <div 
                        key={reserva.id}
                        className="rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-[var(--color-bg-card)] to-[var(--color-bg-card)] p-5 shadow-xl space-y-3"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                <Flame size={11} />
                                Open Class
                              </span>
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                ✓ Plaza Confirmada
                              </span>
                            </div>

                            <h3 className="text-lg font-[family-name:var(--font-heading)] text-white tracking-wide">
                              {reserva.nombre_clase}
                            </h3>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              Profesor/a: <strong className="text-white">{reserva.profesor}</strong>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-amber-400 font-mono font-bold text-sm bg-amber-500/15 px-2.5 py-1 rounded-xl border border-amber-500/30">
                              <Clock size={13} />
                              <span>{reserva.hora_inicio}h</span>
                            </div>
                          </div>
                        </div>

                        {/* Fecha y Sala */}
                        <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-white font-bold font-mono">
                            <CalendarDays size={15} className="text-amber-400" />
                            <span>📅 {reserva.fecha_formateada}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            {formatSedeName(reserva.sede)}
                          </span>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleCancelarReservaOpenClass(reserva)}
                            className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-xl border border-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Cancelar Reserva (Devolver 1 clase)</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN 2: CURSOS REGULARES */}
              {myRegularClasses.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                    <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <BookmarkCheck size={14} className="text-[var(--color-primary)]" />
                      <span>Tus Cursos Regulares Semanales ({myRegularClasses.length})</span>
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {myRegularClasses.map((clase) => (
                      <div 
                        key={clase.id}
                        className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-lg space-y-2"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-primary)]/20 inline-block mb-1">
                              {clase.dia_semana}
                            </span>
                            <h3 className="text-lg font-[family-name:var(--font-heading)] text-white tracking-wide">
                              {clase.nombre_clase}
                            </h3>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              Profesor/a: <strong className="text-white">{clase.profesor}</strong>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-[var(--color-primary)] font-mono font-bold text-sm bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-xl border border-[var(--color-primary)]/20">
                              <Clock size={13} />
                              <span>{clase.hora_inicio}h</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs text-slate-400">
                          <span>Sede: <strong className="text-white">{formatSedeName(clase.sede)}</strong></span>
                          <span className="text-emerald-400 font-semibold">✓ Matrícula Regular</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón rápido para reservar más Open Classes */}
              <div className="pt-3">
                <Link
                  href="/clases?tab=openclass"
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Flame size={16} />
                  <span>Reservar Otra Open Class en el Calendario</span>
                </Link>
              </div>
            </>
          )}

        </main>
      </div>

      {/* Universal Alert Modal */}
      <AppModal 
        modal={modal}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Persistent Bottom Navigation */}
      <StudentBottomNav />
    </div>
  );
}
