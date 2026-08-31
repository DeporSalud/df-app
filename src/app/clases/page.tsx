"use client";

import { useState, useEffect, Suspense } from "react";
import { 
  QrCode, 
  Calendar, 
  User, 
  Clock, 
  MapPin, 
  CheckCircle, 
  Info, 
  BookmarkCheck, 
  Building2, 
  CreditCard, 
  X, 
  Flame, 
  Sparkles, 
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
  Landmark,
  ShieldCheck,
  Smartphone,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudent } from "@/context/StudentContext";
import AppModal, { ModalState } from "@/components/AppModal";
import { logActivity } from "@/lib/activityLogger";
import StudentBottomNav from "@/components/StudentBottomNav";
import TeacherPortalView from "@/components/TeacherPortalView";
import { 
  getUpcomingCalendarDates, 
  CalendarDayItem, 
  isAlumnoReservadoEnSesion, 
  crearReservaOpenClass,
  normalizeDay,
  normalizeSede,
  formatSedeName,
  getSesionReservasCount,
  isSesionCompleta
} from "@/lib/openClassService";

const DEFAULT_STUDIO2_OPEN_CLASSES = [
  {
    id: "oc_lunes_1",
    nombre_clase: "OPEN CLASS: Comercial & Performance",
    profesor: "Andrea Soto",
    dia_semana: "LUNES",
    hora_inicio: "19:00",
    hora_fin: "20:30",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "oc_martes_1",
    nombre_clase: "OPEN CLASS: Heels & Choreo",
    profesor: "Alejandro Rovina",
    dia_semana: "MARTES",
    hora_inicio: "19:00",
    hora_fin: "20:30",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "oc_miercoles_1",
    nombre_clase: "OPEN CLASS: Urbano & Freestyle",
    profesor: "Lucas López",
    dia_semana: "MIÉRCOLES",
    hora_inicio: "19:00",
    hora_fin: "20:30",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "oc_jueves_1",
    nombre_clase: "OPEN CLASS: Jazz Funk & Lírico",
    profesor: "Eva Leiva",
    dia_semana: "JUEVES",
    hora_inicio: "19:00",
    hora_fin: "20:30",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "oc_viernes_1",
    nombre_clase: "OPEN CLASS: Contemporáneo Fusion",
    profesor: "Lucía Zamorano",
    dia_semana: "VIERNES",
    hora_inicio: "18:30",
    hora_fin: "20:00",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "oc_sabado_1",
    nombre_clase: "MASTER OPEN CLASS: Especial Fin de Semana",
    profesor: "Andrea Soto",
    dia_semana: "SÁBADO",
    hora_inicio: "11:30",
    hora_fin: "13:00",
    sede: "castilla",
    sala: "Sala Principal",
    aforo_maximo: 25,
    tipo_clase: "Open Class"
  }
];

function ClasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "bonos" ? "bonos" : tabParam === "openclass" ? "openclass" : "regulares";

  const { userRole, currentStudent, isLoading: isAuthLoading, isAuthenticated, refetchStudents } = useStudent();
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });
  const [activeTab, setActiveTab] = useState<"regulares" | "openclass" | "bonos">(initialTab);
  const [selectedBonoForPayment, setSelectedBonoForPayment] = useState<any | null>(null);

  if (userRole === "profesor") {
    const teacherTab = tabParam === "bonos" ? "comprar_bono" : tabParam === "openclass" ? "open_classes" : "mis_clases";
    return <TeacherPortalView initialTab={teacherTab} />;
  }

  // Calendar Days state for Open Class booking
  const calendarDays = getUpcomingCalendarDates(30);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayItem>(calendarDays[0]);

  // Selected session to book modal state
  const [bookingConfirmationModal, setBookingConfirmationModal] = useState<{
    isOpen: boolean;
    clase: any | null;
    calendarDay: CalendarDayItem | null;
  }>({
    isOpen: false,
    clase: null,
    calendarDay: null
  });

  const [clases, setClases] = useState<any[]>([]);
  const [openClasses, setOpenClasses] = useState<any[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [selectedSede, setSelectedSede] = useState<string>("tejar");
  const [selectedDay, setSelectedDay] = useState<string>("LUNES");
  const [isLoading, setIsLoading] = useState(true);

  const diasSemana = [
    { key: "LUNES", dia: "LUN" },
    { key: "MARTES", dia: "MAR" },
    { key: "MIÉRCOLES", dia: "MIÉ" },
    { key: "JUEVES", dia: "JUE" },
    { key: "VIERNES", dia: "VIE" },
  ];

  const bonosTarifas = [
    { 
      id: "Bono 4 clases", 
      nombre: "Bono 4 Clases", 
      precio: "45 €", 
      desc: "4 clases • Validez 30 días naturales • Acceso exclusivo a OPEN CLASS" 
    },
    { 
      id: "Bono 8 clases", 
      nombre: "Bono 8 Clases", 
      precio: "57 €", 
      desc: "8 clases (Recomendado) • Validez 30 días naturales • Acceso exclusivo a OPEN CLASS" 
    },
    { 
      id: "Bono 10 clases", 
      nombre: "Bono 10 Clases", 
      precio: "79 €", 
      desc: "10 clases • Validez 30 días naturales • Acceso exclusivo a OPEN CLASS" 
    },
    { 
      id: "Mensualidad Ilimitada", 
      nombre: "Pase Ilimitado Open Class", 
      precio: "100 € / mes", 
      desc: "Tarifa plana mensual • Acceso ilimitado a todas las OPEN CLASS de la escuela" 
    },
    { 
      id: "Clase Suelta", 
      nombre: "Clase Suelta Open Class", 
      precio: "15 €", 
      desc: "1 sesión puntual • Acceso a 1 sesión de OPEN CLASS" 
    }
  ];

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    if (tabParam === "bonos") setActiveTab("bonos");
    else if (tabParam === "openclass") {
      setActiveTab("openclass");
    }
    else if (tabParam === "regulares") setActiveTab("regulares");
  }, [tabParam]);

  const fetchClasesAndAssignments = async () => {
    setIsLoading(true);

    // 1. Fetch regular classes for selected Sede
    let regQuery = supabase.from("clases_cuadrante").select("*");
    if (selectedSede === "tejar") {
      regQuery = regQuery.in("sede", ["tejar", "studio", "mostoles"]);
    } else {
      regQuery = regQuery.in("sede", ["castilla", "alcorcon"]);
    }

    const { data: regClasses } = await regQuery;
    if (regClasses) {
      const regularesList = regClasses.filter(c => 
        normalizeDay(c.dia_semana) === normalizeDay(selectedDay) &&
        !c.nombre_clase.toUpperCase().includes("OPEN CLASS") &&
        !c.nombre_clase.toUpperCase().includes("FORMACI")
      );
      setClases(regularesList);
    }

    // 2. Open Classes are EXCLUSIVELY in Studio 2 (Paseo Castilla)
    const { data: studio2Classes } = await supabase
      .from("clases_cuadrante")
      .select("*")
      .in("sede", ["castilla", "alcorcon"]);

    let openList = (studio2Classes || []).filter(c => 
      c.tipo_clase === "Open Class" || 
      c.nombre_clase.toUpperCase().includes("OPEN CLASS") ||
      c.nombre_clase.toUpperCase().includes("FORMACI")
    );

    if (openList.length === 0) {
      openList = DEFAULT_STUDIO2_OPEN_CLASSES;
    }
    setOpenClasses(openList);

    if (currentStudent?.id) {
      const { data: assigned } = await supabase
        .from("alumnos_clases")
        .select("clase_id")
        .eq("alumno_id", currentStudent.id);
      
      if (assigned) {
        setAssignedClassIds(assigned.map(a => a.clase_id));
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchClasesAndAssignments();
  }, [selectedSede, selectedDay, currentStudent?.id]);

  // Filter Open Classes for the selected calendar day (Always Studio 2)
  const openClassesForSelectedDay = (openClasses.length > 0 ? openClasses : DEFAULT_STUDIO2_OPEN_CLASSES).filter(
    c => normalizeDay(c.dia_semana) === normalizeDay(selectedCalendarDay.dayName)
  );

  const handleOpenBookingModal = (clase: any) => {
    if (!currentStudent?.id) return;

    // Check capacity first
    if (isSesionCompleta(clase, selectedCalendarDay.dateISO)) {
      setModal({
        isOpen: true,
        title: "Plazas Agotadas (Completo)",
        message: `El aforo máximo (${clase.aforo_maximo || 20} plazas) para "${clase.nombre_clase}" el ${selectedCalendarDay.dayName.toLowerCase()} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName} está completo.`,
        type: "warning"
      });
      return;
    }

    // Check bono balance for Open Class
    const hasUnlimited = currentStudent.plan_activo?.toLowerCase().includes("ilimitad");
    const remainingClasses = typeof currentStudent.clases_restantes === "number" ? currentStudent.clases_restantes : 0;

    if (!hasUnlimited && remainingClasses <= 0) {
      setModal({
        isOpen: true,
        title: "Bono de Open Class Requerido",
        message: `Para reservar una Open Class en el calendario necesitas saldo de bono disponible (tienes ${remainingClasses} clases restantes).\n\nPuedes adquirir un bono de clases ahora mismo y reservar al instante.`,
        type: "warning",
        confirmText: "Comprar Bono",
        onConfirm: () => setActiveTab("bonos")
      });
      return;
    }

    // Open date confirmation modal
    setBookingConfirmationModal({
      isOpen: true,
      clase,
      calendarDay: selectedCalendarDay
    });
  };

  const handleConfirmReservation = async () => {
    const { clase, calendarDay } = bookingConfirmationModal;
    if (!clase || !calendarDay || !currentStudent?.id) return;

    // 1. Create calendar-specific reservation
    crearReservaOpenClass({
      alumno_id: currentStudent.id,
      alumno_nombre: currentStudent.nombre_completo,
      clase,
      calendarDay
    });

    // 2. Deduct 1 class from bono balance (if not unlimited)
    const hasUnlimited = currentStudent.plan_activo?.toLowerCase().includes("ilimitad");
    const remainingClasses = typeof currentStudent.clases_restantes === "number" ? currentStudent.clases_restantes : 0;

    if (!hasUnlimited) {
      const updatedBalance = Math.max(0, remainingClasses - 1);
      await supabase.from("alumnos").update({ clases_restantes: updatedBalance }).eq("id", currentStudent.id);
      if (refetchStudents) await refetchStudents();
    }

    // 3. Register enrollment in alumnos_clases as well
    try {
      await supabase.from("alumnos_clases").insert([{
        alumno_id: currentStudent.id,
        clase_id: clase.id
      }]);
    } catch (e) {
      // Ignored if duplicate
    }

    // Audit Log
    logActivity({
      origen: "alumno",
      tipo_evento: "reserva_bono",
      descripcion: `Reserva de Open Class para el ${calendarDay.dayName} ${calendarDay.dayNumber} de ${calendarDay.monthName}: "${clase.nombre_clase}" (${clase.hora_inicio}h con ${clase.profesor})`,
      usuario_afectado: currentStudent.nombre_completo,
      sede: formatSedeName(clase.sede)
    });

    setBookingConfirmationModal({ isOpen: false, clase: null, calendarDay: null });

    setModal({
      isOpen: true,
      title: "🎉 ¡Reserva Confirmada!",
      message: `Tu plaza para el ${calendarDay.dayName.toLowerCase()} ${calendarDay.dayNumber} de ${calendarDay.monthName} a las ${clase.hora_inicio}h en "${clase.nombre_clase}" con ${clase.profesor} ha quedado confirmada.\n\n¡Nos vemos en clase!`,
      type: "success",
      confirmText: "Ver Mis Clases",
      onConfirm: () => router.push("/mis-clases")
    });
  };

  const [paymentMethodTab, setPaymentMethodTab] = useState<"stripe" | "transferencia" | "recepcion">("stripe");
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Handle Stripe Payment Return
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId) {
      const verifyStripePayment = async () => {
        try {
          const res = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId })
          });
          const data = await res.json();
          if (data.success) {
            if (refetchStudents) await refetchStudents();
            setModal({
              isOpen: true,
              title: "🎉 ¡Pago con Tarjeta Completado!",
              message: `Has adquirido tu ${data.bonoName} por ${data.totalAmount} € mediante Stripe.\n\nTu saldo ha sido actualizado a ${data.updatedBalance === 999 ? "Ilimitado" : `${data.updatedBalance} clases`} disponibles para reservar en el calendario.`,
              type: "success",
              confirmText: "Reservar en Calendario",
              onConfirm: () => {
                setActiveTab("openclass");
                router.replace("/clases?tab=openclass");
              }
            });
          }
        } catch (e) {
          console.error("Error verificando sesión de Stripe:", e);
        }
      };
      verifyStripePayment();
    } else if (payment === "cancelled") {
      setModal({
        isOpen: true,
        title: "Pago Cancelado",
        message: "El proceso de pago con tarjeta en Stripe no se completó. No se ha realizado ningún cargo.",
        type: "info"
      });
      router.replace("/clases?tab=bonos");
    }
  }, [router, refetchStudents]);

  const handleCopy = (text: string, fieldId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const handleStripeCheckout = async () => {
    if (!selectedBonoForPayment || !currentStudent?.id) return;
    setIsStripeLoading(true);

    try {
      const isFirstBonoOfYear = !currentStudent?.matricula_pagada;
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bonoId: selectedBonoForPayment.id,
          studentId: currentStudent.id,
          studentName: currentStudent.nombre_completo,
          studentEmail: currentStudent.email,
          isFirstBonoOfYear,
          returnUrl: window.location.origin + "/clases"
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setModal({
          isOpen: true,
          title: "Error con la Pasarela de Pago",
          message: data.error || "No se pudo iniciar la sesión de Stripe. Inténtalo de nuevo.",
          type: "warning"
        });
        setIsStripeLoading(false);
      }
    } catch (err: any) {
      console.error("Error initiating Stripe checkout:", err);
      setModal({
        isOpen: true,
        title: "Error de Conexión",
        message: "No se pudo contactar con la pasarela de pagos.",
        type: "warning"
      });
      setIsStripeLoading(false);
    }
  };

  const handleConfirmarTransferencia = async () => {
    if (!selectedBonoForPayment || !currentStudent?.id) return;

    const basePrice = parseFloat(selectedBonoForPayment.precio.replace(/[^0-9.]/g, "")) || 45;
    const isFirstBonoOfYear = !currentStudent?.matricula_pagada;
    const matriculaCost = isFirstBonoOfYear ? 15.00 : 0.00;
    const totalAmount = basePrice + matriculaCost;

    if (typeof window !== "undefined") {
      try {
        const rawReqs = localStorage.getItem("pending_bono_requests");
        const reqs = rawReqs ? JSON.parse(rawReqs) : [];
        const newReq = {
          id: "req_transf_" + Date.now(),
          student_id: currentStudent.id,
          student_name: currentStudent.nombre_completo,
          student_email: currentStudent.email || "",
          bono_nombre: isFirstBonoOfYear 
            ? `${selectedBonoForPayment.nombre} (+15€ Matrícula)` 
            : selectedBonoForPayment.nombre,
          bono_precio: `${totalAmount.toFixed(2)} €`,
          metodo_pago: "Transferencia Bancaria",
          fecha: new Date().toLocaleDateString("es-ES"),
          sede: normalizeSede(currentStudent.sede || "tejar")
        };
        localStorage.setItem("pending_bono_requests", JSON.stringify([newReq, ...reqs]));
        window.dispatchEvent(new Event("df_pending_bonos_updated"));
      } catch (e) {
        console.error("Error saving pending transfer request:", e);
      }
    }

    logActivity({
      origen: "alumno",
      tipo_evento: "reserva_bono",
      descripcion: `Solicitud de ${selectedBonoForPayment.nombre} (${totalAmount.toFixed(2)} €) por Transferencia Bancaria`,
      usuario_afectado: currentStudent.nombre_completo,
      sede: formatSedeName(currentStudent.sede || "tejar")
    });

    setSelectedBonoForPayment(null);
    setModal({
      isOpen: true,
      title: "✓ Transferencia Notificada a Recepción",
      message: `Hemos registrado tu solicitud para el ${selectedBonoForPayment.nombre} por un importe de ${totalAmount.toFixed(2)} € mediante Transferencia Bancaria.\n\nEn cuanto recepción verifique la recepción del importe en la cuenta de Santander o CaixaBank, tu saldo se actualizará automáticamente.`,
      type: "success",
      confirmText: "Aceptar"
    });
  };

  const handleSolicitarRecepcion = async () => {
    if (!selectedBonoForPayment || !currentStudent?.id) return;

    const basePrice = parseFloat(selectedBonoForPayment.precio.replace(/[^0-9.]/g, "")) || 45;
    const isFirstBonoOfYear = !currentStudent?.matricula_pagada;
    const matriculaCost = isFirstBonoOfYear ? 15.00 : 0.00;
    const totalAmount = basePrice + matriculaCost;

    if (typeof window !== "undefined") {
      try {
        const rawReqs = localStorage.getItem("pending_bono_requests");
        const reqs = rawReqs ? JSON.parse(rawReqs) : [];
        const newReq = {
          id: "req_rec_" + Date.now(),
          student_id: currentStudent.id,
          student_name: currentStudent.nombre_completo,
          student_email: currentStudent.email || "",
          bono_nombre: isFirstBonoOfYear 
            ? `${selectedBonoForPayment.nombre} (+15€ Matrícula)` 
            : selectedBonoForPayment.nombre,
          bono_precio: `${totalAmount.toFixed(2)} €`,
          metodo_pago: "Recepción (Efectivo/Datáfono)",
          fecha: new Date().toLocaleDateString("es-ES"),
          sede: normalizeSede(currentStudent.sede || "tejar")
        };
        localStorage.setItem("pending_bono_requests", JSON.stringify([newReq, ...reqs]));
        window.dispatchEvent(new Event("df_pending_bonos_updated"));
      } catch (e) {
        console.error("Error saving pending bono request:", e);
      }
    }

    logActivity({
      origen: "alumno",
      tipo_evento: "reserva_bono",
      descripcion: `Solicitud de ${selectedBonoForPayment.nombre} (${totalAmount.toFixed(2)} €) para abonar en recepción`,
      usuario_afectado: currentStudent.nombre_completo,
      sede: formatSedeName(currentStudent.sede || "tejar")
    });

    setSelectedBonoForPayment(null);
    setModal({
      isOpen: true,
      title: "✓ Solicitud Registrada",
      message: `Hemos registrado tu petición para el ${selectedBonoForPayment.nombre} por un importe de ${totalAmount.toFixed(2)} €${isFirstBonoOfYear ? " (incluye 15 € de matrícula anual)" : ""}.\n\nPodrás abonarlo en la recepción de tu estudio (en efectivo o datáfono) cuando asistas a tu próxima clase.`,
      type: "info",
      confirmText: "Aceptar"
    });
  };

  return (
    <div className="flex flex-col flex-1 w-full bg-[var(--color-bg)] overflow-x-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36">
        {/* Header */}
        <header className="p-5 pt-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40 gap-2">
          <div>
            <h1 className="text-2xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
              {activeTab === "regulares" ? "Clases Regulares" : activeTab === "openclass" ? "Open Class en Calendario" : "Comprar Bono"}
            </h1>
          </div>
          {activeTab === "regulares" && (
            <select
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              className="text-xs font-bold bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] border border-[var(--color-secondary)]/40 rounded-xl px-3 py-2 outline-none cursor-pointer shadow-md hover:bg-[var(--color-secondary)]/25 transition-all shrink-0 max-w-[170px] truncate"
            >
              <option value="tejar" className="bg-[#0f172a] text-white">Studio 1 Plaza El Tejar</option>
              <option value="castilla" className="bg-[#0f172a] text-white">Studio 2 Paseo Castilla</option>
            </select>
          )}
          {activeTab === "openclass" && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shrink-0">
              <MapPin size={13} className="text-amber-400" />
              <span>Studio 2 (P.º Castilla)</span>
            </div>
          )}
        </header>

        {/* 3-Tab Switcher: Clases Regulares | Open Class | Comprar Bono */}
        <div className="bg-[var(--color-bg-card)] px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-center">
          <div className="flex bg-[var(--color-bg)] p-1 rounded-2xl border border-[var(--color-border)] w-full max-w-md gap-1">
            <button
              onClick={() => setActiveTab("regulares")}
              className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center ${
                activeTab === "regulares"
                  ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Clases Regulares
            </button>
            <button
              onClick={() => setActiveTab("openclass")}
              className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                activeTab === "openclass"
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              <Flame size={13} />
              <span>Open Class</span>
            </button>
            <button
              onClick={() => setActiveTab("bonos")}
              className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center ${
                activeTab === "bonos"
                  ? "bg-[var(--color-secondary)] text-slate-950 shadow-lg shadow-[var(--color-secondary)]/20 font-extrabold"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              🎟️ Bonos
            </button>
          </div>
        </div>

        {/* TAB 1: CLASES REGULARES */}
        {activeTab === "regulares" && (
          <>
            {/* Days Selector */}
            <div className="flex justify-between p-4 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] gap-2 overflow-x-auto scrollbar-none">
              {diasSemana.map((item) => {
                const isSelected = selectedDay === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSelectedDay(item.key)}
                    className={`flex-1 py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer min-w-[58px] ${
                      isSelected
                        ? "bg-gradient-to-br from-[var(--color-primary)] to-indigo-600 text-white shadow-lg shadow-[var(--color-primary)]/30 font-bold scale-105"
                        : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] font-medium"
                    }`}
                  >
                    <span className="text-[11px] tracking-wider uppercase">{item.dia}</span>
                    <span className="text-[9px] mt-0.5 opacity-80">{item.key.slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>

            {/* List of Regular Classes */}
            <main className="p-6 space-y-4">
              {isLoading ? (
                <div className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
                  Cargando clases regulares...
                </div>
              ) : clases.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)]">
                  No hay clases programadas para este día en la sede seleccionada.
                </div>
              ) : (
                clases.map((clase) => {
                  const isEnrolled = assignedClassIds.includes(clase.id);
                  return (
                    <div 
                      key={clase.id} 
                      className={`rounded-2xl border p-5 bg-[var(--color-bg-card)] transition-all shadow-md relative overflow-hidden ${
                        isEnrolled 
                          ? "border-[var(--color-success)]/40 bg-gradient-to-r from-[var(--color-success)]/10 to-[var(--color-bg-card)]" 
                          : "border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-primary)]/20 inline-block mb-1.5">
                            {clase.dia_semana}
                          </span>
                          <h3 className="text-lg font-[family-name:var(--font-heading)] text-white tracking-wide">{clase.nombre_clase}</h3>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Profesor/a: <strong className="text-white">{clase.profesor}</strong></p>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="flex items-center gap-1 text-[var(--color-primary)] font-mono font-bold text-sm bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-lg border border-[var(--color-primary)]/20">
                            <Clock size={14} />
                            <span>{clase.hora_inicio}h</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          Aforo: <strong className="text-white">{clase.aforo_maximo} plazas</strong>
                        </span>

                        {isEnrolled ? (
                          <span className="text-xs font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 px-3 py-1.5 rounded-xl border border-[var(--color-success)]/20">
                            ✓ Incluido en tu matrícula
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-sm">
                            🏢 Curso Regular (Matrícula en Recepción)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </main>
          </>
        )}

        {/* TAB 2: OPEN CLASS CON SELECTOR DE CALENDARIO ESPECÍFICO */}
        {activeTab === "openclass" && (
          <main className="p-6 space-y-5">
            {/* Banner Informativo Exclusividad Studio 2 */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <strong className="block text-white font-bold text-xs">Sede Oficial Open Classes: Studio 2</strong>
                  <span className="text-[11px] text-slate-300">Paseo de Castilla, 41 (Alcorcón)</span>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30 shrink-0">
                Solo en Studio 2
              </span>
            </div>

            {/* SELECTOR DE FECHAS EN CALENDARIO (Próximos días de la academia) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-amber-400" />
                  <span>Selecciona el Día del Calendario</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  Saldo: {currentStudent?.clases_restantes || 0} clases
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

            {/* Open Classes for the Selected Day */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Sesiones para:</span>
                  <span className="text-amber-300 font-extrabold font-mono">{selectedCalendarDay.dayName} {selectedCalendarDay.dayNumber} de {selectedCalendarDay.monthName}</span>
                </h2>
                <span className="text-[10px] text-slate-400">
                  {openClassesForSelectedDay.length} {openClassesForSelectedDay.length === 1 ? "sesión" : "sesiones"}
                </span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">Cargando Open Classes...</div>
              ) : openClassesForSelectedDay.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-[var(--color-bg-card)] rounded-3xl border border-[var(--color-border)] my-2 shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                    <Calendar size={24} />
                  </div>
                  <p className="text-xs font-bold text-white">No hay Open Classes programadas para este {selectedCalendarDay.dayName.toLowerCase()}.</p>
                  <p className="text-[11px] text-slate-400">Prueba a seleccionar otro día del calendario arriba.</p>
                </div>
              ) : (
                openClassesForSelectedDay.map((clase) => {
                  const isReservedForThisDate = isAlumnoReservadoEnSesion(
                    currentStudent?.id || "",
                    clase.id,
                    selectedCalendarDay.dateISO
                  );
                  const isFull = isSesionCompleta(clase, selectedCalendarDay.dateISO);
                  const isFormacion = clase.nombre_clase.toUpperCase().includes("FORMACI");

                  return (
                    <div 
                      key={clase.id} 
                      className={`rounded-3xl border p-5 relative overflow-hidden transition-all shadow-xl ${
                        isReservedForThisDate 
                          ? "bg-gradient-to-r from-emerald-500/15 via-[var(--color-bg-card)] to-[var(--color-bg-card)] border-emerald-500/60" 
                          : isFormacion
                          ? "bg-gradient-to-r from-purple-500/10 to-[var(--color-bg-card)] border-purple-500/30"
                          : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-amber-400/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                              <Flame size={12} />
                              Open Class
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                              📅 {selectedCalendarDay.dayShort} {selectedCalendarDay.dayNumber} {selectedCalendarDay.monthShort}
                            </span>
                          </div>

                          <h3 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">{clase.nombre_clase}</h3>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Profesor/a: <strong className="text-white">{clase.profesor}</strong></p>
                        </div>

                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="flex items-center gap-1 text-amber-400 font-mono font-bold text-base bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 shadow-inner">
                            <Clock size={15} />
                            <span>{clase.hora_inicio}h</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          Plazas: <strong className="text-white">{clase.aforo_maximo || 20} aforo</strong>
                        </span>

                        {isReservedForThisDate ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                            <CheckCircle2 size={15} />
                            <span>Plaza Reservada</span>
                          </span>
                        ) : isFull ? (
                          <span className="text-xs font-bold text-rose-400 bg-rose-500/15 px-3.5 py-1.5 rounded-xl border border-rose-500/30 flex items-center gap-1.5">
                            <AlertCircle size={15} />
                            <span>Plazas Agotadas (Completo)</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenBookingModal(clase)}
                            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-500/25 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Calendar size={14} />
                            <span>Reservar Sesión (1 Clase)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>
        )}

        {/* TAB 3: COMPRAR BONO */}
        {activeTab === "bonos" && (
          <main className="p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/30 text-xs text-[var(--color-text-secondary)] space-y-1 shadow-lg">
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>🎟️</span>
                <span>Bonos Oficiales Dance Factory</span>
              </h2>
              <p className="text-[11px] text-[var(--color-secondary)] font-semibold leading-relaxed">
                Los bonos dan acceso exclusivo para reservar sesiones en el <strong>calendario de OPEN CLASS de Studio 2 (Paseo de Castilla, 41)</strong>. Elige el bono que mejor se adapte a tu ritmo.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {bonosTarifas.map((bono) => (
                <div 
                  key={bono.id} 
                  className="rounded-2xl border p-5 bg-[var(--color-bg-card)] border-[var(--color-border)] relative overflow-hidden transition-all shadow-lg hover:border-[var(--color-secondary)]/50"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-[family-name:var(--font-heading)] text-white tracking-wide">{bono.nombre}</h3>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">{bono.desc}</p>
                    </div>
                    
                    <span className="text-xl font-bold font-mono text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-xl border border-[var(--color-secondary)]/30 shrink-0 mt-1">
                      {bono.precio}
                    </span>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex justify-end">
                    <button
                      onClick={() => setSelectedBonoForPayment(bono)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 text-slate-950 transition-all shadow-lg shadow-[var(--color-secondary)]/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Comprar Bono ({bono.precio})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
      </div>

      {/* MODAL: CONFIRMACIÓN DE RESERVA DE SESIÓN EN CALENDARIO */}
      {bookingConfirmationModal.isOpen && bookingConfirmationModal.clase && bookingConfirmationModal.calendarDay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Calendar size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Confirmar Reserva de Sesión</h3>
                  <span className="text-[10px] text-amber-300 font-semibold uppercase">Open Class en Calendario</span>
                </div>
              </div>
              <button
                onClick={() => setBookingConfirmationModal({ isOpen: false, clase: null, calendarDay: null })}
                className="text-slate-400 hover:text-white cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Detalles de la sesión */}
            <div className="space-y-2.5 text-xs bg-[var(--color-bg)] p-4 rounded-2xl border border-[var(--color-border)]">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400">📅 Fecha:</span>
                <strong className="text-white font-bold font-mono">
                  {bookingConfirmationModal.calendarDay.dayName} {bookingConfirmationModal.calendarDay.dayNumber} de {bookingConfirmationModal.calendarDay.monthName}
                </strong>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400">⏰ Horario:</span>
                <strong className="text-amber-400 font-bold font-mono">
                  {bookingConfirmationModal.clase.hora_inicio}h - {bookingConfirmationModal.clase.hora_fin || "20:00"}h
                </strong>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400">💃 Clase:</span>
                <strong className="text-white font-bold">{bookingConfirmationModal.clase.nombre_clase}</strong>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400">👤 Profesor/a:</span>
                <strong className="text-white">{bookingConfirmationModal.clase.profesor}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">🏢 Sede:</span>
                <strong className="text-slate-300">
                  {formatSedeName(bookingConfirmationModal.clase.sede)}
                </strong>
              </div>
            </div>

            {/* Balance check */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex items-center justify-between">
              <span>Saldo de bono disponible:</span>
              <strong className="font-mono text-sm text-white">{currentStudent?.clases_restantes || 0} clases</strong>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setBookingConfirmationModal({ isOpen: false, clase: null, calendarDay: null })}
                className="flex-1 py-3 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-slate-300 text-xs font-bold border border-[var(--color-border)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReservation}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-all shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer"
              >
                Confirmar (1 Clase)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT DE BONO (3 MÉTODOS DE PAGO) */}
      {selectedBonoForPayment && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)] block">Pasarela Oficial</span>
                <h3 className="text-base font-extrabold text-white">Comprar {selectedBonoForPayment.nombre}</h3>
              </div>
              <button
                onClick={() => setSelectedBonoForPayment(null)}
                className="w-8 h-8 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white flex items-center justify-center cursor-pointer border border-[var(--color-border)] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Price Summary Breakdown */}
            {(() => {
              const basePrice = parseFloat(selectedBonoForPayment.precio.replace(/[^0-9.]/g, "")) || 45;
              const isFirstBono = !currentStudent?.matricula_pagada;
              const matriculaCost = isFirstBono ? 15.00 : 0.00;
              const totalToPay = basePrice + matriculaCost;

              return (
                <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Subtotal {selectedBonoForPayment.nombre}:</span>
                    <span className="font-mono font-bold text-white">{basePrice.toFixed(2)} €</span>
                  </div>

                  {isFirstBono ? (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-amber-300 block">Matrícula Anual Oficial</span>
                        <span className="text-[10px] text-slate-400">Inscripción anual de temporada (1er bono)</span>
                      </div>
                      <span className="font-mono font-bold text-amber-400 text-sm">+15.00 €</span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400">
                      <span>Matrícula Anual 2026/2027:</span>
                      <span className="font-bold">✓ Abonada (0,00 €)</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs font-bold text-slate-300">Total Final a Abonar:</span>
                    <span className="text-2xl font-black font-mono text-[var(--color-secondary)]">
                      {totalToPay.toFixed(2)} €
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Payment Method Tabs */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Selecciona Método de Pago:
              </label>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] text-center">
                <button
                  type="button"
                  onClick={() => setPaymentMethodTab("stripe")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    paymentMethodTab === "stripe"
                      ? "bg-[var(--color-primary)] text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard size={15} />
                  <span>Stripe</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodTab("transferencia")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    paymentMethodTab === "transferencia"
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Landmark size={15} />
                  <span>Transferencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodTab("recepcion")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    paymentMethodTab === "recepcion"
                      ? "bg-[var(--color-secondary)] text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Building2 size={15} />
                  <span>Recepción</span>
                </button>
              </div>
            </div>

            {/* TAB 1: STRIPE CHECKOUT */}
            {paymentMethodTab === "stripe" && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="p-3 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <ShieldCheck size={16} className="text-[var(--color-secondary)]" />
                    <span>Pago Seguro con Tarjeta y Apple/Google Pay</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Serás redirigido a la pasarela bancaria cifrada de Stripe. Tu saldo de bono se activará al instante tras completar el pago.
                  </p>
                </div>

                <button
                  onClick={handleStripeCheckout}
                  disabled={isStripeLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/25 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {isStripeLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Conectando con Stripe...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>Pagar con Tarjeta / Apple Pay</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: TRANSFERENCIA BANCARIA (1-CLICK COPY) */}
            {paymentMethodTab === "transferencia" && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <p className="text-[11px] text-slate-400 leading-tight">
                  Realiza una transferencia a cualquiera de nuestras cuentas oficiales de Dance Factory. Pulsa en cada dato para copiarlo:
                </p>

                {/* Santander Card */}
                <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-red-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      Banco Santander
                    </span>
                    <button
                      onClick={() => handleCopy("ES9600490566112210634052", "santander")}
                      className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-[10px] font-bold border border-red-500/30 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      {copiedField === "santander" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedField === "santander" ? "¡Copiado!" : "Copiar IBAN"}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs font-bold text-white tracking-wider">
                    ES96 0049 0566 1122 1063 4052
                  </p>
                </div>

                {/* CaixaBank Card */}
                <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-blue-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      CaixaBank
                    </span>
                    <button
                      onClick={() => handleCopy("ES9521002852480210377186", "caixa")}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-[10px] font-bold border border-blue-500/30 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      {copiedField === "caixa" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedField === "caixa" ? "¡Copiado!" : "Copiar IBAN"}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs font-bold text-white tracking-wider">
                    ES95 2100 2852 4802 1037 7186
                  </p>
                </div>

                {/* Concepto Card */}
                {(() => {
                  const conceptText = `Bono ${currentStudent?.nombre_completo || "Alumno"}`;
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Concepto de Transferencia:</span>
                        <span className="font-bold text-amber-300">{conceptText}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(conceptText, "concepto")}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        {copiedField === "concepto" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedField === "concepto" ? "¡Copiado!" : "Copiar"}</span>
                      </button>
                    </div>
                  );
                })()}

                <button
                  onClick={handleConfirmarTransferencia}
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer transition-all active:scale-95"
                >
                  <CheckCircle2 size={16} />
                  <span>He Realizado la Transferencia</span>
                </button>
              </div>
            )}

            {/* TAB 3: PAGO EN RECEPCIÓN */}
            {paymentMethodTab === "recepcion" && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Building2 size={16} className="text-[var(--color-secondary)]" />
                    <span>Abonar en el Mostrador de Recepción</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Tu petición quedará registrada en el sistema de la escuela. Podrás abonar el importe en efectivo o con datáfono en <strong>Studio 1 (Plaza El Tejar)</strong> o <strong>Studio 2 (Paseo Castilla)</strong> antes de entrar a tu clase.
                  </p>
                </div>

                <button
                  onClick={handleSolicitarRecepcion}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-secondary)]/20 cursor-pointer transition-all active:scale-95"
                >
                  <Building2 size={16} />
                  <span>Solicitar para Abonar en Recepción</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Universal Alert Modal */}
      <AppModal 
        modal={modal}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Bottom Nav */}
      <StudentBottomNav />
    </div>
  );
}

export default function ClasesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-white text-xs">Cargando clases...</div>}>
      <ClasesContent />
    </Suspense>
  );
}
