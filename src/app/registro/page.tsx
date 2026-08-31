"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Phone, 
  CreditCard, 
  Lock, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  ChevronLeft,
  CheckCircle2,
  MailCheck,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { useStudent } from "@/context/StudentContext";
import OtpVerificationModal from "@/components/OtpVerificationModal";

export default function RegistroPage() {
  const router = useRouter();
  const { registerStudent, verifyStudentWithOtp } = useStudent();

  const [formData, setFormData] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
    dni: "",
    fecha_nacimiento: ""
  });

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.name === "dni" ? e.target.value.toUpperCase() : e.target.value;
    setFormData(prev => ({
      ...prev,
      [e.target.name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!acceptTerms) {
      setErrorMsg("Debes aceptar la política de protección de datos de la escuela para continuar.");
      return;
    }

    if (!formData.nombre_completo.trim() || !formData.email.trim() || !formData.telefono.trim()) {
      setErrorMsg("Por favor, completa los campos obligatorios marcados con asterisco (*).");
      return;
    }

    setIsSubmitting(true);

    const res = await registerStudent({
      nombre_completo: formData.nombre_completo.trim(),
      email: formData.email.trim().toLowerCase(),
      telefono: formData.telefono.trim(),
      dni: formData.dni.trim().toUpperCase(),
      fecha_nacimiento: formData.fecha_nacimiento || undefined,
      sede: "tejar",
      plan_activo: "Sin Plan Activo"
    });

    if (res.success) {
      // Transition to email verification screen
      setRegisteredEmail(formData.email.trim().toLowerCase());
    } else {
      setErrorMsg(res.error || "Ocurrió un error al crear la cuenta. Inténtalo de nuevo.");
      setIsSubmitting(false);
    }
  };

  // IF REGISTRATION COMPLETED -> SHOW OTP VERIFICATION MODAL
  if (registeredEmail) {
    return (
      <OtpVerificationModal
        email={registeredEmail}
        title="Verifica tu Cuenta"
        subtitle="Introduce el código One Time PIN (OTP) de 6 dígitos enviado a tu correo:"
        onVerifyCode={async (code) => {
          return await verifyStudentWithOtp(registeredEmail, code);
        }}
        onSuccess={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }}
        onCancel={() => {
          setRegisteredEmail(null);
          setIsSubmitting(false);
        }}
      />
    );
  }

  return (
    <div className="w-full flex-1 bg-[var(--color-bg)] flex flex-col justify-start p-4 sm:p-5 text-left relative overflow-x-hidden pb-36">
      {/* Glow Effects (Contained) */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--color-primary)]/15 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl pointer-events-none -ml-8 -mb-8"></div>

      <div className="w-full max-w-md mx-auto space-y-4 relative z-10 py-1">
        
        {/* Top Back Nav */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl"
          >
            <ChevronLeft size={16} />
            <span>Volver a Iniciar Sesión</span>
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2.5 py-1 rounded-full border border-[var(--color-secondary)]/20">
            NUEVO ALUMNO
          </span>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-tight">
            Registro de Alumno
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Introduce tus datos para acceder a tu carnet digital y clases en Dance Factory.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-2xl space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-danger)] animate-ping shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            
            {/* 1. Nombre y Apellidos */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-title)] uppercase tracking-wider block">
                Nombre y Apellidos <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  name="nombre_completo"
                  required
                  value={formData.nombre_completo}
                  onChange={handleChange}
                  placeholder="ej. Laura Sánchez Gómez"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* 2. Email */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-title)] uppercase tracking-wider block">
                Correo Electrónico <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="laura@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* 3. Teléfono */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-title)] uppercase tracking-wider block">
                Teléfono Móvil <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="tel"
                  name="telefono"
                  required
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="600 123 456"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* 4. DNI */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-title)] uppercase tracking-wider block">
                DNI / NIE
              </label>
              <div className="relative flex items-center">
                <CreditCard className="absolute left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  name="dni"
                  value={formData.dni}
                  onChange={handleChange}
                  placeholder="12345678X"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* 5. Fecha de Nacimiento */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-title)] uppercase tracking-wider block">
                Fecha de Nacimiento
              </label>
              <div className="relative flex items-center">
                <Calendar className="absolute left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
            </div>

            {/* Aviso de Acceso Seguro sin Contraseña */}
            <div className="p-3 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[11px] text-slate-300 space-y-1">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-[var(--color-secondary)]" />
                <span>Acceso Seguro sin Contraseña</span>
              </p>
              <p className="text-[10.5px] text-slate-400 leading-normal">
                No necesitas recordar contraseñas. Te enviaremos un código One Time PIN (OTP) a tu correo para activar y acceder a tu carnet digital.
              </p>
            </div>

            {/* Términos y LOPD */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                />
                <span className="leading-tight">
                  He leído y acepto la política de protección de datos (LOPD) de Dance Factory.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>{isSubmitting ? "Registrando datos..." : "Registrarme y Activar Cuenta"}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

        </div>

        {/* Link to Login */}
        <div className="text-center pt-1 space-y-2">
          <p className="text-xs text-[var(--color-text-secondary)]">
            ¿Ya tienes cuenta en Dance Factory?{" "}
            <Link href="/login" className="text-[var(--color-primary)] hover:underline font-bold">
              Iniciar Sesión
            </Link>
          </p>

          <p className="text-[11px] text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
            <ShieldCheck size={14} className="text-[var(--color-success)]" />
            <span>Tus datos están protegidos conforme a la normativa RGPD/LOPD</span>
          </p>
        </div>

      </div>
    </div>
  );
}
