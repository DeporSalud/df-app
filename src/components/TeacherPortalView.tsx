"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  UserCheck, Check, Clock, Users, ShieldAlert, Sparkles, Calendar, Search, 
  Lock, LogOut, KeyRound, ArrowLeft, ChevronRight, Flame, Ticket, GraduationCap, 
  CreditCard, Building2, Trash2, AlertTriangle, Tag, CheckCircle2, ShieldCheck, X, RefreshCw,
  CalendarDays, BarChart3, MessageCircle, Filter
} from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";
import { useStudent, Teacher } from "@/context/StudentContext";
import { 
  getUpcomingCalendarDates, 
  CalendarDayItem, 
  normalizeDay, 
  normalizeSede, 
  formatSedeName, 
  getSesionReservasCount, 
  isSesionCompleta, 
  isAlumnoReservadoEnSesion, 
  crearReservaOpenClass, 
  cancelarReservaOpenClass,
  getReservasPorClaseYSesion,
  getOpenClassReservas,
  syncReservasFromSupabase,
  getUpcomingSessionsForClass,
  DEFAULT_STUDIO2_OPEN_CLASSES,
  LEGACY_ID_MAP,
  normalizeClaseId,
  cleanDateISO,
  OpenClassReserva,
  getNextUpcomingSessionDate,
  getTodayISO
} from "@/lib/openClassService";

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

const isStudio1 = (sede?: string | null): boolean => {
  const s = (sede || "").toLowerCase().trim();
  return s === "tejar" || s === "mostoles" || s === "studio" || s === "studio 1";
};

const isRegularMembership = (plan?: string | null, remaining?: number | null): boolean => {
  if (remaining === null) return true;
  const p = (plan || "").toLowerCase();
  return p.includes("regular") || p.includes("mensual") || p.includes("ilimitad") || p.includes("cuota");
};

const getMonthNameSpanish = (monthStr: string) => {
  const months: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };
  return months[monthStr] || monthStr;
};

const isOpenClass = (clase: any) => {
  if (!clase) return false;
  const nameUpper = (clase.nombre_clase || "").toUpperCase();
  const typeUpper = (clase.tipo_clase || "").toUpperCase();
  return (
    typeUpper.includes("OPEN") || 
    nameUpper.includes("OPEN") || 
    nameUpper.includes("FORMACI") || 
    nameUpper.includes("ROTAT") ||
    Boolean(DEFAULT_STUDIO2_OPEN_CLASSES?.some((def: any) => def.id === clase.id)) ||
    Boolean(LEGACY_ID_MAP?.[clase.id])
  );
};

export default function TeacherPortalView({ initialTab = "mis_clases" }: { initialTab?: "mis_clases" | "open_classes" | "comprar_bono" | "perfil" }) {
  const { currentTeacher, logout, teachers, setCurrentTeacherId } = useStudent();
  const [activeTab, setActiveTab] = useState<"mis_clases" | "open_classes" | "comprar_bono" | "perfil">(initialTab);
  
  const [teacherStudent, setTeacherStudent] = useState<any | null>(null);

  // Mis Clases & Attendance
  const [clasesProfesor, setClasesProfesor] = useState<any[]>([]);
  const [selectedClase, setSelectedClase] = useState<any | null>(null);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("");
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState<string>("");
  const [asistenciasRegistradas, setAsistenciasRegistradas] = useState<string[]>([]);
  const [deductedStudentIds, setDeductedStudentIds] = useState<Set<string>>(new Set());

  // Horario semanal por días & seguimiento de asistencias y faltas
  const [dayScheduleFilter, setDayScheduleFilter] = useState<string>("HOY");
  const [attendanceFilter, setAttendanceFilter] = useState<"todos" | "presentes" | "faltas">("todos");
  const [classAllAttendances, setClassAllAttendances] = useState<any[]>([]);
  const [isClassMonthlyModalOpen, setIsClassMonthlyModalOpen] = useState<boolean>(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any | null>(null);
  const [classViewTab, setClassViewTab] = useState<"pase_lista" | "dias_asistencia">("pase_lista");
  
  // Open Classes & Calendar State
  const calendarDays = getUpcomingCalendarDates(30);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayItem>(calendarDays[0]);
  const [allOpenClasses, setAllOpenClasses] = useState<any[]>([]);
  const [openClassReservasVersion, setOpenClassReservasVersion] = useState<number>(0);
  
  // Unified calendar sessions for ANY class (Regulares y Open Class)
  const currentClassSessions = useMemo(() => {
    if (!selectedClase) return [];
    return getUpcomingSessionsForClass(selectedClase, 12, "2026-09-07");
  }, [selectedClase?.id, selectedClase?.dia_semana, openClassReservasVersion]);
  
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
      desc: "8 clases • Validez 30 días • Ideal para complementar tu entrenamiento semanal" 
    },
    { 
      id: "Bono 10 clases", 
      nombre: "Bono 10 Clases Docente", 
      clasesCount: 10,
      precioOriginal: "79,00 €",
      precioDocente: "71,10 €", 
      precioNum: 71.10,
      desc: "10 clases • Validez 30 días • Máxima flexibilidad para toda la temporada" 
    },
    { 
      id: "Mensualidad Ilimitada", 
      nombre: "Pase Ilimitado Docente", 
      clasesCount: 999,
      precioOriginal: "100,00 €",
      precioDocente: "90,00 €", 
      precioNum: 90.00,
      desc: "Acceso total sin límite a todas las Open Classes y entrenamientos de la escuela • Validez 30 días" 
    }
  ];

  // 1. Fetch Teacher Data & Classes
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Sync open class bookings from Supabase
      await syncReservasFromSupabase();

      // Find teacher in alumnos table or create fallback
      const { data: studentList } = await supabase.from("alumnos").select("*");
      const normName = normalizeText(teacherName);
      let tStudent = (studentList || []).find(s => {
        if (s.id === "e9cc4200-aba2-4e67-8191-808c40e75621" && (currentTeacher?.id === "1014" || teacherName.includes("MARTA"))) return true;
        if (s.email && currentTeacher?.email && s.email.toLowerCase() === currentTeacher.email.toLowerCase()) return true;
        return normalizeText(s.nombre_completo).includes(normName);
      });

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

        // Open Classes (Studio 2 Paseo Castilla) - Solo sesiones auténticas de Open Class
        let openList = allClases.filter(c => 
          (c.sede === "castilla" || c.sede === "alcorcon") && isOpenClass(c)
        );
        if (openList.length === 0) {
          openList = allClases.filter(c => isOpenClass(c));
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

  // Load Roster for a class and specific date
  const loadRosterForDate = async (clase: any, dateIso: string, isSilentRefresh = false) => {
    if (!clase?.id) {
      setRoster([]);
      setAsistenciasRegistradas([]);
      setClassAllAttendances([]);
      return;
    }
    if (!isSilentRefresh) {
      setIsLoading(true);
    }
    try {
      const classUUID = normalizeClaseId(clase.id);

      // Fetch all recorded attendances for this class to calculate stats and per-session counts
      const { data: allAttendancesData } = await supabase
        .from("asistencias")
        .select("id, alumno_id, fecha_hora")
        .eq("clase_id", classUUID);

      const allAtts = allAttendancesData || [];
      setClassAllAttendances(allAtts);

      // Filter for active session date
      const activeSessionAtts = allAtts.filter(a => a.fecha_hora && a.fecha_hora.startsWith(dateIso));
      setAsistenciasRegistradas(activeSessionAtts.map(a => a.alumno_id));

      if (isOpenClass(clase)) {
        // ALWAYS sync from Supabase first
        await syncReservasFromSupabase();

        // 1. Fetch from synced service
        let sessionReservas = getReservasPorClaseYSesion(classUUID, dateIso);

        // 2. Direct fallback to alumnos_clases in Supabase if service returns 0
        if (sessionReservas.length === 0) {
          const { data: directRows } = await supabase
            .from("alumnos_clases")
            .select(`
              id,
              alumno_id,
              clase_id,
              asignado_en,
              alumnos (
                id,
                nombre_completo,
                email,
                telefono,
                dni,
                plan_activo,
                clases_restantes,
                estado,
                sede
              )
            `)
            .eq("clase_id", classUUID);

          const matchingDirect = (directRows || []).filter(r => {
            const rawDate = r.asignado_en ? cleanDateISO(r.asignado_en) : "";
            return !dateIso || rawDate === dateIso || rawDate.startsWith(dateIso);
          });

          if (matchingDirect.length > 0) {
            const attendees = matchingDirect.map(r => {
              const a: any = Array.isArray(r.alumnos) ? r.alumnos[0] : r.alumnos;
              const isDocente = (a?.nombre_completo || "").toLowerCase().includes("docente") ||
                                (a?.plan_activo || "").toLowerCase().includes("docente");
              return {
                id: r.alumno_id,
                nombre_completo: a?.nombre_completo || "Alumno",
                email: a?.email || "",
                telefono: a?.telefono || "",
                plan_activo: a?.plan_activo || "Open Class",
                clases_restantes: a?.clases_restantes ?? null,
                estado: a?.estado || "Activo",
                sede: a?.sede || clase.sede,
                is_docente: isDocente,
                reserva_id: r.id,
                fecha_reserva: dateIso,
                bono_agotado: false,
                debe_cuota: false
              };
            });
            setRoster(attendees);
            setIsLoading(false);
            return;
          }
        }

        // Fetch all students from DB to enrich details
        const { data: allDbStudents } = await supabase.from("alumnos").select("*");
        const dbMap = new Map((allDbStudents || []).map((s: any) => [s.id, s]));

        const attendees = sessionReservas.map(r => {
          const dbS = dbMap.get(r.alumno_id);
          const isDocente = r.alumno_nombre.toLowerCase().includes("docente") || 
                            r.alumno_nombre.toLowerCase().includes("profesor") ||
                            (dbS?.plan_activo || "").toLowerCase().includes("docente");

          return {
            id: r.alumno_id,
            nombre_completo: r.alumno_nombre,
            email: dbS?.email || "",
            telefono: dbS?.telefono || "",
            plan_activo: dbS?.plan_activo || (isDocente ? "Docente Dance Factory" : "Open Class"),
            clases_restantes: dbS?.clases_restantes ?? null,
            estado: dbS?.estado || "Activo",
            sede: r.sede,
            is_docente: isDocente,
            reserva_id: r.id,
            fecha_reserva: r.fecha_formateada,
            bono_agotado: false,
            debe_cuota: false
          };
        });

        setRoster(attendees);
      } else {
        // Regular class: robust 2-step query + relational fallback
        let studentList: any[] = [];

        try {
          const { data: rawEnrollments, error: rawErr } = await supabase
            .from("alumnos_clases")
            .select("alumno_id")
            .eq("clase_id", classUUID);

          if (!rawErr && rawEnrollments && rawEnrollments.length > 0) {
            const studentIds = rawEnrollments
              .map((e: any) => e.alumno_id)
              .filter((id: any) => Boolean(id && typeof id === "string" && id.trim() !== ""));

            if (studentIds.length > 0) {
              const { data: studentsData, error: studentsErr } = await supabase
                .from("alumnos")
                .select("id, nombre_completo, telefono, email, plan_activo, clases_restantes, estado, sede, dni")
                .in("id", studentIds);

              if (!studentsErr && studentsData && studentsData.length > 0) {
                studentList = studentsData.map((s: any) => ({
                  ...s,
                  bono_agotado: typeof s.clases_restantes === "number" && s.clases_restantes <= 0,
                  debe_cuota: s.estado === "Pendiente" || (s.plan_activo || "").toLowerCase().includes("pendiente")
                }));
              }
            }
          }
        } catch (errStep1) {
          console.error("Error fetching enrolled student IDs:", errStep1);
        }

        if (studentList.length === 0) {
          try {
            const { data: enrolled, error: enrollError } = await supabase
              .from("alumnos_clases")
              .select(`
                alumno_id,
                alumnos (
                  id,
                  nombre_completo,
                  telefono,
                  email,
                  plan_activo,
                  clases_restantes,
                  estado,
                  sede,
                  dni
                )
              `)
              .eq("clase_id", classUUID);

            if (!enrollError && enrolled && enrolled.length > 0) {
              studentList = enrolled
                .map((e: any) => (Array.isArray(e.alumnos) ? e.alumnos[0] : e.alumnos))
                .filter((a: any) => a != null && a.id)
                .map((s: any) => ({
                  ...s,
                  bono_agotado: typeof s.clases_restantes === "number" && s.clases_restantes <= 0,
                  debe_cuota: s.estado === "Pendiente" || (s.plan_activo || "").toLowerCase().includes("pendiente")
                }));
            }
          } catch (errStep2) {
            console.error("Error fetching nested enrolled students:", errStep2);
          }
        }

        // Deduplicate students by ID
        const uniqueStudents = Array.from(
          new Map(studentList.map(s => [s.id, s])).values()
        ).sort((a: any, b: any) => (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es"));

        setRoster(uniqueStudents);
      }
    } catch (err) {
      console.error("Error loading roster:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Class Roster on Class Selection
  const handleSelectClase = async (clase: any) => {
    setSelectedClase(clase);
    setRoster([]);
    setAsistenciasRegistradas([]);
    setClassAllAttendances([]);
    setAttendanceFilter("todos");
    setRosterSearch("");
    setClassViewTab("pase_lista");

    if (isOpenClass(clase)) {
      await syncReservasFromSupabase();
    }

    const sessions = getUpcomingSessionsForClass(clase, 12, "2026-09-07");
    const todayIso = getTodayISO();
    const todaySession = sessions.find(s => s.dateISO === todayIso);
    let targetDate = "";
    if (todaySession) {
      targetDate = todaySession.dateISO;
    } else {
      const pastSessions = sessions.filter(s => s.dateISO <= todayIso);
      if (pastSessions.length > 0) {
        targetDate = pastSessions[pastSessions.length - 1].dateISO;
      } else {
        targetDate = sessions[0]?.dateISO || todayIso;
      }
    }
    setSelectedSessionDate(targetDate);
    await loadRosterForDate(clase, targetDate);
  };

  // Switch session date in Attendance
  const handleChangeSessionDate = async (newDateIso: string) => {
    if (!selectedClase) return;
    setSelectedSessionDate(newDateIso);
    await loadRosterForDate(selectedClase, newDateIso);
  };

  // Listen to external bookings updates in real-time
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const handleReservasUpdated = () => {
      setOpenClassReservasVersion(v => v + 1);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (selectedClase && selectedSessionDate) {
          loadRosterForDate(selectedClase, selectedSessionDate, true);
        }
      }, 500);
    };
    window.addEventListener("df_reservas_updated", handleReservasUpdated);
    window.addEventListener("storage", handleReservasUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("df_reservas_updated", handleReservasUpdated);
      window.removeEventListener("storage", handleReservasUpdated);
    };
  }, [selectedClase, selectedSessionDate]);

  // 3. Digital Roll Call Toggle
  const handleToggleAsistencia = async (student: any) => {
    if (!selectedClase?.id) return;
    setSavingId(student.id);
    const targetDate = selectedSessionDate || new Date().toISOString().split("T")[0];

    try {
      const yaAsistio = asistenciasRegistradas.includes(student.id);
      const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);

      if (yaAsistio) {
        if (!isRegular && typeof student.clases_restantes === "number") {
          if (deductedStudentIds.has(student.id)) {
            const refundedBalance = student.clases_restantes + 1;
            await supabase
              .from("alumnos")
              .update({ clases_restantes: refundedBalance })
              .eq("id", student.id);

            setDeductedStudentIds(prev => {
              const next = new Set(prev);
              next.delete(student.id);
              return next;
            });
          }
        }

        const selectedClassUUID = normalizeClaseId(selectedClase.id);
        await supabase
          .from("asistencias")
          .delete()
          .eq("alumno_id", student.id)
          .eq("clase_id", selectedClassUUID)
          .gte("fecha_hora", targetDate + "T00:00:00")
          .lte("fecha_hora", targetDate + "T23:59:59");

        setAsistenciasRegistradas(prev => prev.filter(id => id !== student.id));
        setClassAllAttendances(prev => prev.filter(a => !(a.alumno_id === student.id && a.fecha_hora && a.fecha_hora.startsWith(targetDate))));

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${teacherName} desmarcó asistencia (falta) a ${student.nombre_completo} en ${selectedClase.nombre_clase}`,
          usuario_afectado: student.nombre_completo,
          sede: selectedClase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      } else {
        const selectedClassUUID = normalizeClaseId(selectedClase.id);
        const isPrepaidOpenClass = isOpenClass(selectedClase) || Boolean(student.reserva_id);

        if (!isRegular && !isPrepaidOpenClass && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          const newBalance = Math.max(0, student.clases_restantes - 1);
          await supabase
            .from("alumnos")
            .update({ clases_restantes: newBalance })
            .eq("id", student.id);

          setDeductedStudentIds(prev => new Set(prev).add(student.id));
        }

        // Construction of correct attendance timestamp in local timezone
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        let attendanceISO = now.toISOString();

        if (targetDate && targetDate !== todayStr) {
          const [y, m, d] = targetDate.split("-").map(Number);
          const [h, min] = (selectedClase.hora_inicio || "18:00").split(":").map(Number);
          attendanceISO = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0).toISOString();
        }

        await supabase.from("asistencias").insert([{
          alumno_id: student.id,
          clase_id: selectedClassUUID,
          fecha_hora: attendanceISO
        }]);

        setAsistenciasRegistradas(prev => [...prev, student.id]);
        setClassAllAttendances(prev => [...prev, {
          id: "temp_" + Date.now(),
          alumno_id: student.id,
          fecha_hora: attendanceISO
        }]);

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${teacherName} confirmó asistencia presencial de ${student.nombre_completo} en ${selectedClase.nombre_clase}`,
          usuario_afectado: student.nombre_completo,
          sede: selectedClase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      }
    } catch (err) {
      console.error("Error in handleToggleAsistencia:", err);
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!selectedClase?.id || roster.length === 0) return;
    setSavingId("ALL");
    const targetDate = selectedSessionDate || getTodayISO();
    const selectedClassUUID = normalizeClaseId(selectedClase.id);

    try {
      const studentsToMark = roster.filter(s => !asistenciasRegistradas.includes(s.id));
      const now = new Date();
      const todayStr = getTodayISO();
      let attendanceISO = now.toISOString();

      if (targetDate && targetDate !== todayStr) {
        const [y, m, d] = targetDate.split("-").map(Number);
        const [h, min] = (selectedClase.hora_inicio || "18:00").split(":").map(Number);
        attendanceISO = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0).toISOString();
      }

      const newCheckins: any[] = [];
      for (const student of studentsToMark) {
        const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);
        const isPrepaidOpenClass = isOpenClass(selectedClase) || Boolean(student.reserva_id);

        if (!isRegular && !isPrepaidOpenClass && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          const newBalance = Math.max(0, student.clases_restantes - 1);
          await supabase
            .from("alumnos")
            .update({ clases_restantes: newBalance })
            .eq("id", student.id);

          setDeductedStudentIds(prev => new Set(prev).add(student.id));
        }

        newCheckins.push({
          alumno_id: student.id,
          clase_id: selectedClassUUID,
          fecha_hora: attendanceISO
        });
      }

      if (newCheckins.length > 0) {
        await supabase.from("asistencias").insert(newCheckins);
        setAsistenciasRegistradas(roster.map(s => s.id));
        setClassAllAttendances(prev => [
          ...prev.filter(a => !(a.fecha_hora && a.fecha_hora.startsWith(targetDate))),
          ...newCheckins.map((c, i) => ({ id: "temp_all_" + i + "_" + Date.now(), ...c }))
        ]);

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${teacherName} hizo pase de lista masivo (${roster.length} alumnos) en ${selectedClase.nombre_clase} para la sesión ${targetDate}`,
          usuario_afectado: `${teacherName} (Masivo)`,
          sede: selectedClase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      }
    } catch (err) {
      console.error("Error in handleMarkAllPresent:", err);
    } finally {
      setSavingId(null);
    }
  };

  const handleClearAllPresent = async () => {
    if (!selectedClase?.id || asistenciasRegistradas.length === 0) return;
    setSavingId("ALL");
    const targetDate = selectedSessionDate || getTodayISO();
    const selectedClassUUID = normalizeClaseId(selectedClase.id);

    try {
      await supabase
        .from("asistencias")
        .delete()
        .eq("clase_id", selectedClassUUID)
        .gte("fecha_hora", targetDate + "T00:00:00")
        .lte("fecha_hora", targetDate + "T23:59:59");

      setAsistenciasRegistradas([]);
      setClassAllAttendances(prev => prev.filter(a => !(a.fecha_hora && a.fecha_hora.startsWith(targetDate))));

      logActivity({
        origen: "profesor",
        tipo_evento: "asistencia_profesor",
        descripcion: `Profesor ${teacherName} desmarcó la asistencia completa de la sesión ${targetDate} en ${selectedClase.nombre_clase}`,
        usuario_afectado: `${teacherName} (Desmarcar Todo)`,
        sede: selectedClase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
      });
    } catch (err) {
      console.error("Error in handleClearAllPresent:", err);
    } finally {
      setSavingId(null);
    }
  };

  // 4. Booking Open Class as a Teacher
  const handleTeacherOpenClassBooking = async (clase: any) => {
    if (!teacherStudent?.id) return;

    if (!isOpenClass(clase)) {
      setModal({
        isOpen: true,
        title: "Solo Open Classes",
        message: "En el portal de profesores solo está permitido reservar plazas en sesiones de Open Class. Las clases regulares no admiten reservas.",
        type: "warning",
        confirmText: "Entendido"
      });
      return;
    }

    const isRotativa = 
      clase.nombre_clase?.toUpperCase().includes("ROTAT") || 
      clase.profesor?.toUpperCase().includes("ROTAT") ||
      (clase.tipo_clase || "").toUpperCase().includes("ROTAT");

    if (isRotativa) {
      setModal({
        isOpen: true,
        title: "ℹ️ Formación Rotativa",
        message: "Las clases de Formación Rotativa no se pueden reservar desde el portal. Para inscribirte, por favor consulta directamente en recepción.",
        type: "info",
        confirmText: "Entendido"
      });
      return;
    }

    if (isSesionCompleta(clase, selectedCalendarDay.dateISO)) {
      setModal({
        isOpen: true,
        title: "Aforo Completo",
        message: `El aforo máximo (${clase.aforo_maximo || 20} plazas) para ${clase.nombre_clase} el ${selectedCalendarDay.dayName.toLowerCase()} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName} está completo.`,
        type: "warning"
      });
      return;
    }

    const hasUnlimited = (teacherStudent.plan_activo || "").toLowerCase().includes("ilimitad");
    const remainingClasses = typeof teacherStudent.clases_restantes === "number" ? teacherStudent.clases_restantes : 0;

    if (!hasUnlimited && remainingClasses <= 0) {
      setModal({
        isOpen: true,
        title: "Bono Docente Requerido",
        message: "No dispones de saldo de clases en tu Bono Docente para reservar esta Open Class. Puedes solicitar una recarga con 10% de descuento en la pestaña 'Comprar Bono'.",
        type: "warning"
      });
      return;
    }

    // Deduct 1 class if not unlimited
    if (!hasUnlimited && remainingClasses > 0) {
      const newCount = remainingClasses - 1;
      setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: newCount }));
      try {
        await supabase
          .from("alumnos")
          .update({ clases_restantes: newCount })
          .eq("id", teacherStudent.id);
      } catch (e) {
        console.error("Error updating teacher classes:", e);
      }
    }

    // Create reservation
    crearReservaOpenClass({
      alumno_id: teacherStudent.id,
      alumno_nombre: `${teacherName} (Docente)`,
      clase,
      calendarDay: selectedCalendarDay
    });

    setOpenClassReservasVersion(v => v + 1);

    logActivity({
      origen: "profesor",
      tipo_evento: "inscripcion_clase",
      descripcion: `Docente ${teacherName} reservó plaza en ${clase.nombre_clase} con ${clase.profesor} para el ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}`,
      usuario_afectado: teacherName,
      sede: clase.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setModal({
      isOpen: true,
      title: "✓ Plaza Reservada con Éxito",
      message: `Te has inscrito correctamente en ${clase.nombre_clase} con ${clase.profesor}.\n\n📅 Fecha: ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}\n⏰ Horario: ${clase.hora_inicio} - ${clase.hora_fin}\n🚪 Sala: ${clase.sala || "Sala Principal"}\n\nYa apareces en la lista de asistencia del docente titular para esa sesión.`,
      type: "success"
    });
  };

  // Cancel Booking as a Teacher
  const handleTeacherCancelBooking = async (clase: any) => {
    if (!teacherStudent?.id) return;
    const all = getOpenClassReservas();
    const found = all.find(r => 
      r.alumno_id === teacherStudent.id && 
      r.clase_id === clase.id && 
      r.fecha_iso === selectedCalendarDay.dateISO && 
      r.estado === "Confirmada"
    );

    if (found) {
      cancelarReservaOpenClass(found.id);

      // Refund 1 class
      const hasUnlimited = (teacherStudent.plan_activo || "").toLowerCase().includes("ilimitad");
      if (!hasUnlimited && typeof teacherStudent.clases_restantes === "number") {
        const newCount = teacherStudent.clases_restantes + 1;
        setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: newCount }));
        try {
          await supabase.from("alumnos").update({ clases_restantes: newCount }).eq("id", teacherStudent.id);
        } catch (e) {}
      }

      setOpenClassReservasVersion(v => v + 1);

      setModal({
        isOpen: true,
        title: "Reserva Cancelada",
        message: `Has cancelado tu inscripción para ${clase.nombre_clase} el ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}. Se ha reintegrado 1 clase a tu saldo docente.`,
        type: "info"
      });
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

  // Classes filtered by day schedule
  const filteredClases = useMemo(() => {
    let list = [...clasesProfesor];
    if (dayScheduleFilter === "HOY") {
      list = list.filter(c => normalizeDay(c.dia_semana) === normalizeDay(todayStr));
    } else if (dayScheduleFilter !== "TODAS") {
      const dayMap: Record<string, string> = {
        "LUN": "LUNES",
        "MAR": "MARTES",
        "MIÉ": "MIÉRCOLES",
        "JUE": "JUEVES",
        "VIE": "VIERNES",
        "SÁB": "SÁBADO"
      };
      list = list.filter(c => normalizeDay(c.dia_semana) === normalizeDay(dayMap[dayScheduleFilter]));
    }
    return list.sort((a, b) => {
      if (dayScheduleFilter === "TODAS") {
        if (getDayOrder(a.dia_semana) !== getDayOrder(b.dia_semana)) {
          return getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
        }
      }
      return (a.hora_inicio || "00:00").localeCompare(b.hora_inicio || "00:00");
    });
  }, [clasesProfesor, dayScheduleFilter, todayStr]);

  // Students in class filtered by search and attendance status (Todos / Presentes / Faltas)
  const filteredRoster = useMemo(() => {
    return roster.filter(s => {
      const matchesSearch = !rosterSearch.trim() || 
        (s.nombre_completo || "").toLowerCase().includes(rosterSearch.toLowerCase());
      if (!matchesSearch) return false;

      const isPresent = asistenciasRegistradas.includes(s.id);
      if (attendanceFilter === "presentes") return isPresent;
      if (attendanceFilter === "faltas") return !isPresent;
      return true;
    });
  }, [roster, rosterSearch, asistenciasRegistradas, attendanceFilter]);

  // Monthly stats helper per student
  const getStudentMonthlyStats = (studentId: string) => {
    const currentMonthPrefix = (selectedSessionDate || getTodayISO()).substring(0, 7);
    const monthSessions = currentClassSessions.filter(
      s => s.dateISO.startsWith(currentMonthPrefix) && s.dateISO <= getTodayISO()
    );
    const totalPossible = Math.max(1, monthSessions.length);
    const attendedCount = classAllAttendances.filter(
      a => a.alumno_id === studentId && a.fecha_hora && a.fecha_hora.startsWith(currentMonthPrefix)
    ).length;
    const faltasCount = Math.max(0, totalPossible - attendedCount);
    const percent = Math.min(100, Math.round((attendedCount / totalPossible) * 100));

    return { totalPossible, attendedCount, faltasCount, percent, currentMonthPrefix };
  };

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
                  {currentTeacher?.sede === "tejar" ? "Studio 1 Plaza El Tejar" : currentTeacher?.sede === "castilla" ? "Studio 2 Paseo Castilla" : "Consolidado (Ambas Sedes)"}
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
            <div className="w-full">
              {selectedClase ? (
                /* PASE DE LISTA DE LA CLASE SELECCIONADA */
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xl w-full">
                  {/* Botón Volver al Listado */}
                  <button
                    onClick={() => setSelectedClase(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-secondary)] hover:text-white bg-[var(--color-bg)] px-3 py-2 rounded-xl border border-[var(--color-border)] mb-4 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver a mis clases</span>
                  </button>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-[var(--color-border)] w-full">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-white">
                          {selectedClase.nombre_clase}
                        </h3>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20 truncate">
                          {selectedClase.dia_semana} {selectedClase.hora_inicio}-{selectedClase.hora_fin}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          isStudio1(selectedClase.sede) ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]' : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {isStudio1(selectedClase.sede) ? 'Studio 1' : 'Studio 2'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Control de asistencia por sesión y seguimiento mensual</p>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 shrink-0">
                        {asistenciasRegistradas.length} / {roster.length} Presentes
                      </span>
                    </div>
                  </div>

                  {/* Selector de Pestañas: 1. Pase de Lista de Sesión vs 2. Días que ha venido cada Alumno */}
                  <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] mb-4 shadow-inner">
                    <button
                      onClick={() => setClassViewTab("pase_lista")}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        classViewTab === "pase_lista"
                          ? "bg-[var(--color-secondary)] text-slate-950 font-black shadow-lg shadow-[var(--color-secondary)]/20"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Check size={15} />
                      <span>1. Pase de Lista de Sesión</span>
                    </button>
                    <button
                      onClick={() => setClassViewTab("dias_asistencia")}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        classViewTab === "dias_asistencia"
                          ? "bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <CalendarDays size={15} />
                      <span>2. Días que ha venido cada Alumno</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/30 text-white font-mono font-bold">
                        {roster.length}
                      </span>
                    </button>
                  </div>

                  {classViewTab === "dias_asistencia" ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Cabecera informativa */}
                      <div className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] shadow-md">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <CalendarDays size={16} className="text-emerald-400" />
                              <span>Registro Acumulado de Asistencias por Alumno</span>
                            </h4>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              Consulta nominal de todos los días exactos que ha venido cada alumno a {selectedClase.nombre_clase}.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsClassMonthlyModalOpen(true)}
                            className="text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <BarChart3 size={14} />
                            <span>Ver Matriz Mensual</span>
                          </button>
                        </div>

                        {/* Buscador dentro de días de asistencia */}
                        <div className="relative mt-3.5">
                          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-secondary)]" />
                          <input
                            type="text"
                            placeholder="Buscar alumno en esta clase..."
                            value={rosterSearch}
                            onChange={(e) => setRosterSearch(e.target.value)}
                            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Lista nominal de alumnos con los días que han venido */}
                      <div className="space-y-3">
                        {roster
                          .filter(s => {
                            if (!rosterSearch.trim()) return true;
                            const q = rosterSearch.toLowerCase();
                            return (
                              (s.nombre_completo || "").toLowerCase().includes(q) ||
                              (s.email || "").toLowerCase().includes(q) ||
                              (s.telefono || "").includes(q)
                            );
                          })
                          .map((student) => {
                            const attendedDates = Array.from(new Set(
                              classAllAttendances
                                .filter(a => a.alumno_id === student.id && a.fecha_hora)
                                .map(a => a.fecha_hora.substring(0, 10))
                            )).sort((a, b) => b.localeCompare(a));

                            return (
                              <div
                                key={student.id}
                                className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-emerald-500/40 transition-all flex flex-col gap-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-[var(--color-secondary)] flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md">
                                      {(student.nombre_completo || "A").split(" ").slice(0, 2).map((n: string) => n[0]).join("")}
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-white text-sm">
                                        {student.nombre_completo}
                                      </h5>
                                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                                        {student.plan_activo || "Alumno Regular"} {student.telefono ? `• ${student.telefono}` : ""}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border ${
                                      attendedDates.length > 0 
                                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                                    }`}>
                                      {attendedDates.length} {attendedDates.length === 1 ? "día asistido" : "días asistidos"}
                                    </span>
                                    <button
                                      onClick={() => setSelectedStudentForHistory(student)}
                                      className="p-1.5 px-2.5 rounded-lg bg-[var(--color-bg-card)] hover:bg-white/10 text-slate-300 hover:text-white border border-[var(--color-border)] text-xs font-semibold transition-colors cursor-pointer"
                                      title="Ver ficha completa y WhatsApp"
                                    >
                                      Ficha
                                    </button>
                                  </div>
                                </div>

                                {/* Chips de Fechas */}
                                <div className="pt-2 border-t border-[var(--color-border)]/60">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Días que ha venido a esta clase:
                                  </span>
                                  {attendedDates.length === 0 ? (
                                    <span className="text-xs text-slate-500 italic flex items-center gap-1.5 py-1">
                                      <AlertTriangle size={13} className="text-amber-500/70" />
                                      Sin asistencias registradas aún en esta clase.
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {attendedDates.map((dateISO) => {
                                        const [y, m, d] = dateISO.split("-");
                                        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                                        const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                                        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                                        const dayName = diasSemana[dateObj.getDay()];
                                        const monthName = meses[dateObj.getMonth()];
                                        const formattedDate = `${dayName} ${d} ${monthName}`;

                                        return (
                                          <button
                                            key={dateISO}
                                            onClick={() => {
                                              handleChangeSessionDate(dateISO);
                                              setClassViewTab("pase_lista");
                                            }}
                                            className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm hover:bg-emerald-500/25 transition-all cursor-pointer"
                                            title={`Ver pase de lista del ${formattedDate}`}
                                          >
                                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                                            <span>{formattedDate}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    <>
                  {/* UNIFIED SESSION DATE SWITCHER (PARA TODAS LAS CLASES: REGULARES Y OPEN) */}
                  <div className="space-y-2 bg-[var(--color-bg)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-md mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-[var(--color-secondary)]" />
                        <span>Sesión a Pasar Lista:</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 px-2 py-0.5 rounded-full">
                        {isOpenClass(selectedClase)
                          ? `${roster.length} inscritos / ${selectedClase.aforo_maximo || 20} max`
                          : `${roster.length} alumnos matriculados`}
                      </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                      {currentClassSessions.map((day) => {
                        const isSelected = selectedSessionDate === day.dateISO;
                        const sessionAttendeesCount = classAllAttendances.filter(a => a.fecha_hora && a.fecha_hora.startsWith(day.dateISO)).length;
                        const openCount = isOpenClass(selectedClase) ? getSesionReservasCount(selectedClase.id, day.dateISO) : 0;

                        return (
                          <button
                            key={day.dateISO}
                            onClick={() => handleChangeSessionDate(day.dateISO)}
                            className={`py-2 px-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer min-w-[76px] shrink-0 border text-center ${
                              isSelected
                                ? "bg-[var(--color-secondary)] text-slate-950 border-[var(--color-secondary)] font-extrabold shadow-md scale-105"
                                : "bg-[var(--color-bg-card)] text-slate-300 hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]"
                            }`}
                          >
                            <span className={`text-[9px] uppercase font-bold tracking-wider ${isSelected ? "text-slate-950" : "text-[var(--color-secondary)]"}`}>
                              {day.isToday ? "Hoy" : day.dayShort}
                            </span>
                            <span className="text-base font-mono font-black leading-tight">
                              {day.dayNumber}
                            </span>
                            <span className="text-[8px] opacity-80 uppercase">
                              {day.monthShort}
                            </span>
                            <span className={`mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none ${
                              isSelected 
                                ? "bg-slate-950/20 text-slate-950" 
                                : sessionAttendeesCount > 0 
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                                : "text-slate-500"
                            }`}>
                              {isOpenClass(selectedClase) 
                                ? (openCount > 0 ? `${openCount} res` : `${sessionAttendeesCount} pres`)
                                : `${sessionAttendeesCount} pres`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CONTROLES DEL ROSTER: FILTROS (TODOS/PRESENTES/FALTAS) & ACCIONES */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3.5">
                    {/* Tabs de Filtro */}
                    <div className="flex bg-[var(--color-bg)] p-1 rounded-xl border border-[var(--color-border)] text-xs">
                      <button
                        onClick={() => setAttendanceFilter("todos")}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer ${
                          attendanceFilter === "todos"
                            ? "bg-[var(--color-bg-card)] text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Todos ({roster.length})
                      </button>
                      <button
                        onClick={() => setAttendanceFilter("presentes")}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                          attendanceFilter === "presentes"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                            : "text-emerald-400/70 hover:text-emerald-300"
                        }`}
                      >
                        <Check size={12} />
                        <span>Presentes ({asistenciasRegistradas.length})</span>
                      </button>
                      <button
                        onClick={() => setAttendanceFilter("faltas")}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                          attendanceFilter === "faltas"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                            : "text-rose-400/70 hover:text-rose-300"
                        }`}
                      >
                        <X size={12} />
                        <span>Faltas ({Math.max(0, roster.length - asistenciasRegistradas.length)})</span>
                      </button>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap">
                      <button
                        onClick={() => setIsClassMonthlyModalOpen(true)}
                        className="text-xs font-bold bg-[var(--color-bg)] text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Ver matriz y resumen mensual de asistencias de la clase"
                      >
                        <BarChart3 size={13} />
                        <span>Resumen Mes</span>
                      </button>

                      {roster.length > 0 && (
                        <>
                          {asistenciasRegistradas.length < roster.length && (
                            <button
                              onClick={handleMarkAllPresent}
                              disabled={savingId === "ALL"}
                              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <Check size={13} />
                              <span>Todos Presentes</span>
                            </button>
                          )}
                          {asistenciasRegistradas.length > 0 && (
                            <button
                              onClick={handleClearAllPresent}
                              disabled={savingId === "ALL"}
                              className="text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <X size={13} />
                              <span>Desmarcar Todos</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Buscador de alumno dentro de la lista */}
                  {roster.length > 0 && (
                    <div className="relative mb-3.5 w-full">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar alumno o profesor en lista..."
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-[var(--color-secondary)] placeholder:text-slate-500"
                      />
                    </div>
                  )}

                  {isLoading ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--color-secondary)] border-t-transparent rounded-full animate-spin" />
                      <span>Cargando alumnos de la clase...</span>
                    </div>
                  ) : roster.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      {isOpenClass(selectedClase)
                        ? "No hay alumnos ni profesores inscritos para esta sesión."
                        : "No hay alumnos matriculados en esta clase."}
                    </div>
                  ) : filteredRoster.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      {attendanceFilter === "faltas"
                        ? "¡Genial! No hay faltas registradas en esta sesión. Todos los alumnos están marcados como presentes."
                        : attendanceFilter === "presentes"
                        ? "Todavía no se ha marcado ningún alumno como presente para esta sesión."
                        : `No se encontraron alumnos coincidentes con la búsqueda "${rosterSearch}".`}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[450px] overflow-y-auto pr-0.5 w-full">
                      {filteredRoster.map(student => {
                        const isPresent = asistenciasRegistradas.includes(student.id);
                        const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);
                        const isBonoExhausted = !isRegular && typeof student.clases_restantes === "number" && student.clases_restantes <= 0;
                        const hasPendingPayment = student.estado === "Pendiente" || (student.plan_activo || "").toLowerCase().includes("pendiente");
                        const stats = getStudentMonthlyStats(student.id);

                        return (
                          <div 
                            key={student.id} 
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all w-full ${
                              isPresent 
                                ? "bg-emerald-500/10 border-emerald-500/40" 
                                : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-slate-600"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-white truncate">
                                  {student.nombre_completo}
                                </span>
                                {student.is_docente && (
                                  <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                    DOCENTE
                                  </span>
                                )}
                                {isBonoExhausted && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    <AlertTriangle size={11} className="text-red-400" />
                                    <span>Bono Agotado</span>
                                  </span>
                                )}
                                {hasPendingPayment && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    <Clock size={11} className="text-amber-400" />
                                    <span>Pago Pendiente</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] text-slate-400">
                                  <strong className={isBonoExhausted ? "text-rose-400" : student.clases_restantes === 1 ? "text-amber-400" : "text-slate-300"}>
                                    {isRegular ? "Mensualidad Regular" : `${student.clases_restantes ?? 0} ${(student.clases_restantes === 1) ? "clase" : "clases"}`}
                                  </strong>
                                </span>

                                {/* Badge de Seguimiento Mensual (Interactivo para ver historial) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStudentForHistory(student);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                    stats.faltasCount === 0
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                      : stats.faltasCount === 1
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                      : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                  }`}
                                  title="Ver historial mensual detallado del alumno"
                                >
                                  <BarChart3 size={10} />
                                  <span>
                                    {stats.attendedCount}/{stats.totalPossible} este mes
                                    {stats.faltasCount > 0 ? ` (${stats.faltasCount} ${stats.faltasCount === 1 ? 'falta' : 'faltas'})` : " (100%)"}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Botón de Pase de Lista: ✓ Presente / ✗ Falta */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleToggleAsistencia(student)}
                                disabled={savingId === student.id}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm min-h-[38px] cursor-pointer ${
                                  isPresent
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : "bg-[var(--color-bg-card)] border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                                }`}
                              >
                                {savingId === student.id ? (
                                  "Guardando..."
                                ) : isPresent ? (
                                  <>
                                    <Check size={15} />
                                    <span>Presente</span>
                                  </>
                                ) : (
                                  <>
                                    <X size={15} className="text-rose-400" />
                                    <span>Falta</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </>
                  )}
                </div>
              ) : (
                /* Listado General de Mis Clases Semanales con Selector por Días */
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

                  {/* SELECTOR DE DÍAS DE LA SEMANA */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {["HOY", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "TODAS"].map((dayKey) => {
                      const isSelected = dayScheduleFilter === dayKey;
                      const dayMap: Record<string, string> = {
                        "LUN": "LUNES", "MAR": "MARTES", "MIÉ": "MIÉRCOLES",
                        "JUE": "JUEVES", "VIE": "VIERNES", "SÁB": "SÁBADO"
                      };
                      const count = dayKey === "TODAS" 
                        ? clasesProfesor.length 
                        : dayKey === "HOY" 
                        ? clasesProfesor.filter(c => normalizeDay(c.dia_semana) === normalizeDay(todayStr)).length
                        : clasesProfesor.filter(c => normalizeDay(c.dia_semana) === normalizeDay(dayMap[dayKey])).length;

                      return (
                        <button
                          key={dayKey}
                          onClick={() => setDayScheduleFilter(dayKey)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? "bg-[var(--color-secondary)] text-slate-950 font-extrabold shadow-md shadow-[var(--color-secondary)]/20"
                              : "bg-[var(--color-bg-card)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                          }`}
                        >
                          <span>{dayKey === "HOY" ? "📍 HOY" : dayKey}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? "bg-slate-950/20 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isLoading ? (
                    <p className="text-xs text-slate-400 py-8 text-center">Cargando tus clases...</p>
                  ) : clasesProfesor.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center space-y-2">
                      <Calendar size={32} className="mx-auto text-slate-500" />
                      <p className="text-xs text-slate-300 font-semibold">No tienes clases asignadas en el cuadrante actual.</p>
                      <p className="text-[11px] text-slate-500">Contacta con administración si necesitas añadir nuevas asignaciones.</p>
                    </div>
                  ) : filteredClases.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center space-y-3">
                      <p className="text-xs text-slate-300">
                        {dayScheduleFilter === "HOY" 
                          ? `No tienes clases asignadas programadas para hoy (${todayStr}).`
                          : `No tienes clases asignadas programadas para este día.`}
                      </p>
                      <button
                        onClick={() => setDayScheduleFilter("TODAS")}
                        className="text-xs font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/30 hover:bg-[var(--color-secondary)] hover:text-slate-950 px-3 py-1.5 rounded-xl transition-all"
                      >
                        Ver todas tus clases ({clasesProfesor.length})
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredClases.map((clase) => {
                        const isToday = normalizeDay(clase.dia_semana) === normalizeDay(todayStr);

                        return (
                          <div
                            key={clase.id}
                            onClick={() => handleSelectClase(clase)}
                            className={"p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md " + (
                              isToday
                                ? "bg-gradient-to-r from-[var(--color-secondary)]/15 via-[var(--color-bg-card)] to-[var(--color-bg-card)] border-[var(--color-secondary)]/40 hover:border-[var(--color-secondary)]"
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
                                <span>🏢 {isStudio1(clase.sede) ? "Studio 1 El Tejar" : "Studio 2 Castilla"}</span>
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

              {/* SELECTOR DE FECHAS EN CALENDARIO (Docentes) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-amber-400" />
                    <span>Elige el Día al que quieres Asistir</span>
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
                  {calendarDays.map((day) => {
                    const isSelected = selectedCalendarDay.dateISO === day.dateISO;
                    return (
                      <button
                        key={day.dateISO}
                        onClick={() => setSelectedCalendarDay(day)}
                        className={`py-2.5 px-3.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer min-w-[70px] shrink-0 border ${
                          isSelected
                            ? "bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-lg shadow-amber-500/30 scale-105"
                            : "bg-[var(--color-bg-card)] text-slate-300 hover:bg-[var(--color-bg-hover)] border-[var(--color-border)] font-medium"
                        }`}
                      >
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-slate-950" : "text-amber-400"}`}>
                          {day.isToday ? "Hoy" : day.dayShort}
                        </span>
                        <span className="text-lg font-mono font-black leading-tight mt-0.5">
                          {day.dayNumber}
                        </span>
                        <span className="text-[9px] opacity-80 uppercase">
                          {day.monthShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clases filtradas por el día seleccionado */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Sesiones para:</span>
                    <span className="text-amber-300 font-extrabold font-mono">
                      {selectedCalendarDay.dayName} {selectedCalendarDay.dayNumber} de {selectedCalendarDay.monthName}
                    </span>
                  </h3>
                </div>

                {allOpenClasses.filter(c => {
                  if (normalizeDay(c.dia_semana) !== normalizeDay(selectedCalendarDay.dayName)) return false;
                  const isRotativa = 
                    c.nombre_clase?.toUpperCase().includes("ROTAT") || 
                    c.profesor?.toUpperCase().includes("ROTAT") ||
                    (c.tipo_clase || "").toUpperCase().includes("ROTAT");
                  if (isRotativa) {
                    const selectedDate = new Date(selectedCalendarDay.dateISO + "T00:00:00");
                    const octoberStart = new Date("2026-10-01T00:00:00");
                    if (selectedDate < octoberStart) return false;
                  }
                  return true;
                }).length === 0 ? (
                  <div className="p-8 text-center space-y-2 bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] shadow-md">
                    <Calendar size={28} className="mx-auto text-slate-500" />
                    <p className="text-xs font-bold text-white">No hay sesiones de Open Class este {selectedCalendarDay.dayName.toLowerCase()}.</p>
                    <p className="text-[11px] text-slate-400">Prueba a seleccionar otro día en el carrusel superior.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {allOpenClasses
                      .filter(c => {
                        if (normalizeDay(c.dia_semana) !== normalizeDay(selectedCalendarDay.dayName)) return false;
                        const isRotativa = 
                          c.nombre_clase?.toUpperCase().includes("ROTAT") || 
                          c.profesor?.toUpperCase().includes("ROTAT") ||
                          (c.tipo_clase || "").toUpperCase().includes("ROTAT");
                        if (isRotativa) {
                          const selectedDate = new Date(selectedCalendarDay.dateISO + "T00:00:00");
                          const octoberStart = new Date("2026-10-01T00:00:00");
                          if (selectedDate < octoberStart) return false;
                        }
                        return true;
                      })
                      .map((clase) => {
                        const isBooked = isAlumnoReservadoEnSesion(
                          teacherStudent?.id || "",
                          clase.id,
                          selectedCalendarDay.dateISO
                        );
                        const isFull = isSesionCompleta(clase, selectedCalendarDay.dateISO);
                        const bookedCount = getSesionReservasCount(clase.id, selectedCalendarDay.dateISO);
                        const maxCap = clase.aforo_maximo || 20;

                        return (
                          <div
                            key={clase.id}
                            className={"p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md " + (
                              isBooked
                                ? "bg-gradient-to-r from-emerald-500/15 via-[var(--color-bg-card)] to-[var(--color-bg-card)] border-emerald-500/40"
                                : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-slate-600"
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                                  {clase.dia_semana} • {clase.hora_inicio} - {clase.hora_fin}
                                </span>
                                <span className={"text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border " + (
                                  isFull 
                                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                    : "bg-white/5 text-slate-300 border-white/10"
                                )}>
                                  {bookedCount} / {maxCap} plazas
                                </span>
                              </div>

                              <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-white">
                                {clase.nombre_clase}
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                Profesor/a titular: <strong className="text-white">{clase.profesor}</strong> • {clase.sede === "tejar" ? "Studio 1" : "Studio 2"} • {clase.sala || "Sala Principal"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                              {(() => {
                                const isRotativa = 
                                  clase.nombre_clase?.toUpperCase().includes("ROTAT") || 
                                  clase.profesor?.toUpperCase().includes("ROTAT") ||
                                  (clase.tipo_clase || "").toUpperCase().includes("ROTAT");

                                if (isRotativa) {
                                  return (
                                    <span className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                                      <Lock size={13} className="text-amber-400" />
                                      <span>Inscripción en Recepción</span>
                                    </span>
                                  );
                                }

                                if (isBooked) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                                        <Check size={14} />
                                        <span>Plaza Reservada</span>
                                      </span>
                                      <button
                                        onClick={() => handleTeacherCancelBooking(clase)}
                                        className="px-2.5 py-1.5 rounded-xl text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  );
                                }

                                if (isFull) {
                                  return (
                                    <span className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700">
                                      Agotado
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    onClick={() => handleTeacherOpenClassBooking(clase)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Ticket size={14} />
                                    <span>Reservar Plaza</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
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
                    <span className="text-slate-400">Sede Principal:</span>
                    <strong className="text-white">{currentTeacher?.sede === "tejar" ? "Studio 1 Plaza El Tejar" : currentTeacher?.sede === "castilla" ? "Studio 2 Paseo Castilla" : "Consolidado (Ambas Sedes)"}</strong>
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
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Subtotal Bono:</span>
                <span className="line-through text-slate-500 font-mono">{selectedBonoForPayment.precioOriginal}</span>
              </div>
              <div className="flex justify-between items-center text-[var(--color-secondary)]">
                <span>Descuento Docente (-10%):</span>
                <span className="font-mono font-bold">
                  {(() => {
                    const orig = parseFloat((selectedBonoForPayment.precioOriginal || "0").replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
                    const doc = parseFloat((selectedBonoForPayment.precioDocente || "0").replace(",", ".").replace(/[^0-9.]/g, "")) || (orig * 0.9);
                    const diff = orig - doc;
                    return `-${diff.toFixed(2).replace(".", ",")} € (-10%)`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-400">
                <span>Matrícula Anual:</span>
                <span className="font-bold font-mono">0,00 € (Exenta por perfil Docente)</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                <span className="font-bold text-slate-300">Total a pagar:</span>
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

      {/* MODAL: RESUMEN MENSUAL DE LA CLASE */}
      {isClassMonthlyModalOpen && selectedClase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] flex items-center justify-center shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-base sm:text-lg font-bold text-white">
                    Resumen Mensual de Asistencias
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedClase.nombre_clase} • {selectedClase.dia_semana} {selectedClase.hora_inicio}h ({getMonthNameSpanish((selectedSessionDate || getTodayISO()).substring(5, 7))} {(selectedSessionDate || getTodayISO()).substring(0, 4)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsClassMonthlyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Scrollable Table */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Quick Month Metrics */}
              {(() => {
                const currentMonthPrefix = (selectedSessionDate || getTodayISO()).substring(0, 7);
                const monthSessions = currentClassSessions.filter(s => s.dateISO.startsWith(currentMonthPrefix));
                const pastSessions = monthSessions.filter(s => s.dateISO <= getTodayISO());
                const pastSessionsCount = Math.max(1, pastSessions.length);
                const totalClassAtts = classAllAttendances.filter(a => a.fecha_hora && a.fecha_hora.startsWith(currentMonthPrefix)).length;
                const totalPossibleAll = roster.length * pastSessionsCount;
                const classAttendanceRate = totalPossibleAll > 0 ? Math.round((totalClassAtts / totalPossibleAll) * 100) : 0;

                return (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Alumnos en Lista</span>
                      <span className="text-lg font-mono font-bold text-white mt-0.5 block">{roster.length}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sesiones Impartidas</span>
                      <span className="text-lg font-mono font-bold text-amber-400 mt-0.5 block">{pastSessions.length} / {monthSessions.length}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tasa Asistencia Mes</span>
                      <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block">{classAttendanceRate}%</span>
                    </div>
                  </div>
                );
              })()}

              {/* Matrix Table */}
              {(() => {
                const currentMonthPrefix = (selectedSessionDate || getTodayISO()).substring(0, 7);
                const monthSessions = currentClassSessions.filter(s => s.dateISO.startsWith(currentMonthPrefix));
                const pastSessions = monthSessions.filter(s => s.dateISO <= getTodayISO());
                const pastSessionsCount = Math.max(1, pastSessions.length);

                return (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)] text-[11px] font-bold text-slate-300">
                        <tr>
                          <th className="p-3 font-semibold">Alumno ({roster.length})</th>
                          {monthSessions.map((session) => (
                            <th key={session.dateISO} className="p-2.5 text-center font-mono">
                              <span className="block text-[10px] text-slate-400 uppercase">{session.dayShort}</span>
                              <span className={`text-xs ${session.dateISO === selectedSessionDate ? "text-[var(--color-secondary)] font-black" : "text-slate-200"}`}>
                                {session.dayNumber} {session.monthShort}
                              </span>
                            </th>
                          ))}
                          <th className="p-2.5 text-center font-semibold">Total Asist.</th>
                          <th className="p-2.5 text-center font-semibold">Faltas</th>
                          <th className="p-2.5 text-center font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {roster.map((student) => {
                          const studentAtts = classAllAttendances.filter(
                            a => a.alumno_id === student.id && a.fecha_hora && a.fecha_hora.startsWith(currentMonthPrefix)
                          );
                          const attendedCount = studentAtts.length;
                          const faltasCount = Math.max(0, pastSessionsCount - attendedCount);
                          const rate = Math.min(100, Math.round((attendedCount / pastSessionsCount) * 100));

                          return (
                            <tr 
                              key={student.id} 
                              onClick={() => setSelectedStudentForHistory(student)}
                              className="hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                              <td className="p-3 font-medium text-white max-w-[160px] truncate group-hover:text-[var(--color-secondary)]">
                                {student.nombre_completo}
                              </td>
                              {monthSessions.map((session) => {
                                const isPastOrToday = session.dateISO <= getTodayISO();
                                const attendedSession = classAllAttendances.some(
                                  a => a.alumno_id === student.id && a.fecha_hora && a.fecha_hora.startsWith(session.dateISO)
                                );

                                return (
                                  <td key={session.dateISO} className="p-2 text-center">
                                    {!isPastOrToday ? (
                                      <span className="text-slate-600 text-xs">-</span>
                                    ) : attendedSession ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-xs border border-emerald-500/30">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 font-black text-xs border border-rose-500/30">
                                        ✗
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                                {attendedCount} / {pastSessionsCount}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">
                                <span className={faltasCount === 0 ? "text-emerald-400" : faltasCount === 1 ? "text-amber-400" : "text-rose-400"}>
                                  {faltasCount}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                  rate >= 80 
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                                    : rate >= 50 
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}>
                                  {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex justify-end shrink-0">
              <button
                onClick={() => setIsClassMonthlyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white hover:border-slate-500 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL Y DETALLE DEL ALUMNO */}
      {selectedStudentForHistory && selectedClase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg)] shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-white truncate">
                  {selectedStudentForHistory.nombre_completo}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {selectedStudentForHistory.plan_activo || "Alumno Regular"}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForHistory(null)}
                className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 ml-2"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Student Stats Summary */}
              {(() => {
                const stats = getStudentMonthlyStats(selectedStudentForHistory.id);
                return (
                  <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Asistencia este mes:</span>
                      <span className="font-mono font-bold text-white">
                        {stats.attendedCount} de {stats.totalPossible} clases ({stats.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          stats.percent >= 80 ? "bg-emerald-500" : stats.percent >= 50 ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1">
                      <span className="text-slate-400">Total Faltas:</span>
                      <span className={`font-bold ${stats.faltasCount === 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {stats.faltasCount} {stats.faltasCount === 1 ? "falta" : "faltas"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Sessions Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Desglose de Sesiones del Mes
                </span>

                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {currentClassSessions
                    .filter(s => s.dateISO.startsWith((selectedSessionDate || getTodayISO()).substring(0, 7)))
                    .map((session) => {
                      const isPastOrToday = session.dateISO <= getTodayISO();
                      const studentAtt = classAllAttendances.find(
                        a => a.alumno_id === selectedStudentForHistory.id && a.fecha_hora && a.fecha_hora.startsWith(session.dateISO)
                      );

                      return (
                        <div
                          key={session.dateISO}
                          className="p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">
                              {session.dayName} {session.dayNumber} de {session.monthName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {selectedClase.hora_inicio} - {selectedClase.hora_fin}h
                            </span>
                          </div>

                          {!isPastOrToday ? (
                            <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-slate-800">
                              Próxima
                            </span>
                          ) : studentAtt ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                              <Check size={12} /> Asistió
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                              <X size={12} /> Falta
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* WhatsApp Follow-up */}
              {selectedStudentForHistory.telefono && (
                <div className="pt-2">
                  <a
                    href={`https://wa.me/34${selectedStudentForHistory.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hola ${selectedStudentForHistory.nombre_completo}, te escribimos desde Dance Factory en relación a tus clases de ${selectedClase.nombre_clase} (${selectedClase.dia_semana} a las ${selectedClase.hora_inicio}h). Queríamos hacer seguimiento contigo. ¡Un saludo!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <MessageCircle size={15} />
                    <span>Contactar por WhatsApp (+34 {selectedStudentForHistory.telefono})</span>
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedStudentForHistory(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white hover:border-slate-500 transition-all cursor-pointer"
              >
                Cerrar
              </button>
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
