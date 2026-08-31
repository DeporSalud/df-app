"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, User, QrCode, CreditCard, ShieldCheck, MapPin, Sparkles, LogOut, BookmarkCheck, Ticket, Flame } from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/context/StudentContext";
import StudentBottomNav from "@/components/StudentBottomNav";
import TeacherPortalView from "@/components/TeacherPortalView";

export default function AppHome() {
  const router = useRouter();
  const { userRole, currentStudent, currentTeacher, isLoading, isAuthenticated, logout } = useStudent();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasStudentSession = !!localStorage.getItem("df_student_session_id");
      const hasTeacherSession = !!localStorage.getItem("df_teacher_session_id");
      if (!isLoading && !isAuthenticated && !hasStudentSession && !hasTeacherSession) {
        router.push("/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  // If logged in as Teacher, render the Teacher Portal
  if (userRole === "profesor") {
    return <TeacherPortalView initialTab="mis_clases" />;
  }

  // Otherwise, render the Student Portal
  const plan = (currentStudent?.plan_activo || "").toLowerCase();
  const isSinPlan = plan.includes("sin plan") || plan.includes("pendiente") || !currentStudent?.plan_activo;
  const isBono = plan.includes("bono") || (typeof currentStudent?.clases_restantes === "number" && currentStudent.clases_restantes > 0);

  return (
    <div className="flex flex-col flex-1 w-full bg-[var(--color-bg)] overflow-x-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36">
        {/* Header Profile */}
        <header className="p-6 pt-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)]">
          <div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Bienvenida/o de nuevo</p>
            <h1 className="text-2xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
              {currentStudent?.nombre_completo || "Alumno Dance Factory"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={logout}
              title="Cerrar Sesión"
              className="p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-danger)] transition-all flex items-center justify-center cursor-pointer"
            >
              <LogOut size={18} />
            </button>
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white overflow-hidden shadow-lg shadow-[var(--color-primary)]/20 font-semibold text-sm shrink-0">
              {currentStudent?.nombre_completo ? (
                currentStudent.nombre_completo.split(" ").slice(0, 2).map((n) => n[0]).join("")
              ) : (
                <User size={20} />
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-6">
          
          {/* Tarjeta de Estado del Alumno (Bono Activo & Clases Restantes) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-bg-card)] via-[#11192e] to-[var(--color-bg-hover)] border border-[var(--color-primary)]/40 p-5 shadow-xl">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-[var(--color-primary)]/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2.5 py-1 rounded-full border border-[var(--color-secondary)]/20">
                  ESTADO DE MATRÍCULA
                </span>
                <h2 className="text-xl font-bold font-[family-name:var(--font-heading)] text-white mt-1">
                  {currentStudent?.plan_activo || "Sin Plan Activo"}
                </h2>
              </div>
              <span className={"text-xs font-semibold px-2.5 py-1 rounded-full border " + (
                isSinPlan 
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              )}>
                {currentStudent?.estado || "Activo"}
              </span>
            </div>

            {/* Contador de Clases o Tarifa Mensual */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Disponibilidad Actual</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  {isBono ? (
                    <>
                      <span className="text-3xl font-extrabold font-mono text-[var(--color-primary-hover)]">
                        {currentStudent?.clases_restantes ?? 0}
                      </span>
                      <span className="text-sm text-slate-300 font-medium">clases restantes</span>
                    </>
                  ) : (
                    <span className="text-base font-bold text-white">
                      Cuota Mensual Regular
                    </span>
                  )}
                </div>
              </div>

              {isBono && (
                <Link
                  href="/clases?tab=bonos"
                  className="px-3.5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-md shadow-[var(--color-primary)]/20 active:scale-95 cursor-pointer"
                >
                  Recargar
                </Link>
              )}
            </div>
          </div>

          {/* QR Carnet Digital para Acceso */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-[var(--color-text-secondary)] text-xs font-semibold uppercase tracking-wider">
              <QrCode size={16} className="text-[var(--color-primary)]" />
              <span>Pase Digital de Acceso a Salas</span>
            </div>

            {/* QR Container */}
            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl shadow-black/40 border-4 border-[var(--color-primary)]/30">
              <QRCodeSVG
                value={currentStudent?.nfc_token ? ("DF-STUDENT-" + currentStudent.nfc_token) : ("DF-" + (currentStudent?.id || "DEMO"))}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-mono font-bold text-white tracking-widest">
                ID: {currentStudent?.nfc_token || "3918"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Acerca este código al lector de recepción o tableta de sala para registrar tu asistencia.
              </p>
            </div>
          </div>

          {/* Accesos Directos */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/clases?tab=openclass"
              className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-all space-y-2 group shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary-hover)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Open Classes</h4>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Reserva sesiones sueltas</p>
              </div>
            </Link>

            <Link
              href="/clases?tab=bonos"
              className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-secondary)] transition-all space-y-2 group shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Ticket size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Comprar Bonos</h4>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Bonos 4, 8, 10 o Ilimitado</p>
              </div>
            </Link>
          </div>

        </main>
      </div>

      {/* Fixed Bottom Navigation */}
      <StudentBottomNav />
    </div>
  );
}
