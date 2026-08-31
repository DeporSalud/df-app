"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  UserCheck, Check, Clock, Users, ShieldAlert, Sparkles, Calendar, Search, 
  Lock, LogOut, KeyRound, ArrowLeft, ChevronRight, Flame, Ticket, GraduationCap, 
  CreditCard, Building2, Trash2, AlertTriangle, Tag, CheckCircle2, ShieldCheck, X, RefreshCw
} from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";
import { useStudent, Teacher } from "@/context/StudentContext";

const getDayOrder = (day: string) => {
  const days: Record<string, number> = {
    "LUNES": 1, "MARTES": 2, "MIÉRCOLES": 3, "JUEVES": 4, "VIERNES": 5, "SÁBADO": 6, "DOMINGO": 7
  };
  return days[(day || "").toUpperCase()] || 8;
};

const normalizeText = (text?: string | null): string => {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export default function TeacherPortalView({ initialTab = "mis_clases" }: { initialTab?: "mis_clases" | "open_classes" | "comprar_bono" | "perfil" }) {
  const { currentTeacher, logout, teachers, setCurrentTeacherId } = useStudent();
  const [activeTab, setActiveTab] = useState<"mis_clases" | "open_classes" | "comprar_bono" | "perfil">(initialTab);
  
  const [teacherStudent, setTeacherStudent] = useState<any | null>(null);

  // Mis Clases
  const [clasesProfesor, setClasesProfesor] = useState<any[]>([]);
  const [selectedClase, setSelectedClase] = useState<any | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState<string>("");
  const [asistenciasRegistradas, setAsistenciasRegistradas] = useState<string[]>([]);
  
  // Open Classes
  const [allOpenClasses, setAllOpenClasses] = useState<any[]>([]);
  
  // Checkout
  const [selectedBonoForPayment, setSelectedBonoForPayment] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const teacherName = currentTeacher?.name || "LUCÍA MUÑOZ";

  const systemDays = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const todayStr = systemDays[new Date().getDay()];

  const bonosDocentes = [
    { 
      id: "Bono 4 clases", 
      nombre: "Bono 4 Clases Docente", 
      clasesCount: 4,
      precioOriginal: "45,00 €",
      precioDocente: "40,50 €", 
      precioNum: 40.50,
      desc: "4 clases • Validez 30 días • Acceso a OPEN CLASS con 10% dto. especial para profesores" 
    },
    { 
      id: "Bono 8 clases", 
      nombre: "Bono 8 Clases Docente", 
      clasesCount: 8,
      precioOriginal: "57,00 €",
      precioDocente: "51,30 €", 
      precioNum: 51.30,
      popular: true,
      desc: "8 clases • Validez 45 días • Ideal para complementar tu entrenamiento semanal" 
    },
    { 
      id: "Bono 10 clases", 
      nombre: "Bono 10 Clases Docente", 
      clasesCount: 10,
      precioOriginal: "79,00 €",
      precioDocente: "71,10 €", 
      precioNum: 71.10,
      desc: "10 clases • Validez 60 días • Máxima flexibilidad para toda la temporada" 
    },
    { 
      id: "Mensualidad Ilimitada", 
      nombre: "Pase Ilimitado Docente", 
      clasesCount: 999,
      precioOriginal: "100,00 €",
      precioDocente: "90,00 €", 
      precioNum: 90.00,
      desc: "Acceso total sin límite a todas las Open Classes y entrenamientos de la escuela" 
    }
  ];

  // 1. Fetch Teacher Data & Classes
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Find teacher in alumnos table or create fallback
      const { data: studentList } = await supabase.from("alumnos").select("*");
      const normName = normalizeText(teacherName);
      let tStudent = (studentList || []).find(s => normalizeText(s.nombre_completo).includes(normName));

      if (!tStudent) {
        tStudent = {
          id: "docente_" + (currentTeacher?.id || "1001"),
          nombre_completo: teacherName,
          email: currentTeacher?.email || "docente@dancefactory.es",
          plan_activo: "Docente Dance Factory",
          clases_restantes: 4,
          estado: "Activo",
          sede: currentTeacher?.sede || "tejar"
        };
      }
      setTeacherStudent(tStudent);

      // Fetch cuadrante classes
      const { data: allClases } = await supabase.from("clases_cuadrante").select("*");
      if (allClases && allClases.length > 0) {
        // Teacher's assigned classes
        const myClases = allClases.filter(c => {
          const profNorm = normalizeText(c.profesor);
          return profNorm.includes(normName) || normName.includes(profNorm);
        });

        myClases.sort((a, b) => {
          const dayDiff = getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
          if (dayDiff !== 0) return dayDiff;
          return (a.hora_inicio || "").localeCompare(b.hora_inicio || "");
        });
        setClasesProfesor(myClases);

        // Open Classes (Exclusively Studio 2 Paseo Castilla)
        let openList = allClases.filter(c => 
          (c.sede === "castilla" || c.sede === "alcorcon") && (
            c.tipo_clase === "Open Class" || 
            c.nombre_clase?.toLowerCase().includes("open") ||
            c.nombre_clase?.toLowerCase().includes("comercial")
          )
        );
        if (openList.length === 0) {
          openList = allClases.filter(c => 
            c.tipo_clase === "Open Class" || 
            c.nombre_clase?.toLowerCase().includes("open") ||
            c.nombre_clase?.toLowerCase().includes("comercial")
          );
        }
        setAllOpenClasses(openList);
      }
    } catch (e) {
      console.error("Error loading teacher portal data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teacherName]);

  // 2. Fetch Class Roster & Today's Attendance
  const handleSelectClase = async (clase: any) => {
    setSelectedClase(clase);
    setRosterSearch("");
    setIsLoading(true);

    try {
      // 1. Fetch real enrollments from alumnos_clases
      const { data: rawEnrollments, error: rawErr } = await supabase
        .from("alumnos_clases")
        .select("alumno_id")
        .eq("clase_id", clase.id);

      let classStudents: any[] = [];
      if (!rawErr && rawEnrollments && rawEnrollments.length > 0) {
        const studentIds = rawEnrollments.map((e: any) => e.alumno_id);
        const { data: studentsList } = await supabase
          .from("alumnos")
          .select("*")
          .in("id", studentIds)
          .order("nombre_completo", { ascending: true });

        if (studentsList) {
          classStudents = studentsList.map((s: any) => ({
            ...s,
            bono_agotado: s.clases_restantes !== null && s.clases_restantes <= 0,
            debe_cuota: s.estado === "Pendiente" || (s.plan_activo || "").toLowerCase().includes("pendiente")
          }));
        }
      }

      setRoster(classStudents);

      // Today's attendances
      const todayIso = new Date().toISOString().split("T")[0];
      const { data: asistenciasData } = await supabase
        .from("asistencias")
        .select("alumno_id")
        .eq("clase_id", clase.id)
        .gte("fecha_hora", todayIso + "T00:00:00")
        .lte("fecha_hora", todayIso + "T23:59:59");

      const ids = (asistenciasData || []).map((a: any) => a.alumno_id);
      setAsistenciasRegistradas(ids);
    } catch (err) {
      console.error("Error fetching class roster:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Mark Attendance
  const handleToggleAsistencia = async (studentId: string, studentName: string) => {
    if (!selectedClase) return;
    setSavingId(studentId);

    const isPresent = asistenciasRegistradas.includes(studentId);

    try {
      if (isPresent) {
        const todayIso = new Date().toISOString().split("T")[0];
        await supabase
          .from("asistencias")
          .delete()
          .eq("clase_id", selectedClase.id)
          .eq("alumno_id", studentId)
          .gte("fecha_hora", todayIso + "T00:00:00")
          .lte("fecha_hora", todayIso + "T23:59:59");

        setAsistenciasRegistradas(prev => prev.filter(id => id !== studentId));

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_cancelada",
          descripcion: "Profesor " + teacherName + " desmarcó asistencia de " + studentName + " en " + selectedClase.nombre_clase,
          usuario_afectado: studentName,
          sede: selectedClase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      } else {
        await supabase
          .from("asistencias")
          .insert([{
            alumno_id: studentId,
            clase_id: selectedClase.id,
            fecha_hora: new Date().toISOString()
          }]);

        setAsistenciasRegistradas(prev => [...prev, studentId]);

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_pase_lista",
          descripcion: "Profesor " + teacherName + " confirmó asistencia presencial de " + studentName + " en " + selectedClase.nombre_clase,
          usuario_afectado: studentName,
          sede: selectedClase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      }
    } catch (e) {
      console.error("Error updating attendance:", e);
    } finally {
      setSavingId(null);
    }
  };

  // 4. Request Bono in Standby
  const handleTeacherBonoRequest = async () => {
    if (!selectedBonoForPayment || !teacherStudent?.id) return;
    setIsProcessingPayment(true);

    const pendingPlanText = "Pendiente: " + selectedBonoForPayment.nombre + " (" + selectedBonoForPayment.precioDocente + ")";

    try {
      await supabase
        .from("alumnos")
        .update({ plan_activo: pendingPlanText })
        .eq("id", teacherStudent.id);

      setTeacherStudent((prev: any) => ({ ...prev, plan_activo: pendingPlanText }));

      if (typeof window !== "undefined") {
        const storedLocal = JSON.parse(localStorage.getItem("pending_bono_requests") || "[]");
        const newReq = {
          id: "req_docente_" + Date.now(),
          student_id: teacherStudent.id,
          student_name: teacherName + " (Docente)",
          student_email: currentTeacher?.email || "docente@dancefactory.es",
          bono_nombre: selectedBonoForPayment.nombre,
          bono_precio: selectedBonoForPayment.precioDocente,
          fecha: "Hoy (Docente)",
          estado: "Pendiente de cobro en Recepción"
        };
        localStorage.setItem("pending_bono_requests", JSON.stringify([newReq, ...storedLocal]));

        const rawPayments = localStorage.getItem("df_pagos_transacciones_v1");
        const allPayments = rawPayments ? JSON.parse(rawPayments) : [];
        const now = new Date();
        const pendingTx = {
          id: "pago_docente_pending_" + Date.now(),
          numero_recibo: "PEND-" + now.getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
          fecha_hora: now.toISOString(),
          fecha_corta: now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
          hora_corta: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          alumno_id: teacherStudent.id,
          alumno_nombre: teacherName + " (Docente)",
          alumno_dni: "Docente DF",
          concepto: selectedBonoForPayment.nombre + " (-10% dto Docente)",
          categoria: "bono",
          importe: selectedBonoForPayment.precioNum,
          metodo_pago: "Pendiente Recepción",
          sede: currentTeacher?.sede || "castilla",
          atendido_por: "Solicitud Portal Profesor",
          notas: "Solicitud de bono docente con 10% dto en standby para abonar en recepción",
          estado: "Pendiente"
        };
        localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify([pendingTx, ...allPayments]));
        window.dispatchEvent(new Event("df_pagos_updated"));
      }

      logActivity({
        origen: "profesor",
        tipo_evento: "solicitud_bono",
        descripcion: "Profesor " + teacherName + " solicitó en recepción el bono con 10% dto: " + selectedBonoForPayment.nombre + " (" + selectedBonoForPayment.precioDocente + ")",
        usuario_afectado: teacherName,
        sede: currentTeacher?.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
      });

      setIsProcessingPayment(false);
      setSelectedBonoForPayment(null);

      setModal({
        isOpen: true,
        title: "⏳ Solicitud Registrada en Standby",
        message: "Tu solicitud para el " + selectedBonoForPayment.nombre + " (" + selectedBonoForPayment.precioDocente + ") ha quedado registrada en STANDBY.\n\nAparece notificada en Recepción para que puedas abonarla en efectivo o datáfono. En cuanto se confirme el cobro, se activará tu saldo.",
        type: "info",
        confirmText: "Entendido"
      });
    } catch (err) {
      console.error("Error requesting teacher bono:", err);
      setIsProcessingPayment(false);
    }
  };

  const filteredRoster = roster.filter(s => 
    s.nombre_completo?.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 w-full bg-[var(--color-bg)] overflow-x-hidden text-left">
      
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36">
        
        {/* Top Header */}
        <header className="p-5 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white flex items-center justify-center font-bold text-base shadow-md">
                {teacherName.split(" ").slice(0, 2).map(n => n[0]).join("")}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-bold text-white font-[family-name:var(--font-heading)] tracking-wide">
                    {teacherName}
                  </h1>
                  <span className="text-[9px] font-bold bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] px-2 py-0.5 rounded-full border border-[var(--color-secondary)]/25">
                    DOCENTE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {currentTeacher?.especialidad || "Danza"} • {currentTeacher?.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Cerrar Sesión"
              className="p-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-slate-400 hover:text-white transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <LogOut size={15} />
              <span className="text-[10px]">Salir</span>
            </button>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="p-4 sm:p-6 space-y-5">
          
          {/* ==================================================== */}
          {/* VISTA 1: MIS CLASES & PASE DE LISTA */}
          {/* ==================================================== */}
          {activeTab === "mis_clases" && (
            <div>
              {selectedClase ? (
                /* Detalle de Clase & Pase de Lista */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedClase(null)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      <span>Volver al Cuadrante</span>
                    </button>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {asistenciasRegistradas.length} presentes
                    </span>
                  </div>

                  <div className="bg-gradient-to-br from-[#141d33] to-[var(--color-bg-card)] border border-white/10 rounded-2xl p-4 shadow-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2 py-0.5 rounded border border-[var(--color-secondary)]/20">
                          {selectedClase.dia_semana}
                        </span>
                        <h2 className="text-xl font-bold font-[family-name:var(--font-heading)] text-white mt-1">
                          {selectedClase.nombre_clase}
                        </h2>
                      </div>
                      <span className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-xl">
                        {selectedClase.hora_inicio} - {selectedClase.hora_fin}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-300 pt-1 border-t border-white/5">
                      <span>🏢 {selectedClase.sede === "tejar" ? "Studio 1 El Tejar" : "Studio 2 Paseo Castilla"}</span>
                      <span>🚪 {selectedClase.sala || "Sala Principal"}</span>
                    </div>
                  </div>

                  {/* Buscador de Alumnos en la Clase */}
                  <div className="relative flex items-center">
                    <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      placeholder="Buscar alumno en esta clase..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-secondary)] transition-all placeholder:text-slate-500"
                    />
                  </div>

                  {/* Roster List */}
                  <div className="space-y-2">
                    {filteredRoster.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No se encontraron alumnos con ese nombre.</p>
                    ) : (
                      filteredRoster.map((student) => {
                        const isPresent = asistenciasRegistradas.includes(student.id);
                        const isSaving = savingId === student.id;

                        return (
                          <div
                            key={student.id}
                            className={"p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 " + (
                              isPresent
                                ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm"
                                : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-slate-600"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <strong className="text-xs text-white font-semibold truncate block">
                                  {student.nombre_completo}
                                </strong>
                                {student.debe_cuota && (
                                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    Pago Pendiente
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                {student.plan_activo || "Clases Regulares"} • DNI: {student.dni || "N/A"}
                              </p>
                            </div>

                            <button
                              onClick={() => handleToggleAsistencia(student.id, student.nombre_completo)}
                              disabled={isSaving}
                              className={"px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer " + (
                                isPresent
                                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                                  : "bg-[var(--color-bg)] text-slate-300 border border-[var(--color-border)] hover:text-white"
                              )}
                            >
                              <Check size={14} className={isPresent ? "text-slate-950 font-black stroke-[3]" : "text-slate-400"} />
                              <span>{isPresent ? "Presente" : "Marcar"}</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Listado General de Mis Clases Semanales */
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <div>
                      <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-white">
                        Mis Clases Semanales
                      </h2>
                      <p className="text-xs text-slate-400">Selecciona una clase para pasar lista</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2.5 py-1 rounded-xl border border-[var(--color-secondary)]/20">
                      {clasesProfesor.length} clases
                    </span>
                  </div>

                  {isLoading ? (
                    <p className="text-xs text-slate-400 py-8 text-center">Cargando tus clases...</p>
                  ) : clasesProfesor.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center space-y-2">
                      <Calendar size={32} className="mx-auto text-slate-500" />
                      <p className="text-xs text-slate-300 font-semibold">No tienes clases asignadas en el cuadrante actual.</p>
                      <p className="text-[11px] text-slate-500">Contacta con administración si necesitas añadir nuevas asignaciones.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {clasesProfesor.map((clase) => {
                        const isToday = (clase.dia_semana || "").toUpperCase() === todayStr;

                        return (
                          <div
                            key={clase.id}
                            onClick={() => handleSelectClase(clase)}
                            className={"p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md " + (
                              isToday
                                ? "bg-gradient-to-r from-[var(--color-primary)]/15 via-[var(--color-bg-card)] to-[var(--color-bg-card)] border-[var(--color-primary)]/40 hover:border-[var(--color-primary)]"
                                : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-slate-600"
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={"text-[10px] font-bold uppercase px-2 py-0.5 rounded border " + (
                                  isToday
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : "bg-white/5 text-slate-400 border-white/10"
                                )}>
                                  {clase.dia_semana} {isToday ? "• HOY" : ""}
                                </span>
                                <span className="text-xs font-mono font-bold text-white">
                                  {clase.hora_inicio} - {clase.hora_fin}
                                </span>
                              </div>

                              <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-white">
                                {clase.nombre_clase}
                              </h3>

                              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span>🏢 {clase.sede === "tejar" ? "Studio 1 El Tejar" : "Studio 2 Castilla"}</span>
                                <span>🚪 {clase.sala || "Sala 1"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-[var(--color-secondary)] font-bold shrink-0">
                              <span>Pase de lista</span>
                              <ChevronRight size={16} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* VISTA 2: OPEN CLASSES PARA ENTRENAMIENTO */}
          {/* ==================================================== */}
          {activeTab === "open_classes" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div>
                  <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-white">
                    Open Classes & Formación
                  </h2>
                  <p className="text-xs text-slate-400">Entrena y asiste a clases de otros docentes</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                  Saldo: {teacherStudent?.clases_restantes ?? 0} clases
                </span>
              </div>

              {allOpenClasses.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No hay sesiones de Open Class programadas.</p>
              ) : (
                <div className="space-y-2.5">
                  {allOpenClasses.map((clase) => (
                    <div
                      key={clase.id}
                      className="p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-md flex justify-between items-center gap-3"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                          {clase.dia_semana} • {clase.hora_inicio} - {clase.hora_fin}
                        </span>
                        <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-white">
                          {clase.nombre_clase}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Profesor/a: <strong className="text-white">{clase.profesor}</strong> • {clase.sede === "tejar" ? "Studio 1" : "Studio 2"}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setModal({
                            isOpen: true,
                            title: "✓ Reserva Confirmada",
                            message: "Te has inscrito como docente en " + clase.nombre_clase + " con " + clase.profesor + ".",
                            type: "success"
                          });
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 transition-all shrink-0 active:scale-95 cursor-pointer"
                      >
                        Inscribirme
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* VISTA 3: COMPRAR BONOS DOCENTES (-10%) */}
          {/* ==================================================== */}
          {activeTab === "comprar_bono" && (
            <div className="space-y-5">
              {/* Banner Descuento Docente */}
              <div className="bg-gradient-to-br from-[var(--color-secondary)]/20 via-[var(--color-bg-card)] to-[#0c1428] border border-[var(--color-secondary)]/40 p-5 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-2 text-[var(--color-secondary)] mb-1">
                  <Tag size={20} />
                  <span className="text-xs font-bold uppercase tracking-wider">Tarifas Exclusivas para Profesores</span>
                </div>
                <h2 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">
                  10% de Descuento en Bonos y Formaciones
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Como docente de Dance Factory, todos tus bonos y pases tienen un 10% de descuento directo aplicado en el precio oficial.
                </p>
              </div>

              {/* Standby Banner */}
              {teacherStudent?.plan_activo?.includes("Pendiente") && (
                <div className="bg-amber-500/10 border-2 border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                      ⏳
                    </div>
                    <div>
                      <strong className="block text-amber-300 font-bold">Solicitud en STANDBY en Recepción</strong>
                      <span className="text-[11px] text-slate-300">{teacherStudent.plan_activo}</span>
                    </div>
                  </div>
                  <span className="bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-full border border-amber-500/30 text-[10px] uppercase shrink-0">
                    Pendiente de Pago
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Selecciona tu Bono Docente
                </h3>

                {bonosDocentes.map((bono) => (
                  <div
                    key={bono.id}
                    className="p-4 sm:p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-secondary)]/60 transition-all shadow-md relative"
                  >
                    {bono.popular && (
                      <span className="absolute -top-2.5 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                        Recomendado
                      </span>
                    )}

                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2 py-0.5 rounded border border-[var(--color-secondary)]/20 mb-1 inline-block">
                          🔥 -10% DTO. DOCENTE
                        </span>
                        <h4 className="text-lg font-[family-name:var(--font-heading)] text-white tracking-wide">{bono.nombre}</h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-500 line-through block font-mono">
                          {bono.precioOriginal}
                        </span>
                        <span className="text-xl font-bold font-mono text-[var(--color-secondary)] block">
                          {bono.precioDocente}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      {bono.desc}
                    </p>

                    <button
                      onClick={() => setSelectedBonoForPayment(bono)}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-950 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 transition-all shadow-lg shadow-[var(--color-secondary)]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Ticket size={16} />
                      <span>Comprar con 10% Dto. ({bono.precioDocente})</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* VISTA 4: PERFIL DOCENTE */}
          {/* ==================================================== */}
          {activeTab === "perfil" && (
            <div className="space-y-5">
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    {teacherName.split(" ").slice(0, 2).map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white font-[family-name:var(--font-heading)]">
                      {teacherName}
                    </h2>
                    <span className="inline-block px-2.5 py-0.5 bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] text-[11px] font-semibold rounded-full border border-[var(--color-secondary)]/25 mt-1">
                      Docente Oficial Dance Factory
                    </span>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)] pt-4 space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Especialidad:</span>
                    <strong className="text-white">{currentTeacher?.especialidad || "Danza"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sede Principal:</span>
                    <strong className="text-white">{currentTeacher?.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email Corporativo:</span>
                    <strong className="text-white">{currentTeacher?.email || "docente@dancefactory.es"}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Checkout Modal */}
      {selectedBonoForPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedBonoForPayment(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Comprar {selectedBonoForPayment.nombre}</h3>
              <p className="text-xs text-slate-400">Docente: {teacherName}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Precio Oficial:</span>
                <span className="line-through text-slate-500">{selectedBonoForPayment.precioOriginal}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="font-bold text-slate-300">Total con 10% Dto:</span>
                <span className="text-xl font-bold font-mono text-[var(--color-secondary)]">{selectedBonoForPayment.precioDocente}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleTeacherBonoRequest}
                disabled={isProcessingPayment}
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-secondary)]/20 cursor-pointer transition-all active:scale-95"
              >
                <Building2 size={16} />
                <span>Solicitar Pago en Recepción ({selectedBonoForPayment.precioDocente})</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 text-center">
              <ShieldCheck size={14} className="text-[var(--color-secondary)] shrink-0" />
              <span>Quedará en STANDBY para abonar en recepción</span>
            </div>
          </div>
        </div>
      )}

      {/* Universal Alert Modal */}
      <AppModal modal={modal} onClose={() => setModal({ ...modal, isOpen: false })} />

      {/* Mobile Bottom Navigation for Teacher */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-[#141d33]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-around items-center">
        <button
          onClick={() => {
            setActiveTab("mis_clases");
            setSelectedClase(null);
          }}
          className={"flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer " + (
            activeTab === "mis_clases" ? "text-[var(--color-secondary)] font-bold scale-105" : "text-slate-400 hover:text-white font-medium"
          )}
        >
          <Calendar size={20} className={activeTab === "mis_clases" ? "text-[var(--color-secondary)] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-400"} />
          <span className={"text-[10px] mt-1 tracking-tight text-center " + (activeTab === "mis_clases" ? "text-[var(--color-secondary)] font-bold" : "text-slate-400")}>
            Mis Clases
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("open_classes");
            setSelectedClase(null);
          }}
          className={"flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer " + (
            activeTab === "open_classes" ? "text-amber-400 font-bold scale-105" : "text-slate-400 hover:text-white font-medium"
          )}
        >
          <Flame size={20} className={activeTab === "open_classes" ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "text-slate-400"} />
          <span className={"text-[10px] mt-1 tracking-tight text-center " + (activeTab === "open_classes" ? "text-amber-400 font-bold" : "text-slate-400")}>
            Open Class
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("comprar_bono");
            setSelectedClase(null);
          }}
          className={"flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all relative cursor-pointer " + (
            activeTab === "comprar_bono" ? "text-[var(--color-secondary)] font-bold scale-105" : "text-slate-400 hover:text-white font-medium"
          )}
        >
          <span className="absolute -top-1 right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[8px] font-bold px-1.5 py-0.2 rounded-full shadow-sm">
            -10%
          </span>
          <Tag size={20} className={activeTab === "comprar_bono" ? "text-[var(--color-secondary)] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-400"} />
          <span className={"text-[10px] mt-1 tracking-tight text-center " + (activeTab === "comprar_bono" ? "text-[var(--color-secondary)] font-bold" : "text-slate-400")}>
            Bonos
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("perfil");
            setSelectedClase(null);
          }}
          className={"flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer " + (
            activeTab === "perfil" ? "text-[var(--color-secondary)] font-bold scale-105" : "text-slate-400 hover:text-white font-medium"
          )}
        >
          <GraduationCap size={20} className={activeTab === "perfil" ? "text-[var(--color-secondary)] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-400"} />
          <span className={"text-[10px] mt-1 tracking-tight text-center " + (activeTab === "perfil" ? "text-[var(--color-secondary)] font-bold" : "text-slate-400")}>
            Perfil
          </span>
        </button>
      </nav>

    </div>
  );
}
