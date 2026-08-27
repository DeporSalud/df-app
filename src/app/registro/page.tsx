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

export default function RegistroPage() {
  const router = useRouter();
  const { registerStudent } = useStudent();

  const [formData, setFormData] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
    dni: "",
    fecha_nacimiento: "",
    password: ""
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
      setErrorMsg("Por favor, completa los campos obligatorios (Nombre, Email y Teléfono).");
      return;
    }

    const cleanPhone = formData.telefono.replace(/[\s\-\.]/g, "");
    const phoneRegex = /^(\+34|0034)?[6789]\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMsg("El número de teléfono debe ser un teléfono móvil español válido (ej. 600123456 o +34 600123456).");
      return;
    }

    if (formData.dni.trim()) {
      const cleanDni = formData.dni.trim().toUpperCase();
      const dniNieRegex = /^(\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/;
      if (!dniNieRegex.test(cleanDni)) {
        setErrorMsg("El DNI o NIE introducido no tiene un formato válido (ej. 12345678X o Y1234567Z).");
        return;
      }
    }

    setIsSubmitting(true);

    const res = await registerStudent({
      nombre_completo: formData.nombre_completo.trim(),
      email: formData.email.trim().toLowerCase(),
      telefono: cleanPhone,
      dni: formData.dni.trim() ? formData.dni.trim().toUpperCase() : undefined,
      fecha_nacimiento: formData.fecha_nacimiento,
      password: formData.password,
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

  // IF REGISTRATION COMPLETED -> SHOW EMAIL VERIFICATION SCREEN
  if (registeredEmail) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-bg)] justify-center p-6 text-center relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--color-primary)]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[var(--color-secondary)]/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-md w-full mx-auto space-y-6 relative z-10 py-6">
          
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            {/* Animated Icon */}
            <div className="w-20 h-20 rounded-3xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-secondary)] mx-auto flex items-center justify-center shadow-xl shadow-[var(--color-primary)]/25 relative">
              <MailCheck size={40} className="text-[var(--color-secondary)]" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[var(--color-bg-card)] flex items-center justify-center text-[10px] font-bold text-white">
                ✓
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-full border border-[var(--color-secondary)]/20">
                PASO FINAL • VERIFICACIÓN REQUERIDA
              </span>
              <h1 className="text-2xl font-extrabold font-[family-name:var(--font-heading)] text-white tracking-tight pt-1">
                Revisa tu Correo Electrónico
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Hemos enviado un enlace de confirmación seguro a:
              </p>
              <div className="py-2 px-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-mono font-bold text-[var(--color-secondary)] inline-block max-w-full truncate shadow-inner">
                {registeredEmail}
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="space-y-2.5 text-left bg-[var(--color-bg)] p-4 rounded-2xl border border-[var(--color-border)] text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-secondary)] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Abre el correo enviado por <strong>Dance Factory</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-secondary)] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Haz clic en <strong>"Confirmar mi cuenta y acceder"</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-secondary)] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Tu carnet digital y acceso a clases se activarán automáticamente.</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <Link
                href={`/auth/confirm?email=${encodeURIComponent(registeredEmail)}`}
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-extrabold text-xs shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-2 transition-all active:scale-95 group"
              >
                <span>Acceder Ahora (Confirmar Cuenta)</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors block text-center"
              >
                Volver a Iniciar Sesión
              </Link>
            </div>

          </div>

          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Verificación segura de cuenta • Dance Factory</span>
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)] justify-start p-5 text-left relative overflow-y-auto scrollbar-none">
      {/* Glow Effects */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--color-primary)]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[var(--color-secondary)]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full mx-auto space-y-5 relative z-10 py-3 pb-10">
        
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

            {/* 6. Contraseña */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-title)] uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Crea tu clave de acceso"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500"
                />
              </div>
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
