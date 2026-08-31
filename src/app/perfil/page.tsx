"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, QrCode, Calendar, Shield, MapPin, Phone, Mail, FileText, Clock, Info, MessageSquare, Lock, LogOut, BookmarkCheck, GraduationCap, Tag, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/context/StudentContext";
import { supabase } from "@/lib/supabase/client";
import StudentBottomNav from "@/components/StudentBottomNav";
import { formatSedeName } from "@/lib/openClassService";

export default function PerfilPage() {
  const router = useRouter();
  const { userRole, currentStudent, currentTeacher, isLoading, isAuthenticated, logout } = useStudent();
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasStudentSession = !!localStorage.getItem("df_student_session_id");
      const hasTeacherSession = !!localStorage.getItem("df_teacher_session_id");
      if (!isLoading && !isAuthenticated && !hasStudentSession && !hasTeacherSession) {
        router.push("/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentStudent?.id || userRole === "profesor") return;
      setHistoryLoading(true);

      const { data } = await supabase
        .from("asistencias")
        .select(`
          id,
          fecha_hora,
          clases_cuadrante (nombre_clase, profesor, dia_semana, hora_inicio)
        `)
        .eq("alumno_id", currentStudent.id)
        .order("fecha_hora", { ascending: false })
        .limit(10);

      setHistory(data || []);
      setHistoryLoading(false);
    };

    if (currentStudent?.id && userRole === "alumno") {
      fetchHistory();
    }
  }, [currentStudent?.id, userRole]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  // ========================================================
  // PERFIL PROFESOR
  // ========================================================
  if (userRole === "profesor") {
    const teacherName = currentTeacher?.name || "LUCÍA MUÑOZ";

    return (
      <div className="flex flex-col flex-1 w-full bg-[var(--color-bg)] overflow-x-hidden text-left">
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36">
          <header className="p-6 pt-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40">
            <div>
              <p className="text-[10px] text-[var(--color-secondary)] font-bold uppercase tracking-wider">Ficha Oficial Docente</p>
              <h1 className="text-2xl font-[family-name:var(--font-heading)] text-white tracking-wide">
                {teacherName}
              </h1>
            </div>
            <button
              onClick={logout}
              title="Cerrar Sesión"
              className="p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-slate-400 hover:text-white hover:border-[var(--color-danger)] transition-all flex items-center justify-center cursor-pointer"
            >
              <LogOut size={18} />
            </button>
          </header>

          <main className="p-6 space-y-6">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white font-bold text-2xl shadow-lg shrink-0">
                  {teacherName.split(" ").slice(0, 2).map(n => n[0]).join("")}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white font-[family-name:var(--font-heading)]">
                    {teacherName}
                  </h2>
                  <span className="inline-block px-2.5 py-0.5 bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] text-[10px] font-bold rounded-full border border-[var(--color-secondary)]/25 mt-1 uppercase">
                    Profesor Oficial Dance Factory
                  </span>
                </div>
              </div>

              <div className="border-t border-[var(--color-border)] pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Especialidad Principal:</span>
                  <strong className="text-white">{currentTeacher?.especialidad || "Danza"}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Sede Habitual:</span>
                  <strong className="text-white">{currentTeacher?.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Email Corporativo:</span>
                  <strong className="text-white">{currentTeacher?.email || "docente@dancefactory.es"}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Código PIN de Sala:</span>
                  <span className="font-mono text-[var(--color-secondary)] font-bold">{currentTeacher?.pin}</span>
                </div>
              </div>
            </div>

            {/* Accesos Rápidos de Profesor */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/"
                className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-secondary)] transition-all space-y-2 group shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Mis Clases</h4>
                  <p className="text-[11px] text-slate-400">Pase de lista digital</p>
                </div>
              </Link>

              <Link
                href="/clases?tab=bonos"
                className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-secondary)] transition-all space-y-2 group shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Tag size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Bonos (-10%)</h4>
                  <p className="text-[11px] text-slate-400">Tarifas docentes</p>
                </div>
              </Link>
            </div>

            {/* Botón Cerrar Sesión */}
            <button
              onClick={logout}
              className="w-full py-3.5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión de Profesor</span>
            </button>
          </main>
        </div>

        <StudentBottomNav />
      </div>
    );
  }

  // ========================================================
  // PERFIL ALUMNO
  // ========================================================
  const waPhone = "34695674305";
  const studentName = currentStudent?.nombre_completo || "Alumno";
  const studentDni = currentStudent?.dni || "N/A";
  const waMessage = encodeURIComponent("Hola Dance Factory, soy " + studentName + " (DNI: " + studentDni + "). Me gustaría solicitar un cambio en mi información de perfil / matrícula.");
  const waUrl = "https://wa.me/" + waPhone + "?text=" + waMessage;

  return (
    <div className="flex flex-col flex-1 w-full bg-[var(--color-bg)] overflow-x-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36">
        {/* Header */}
        <header className="p-6 pt-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40">
          <div>
            <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Ficha Oficial de Alumno</p>
            <h1 className="text-2xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
              {currentStudent?.nombre_completo || "Mi Perfil"}
            </h1>
          </div>
          <button
            onClick={logout}
            title="Cerrar Sesión"
            className="p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-danger)] transition-all flex items-center justify-center cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-6 text-left">
          
          {/* Tarjeta de Identificación */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-[var(--color-primary)]/20 shrink-0">
                {currentStudent?.nombre_completo ? (
                  currentStudent.nombre_completo.split(" ").slice(0, 2).map((n) => n[0]).join("")
                ) : (
                  <User size={28} />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-white truncate">
                  {currentStudent?.nombre_completo}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10">
                    DNI: {currentStudent?.dni || "No registrado"}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {currentStudent?.estado || "Activo"}
                  </span>
                </div>
              </div>
            </div>

            {/* Datos Personales */}
            <div className="border-t border-[var(--color-border)] pt-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] flex items-center gap-2">
                  <Mail size={14} className="text-[var(--color-primary)]" />
                  Email:
                </span>
                <span className="font-semibold text-white">{currentStudent?.email || "Sin email"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] flex items-center gap-2">
                  <Phone size={14} className="text-[var(--color-primary)]" />
                  Teléfono:
                </span>
                <span className="font-semibold text-white">{currentStudent?.telefono || "Sin teléfono"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] flex items-center gap-2">
                  <MapPin size={14} className="text-[var(--color-primary)]" />
                  Sede Asignada:
                </span>
                <span className="font-semibold text-white">{formatSedeName(currentStudent?.sede || "tejar")}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] flex items-center gap-2">
                  <Calendar size={14} className="text-[var(--color-primary)]" />
                  Plan Activo:
                </span>
                <span className="font-semibold text-[var(--color-primary-hover)]">{currentStudent?.plan_activo || "Sin Plan"}</span>
              </div>
            </div>
          </div>

          {/* Botón WhatsApp Recepción */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <MessageSquare size={16} className="text-emerald-400" />
              <span>¿Necesitas modificar tus datos o clases?</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Por motivos de seguridad y control de aforo en sala, cualquier cambio de horario, sede o datos personales debe ser gestionado a través de recepción.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Contactar con Recepción por WhatsApp (+34 695 67 43 05)</span>
            </a>
          </div>

          {/* Historial Reciente de Asistencias */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] px-1 flex items-center gap-2">
              <Clock size={14} />
              <span>Últimas Asistencias Registradas</span>
            </h3>

            {historyLoading ? (
              <p className="text-xs text-slate-500 py-4 text-center">Cargando asistencias...</p>
            ) : history.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center text-xs text-slate-400">
                Aún no tienes registros de asistencia presencial en esta temporada.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="block text-white font-semibold">
                        {item.clases_cuadrante?.nombre_clase || "Clase Presencial"}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        {item.clases_cuadrante?.profesor ? "Prof. " + item.clases_cuadrante.profesor : "Dance Factory"}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {new Date(item.fecha_hora).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón Cerrar Sesión */}
          <button
            onClick={logout}
            className="w-full py-3.5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>

        </main>
      </div>

      {/* Fixed Bottom Navigation */}
      <StudentBottomNav />
    </div>
  );
}
