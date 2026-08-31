"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, User, GraduationCap, KeyRound, AlertTriangle, ShieldAlert, Timer } from "lucide-react";
import { useStudent } from "@/context/StudentContext";
import { checkLockout, registerFailedAttempt, registerSuccessfulLogin, LockoutStatus } from "@/lib/securityService";
import OtpVerificationModal from "@/components/OtpVerificationModal";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials, loginAsTeacher, requestStudentOtp } = useStudent();
  
  const [selectedRole, setSelectedRole] = useState<"alumno" | "profesor">("alumno");

  // Student Form
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentAuthMode, setStudentAuthMode] = useState<"password" | "otp">("password");
  const [otpModalEmail, setOtpModalEmail] = useState<string | null>(null);

  // Teacher Form
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherAuthMode, setTeacherAuthMode] = useState<"pin" | "email">("pin");

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security Lockout State
  const [lockout, setLockout] = useState<LockoutStatus>({
    isLocked: false,
    remainingSeconds: 0,
    attemptsLeft: 3,
    failedCount: 0,
    maxAttempts: 3
  });

  // Refresh lockout status on mount & role change
  useEffect(() => {
    const status = checkLockout(selectedRole);
    setLockout(status);
  }, [selectedRole]);

  // Live countdown timer for lockout
  useEffect(() => {
    if (!lockout.isLocked) return;

    const interval = setInterval(() => {
      const updated = checkLockout(selectedRole);
      setLockout(updated);
      if (!updated.isLocked) {
        setErrorMsg("");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockout.isLocked, selectedRole]);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockout.isLocked) return;

    setErrorMsg("");
    setIsSubmitting(true);

    const email = studentEmail.trim().toLowerCase();

    if (studentAuthMode === "otp") {
      if (!email) {
        setErrorMsg("Por favor, introduce tu correo electrónico.");
        setIsSubmitting(false);
        return;
      }
      const res = await requestStudentOtp(email);
      if (res.success) {
        setOtpModalEmail(email);
      } else {
        setErrorMsg(res.error || "No se pudo enviar el código OTP. Inténtalo de nuevo.");
      }
      setIsSubmitting(false);
      return;
    }

    const pass = studentPassword.trim();
    const success = await loginWithCredentials(email, pass);

    if (success) {
      registerSuccessfulLogin("alumno", email);
      router.push("/");
    } else {
      const secStatus = registerFailedAttempt("alumno", email);
      setLockout(secStatus);
      setIsSubmitting(false);

      if (secStatus.isLocked) {
        setErrorMsg(`Has superado el límite de ${secStatus.maxAttempts} intentos fallidos. Por seguridad de Dance Factory, tu acceso ha sido bloqueado temporalmente.`);
      } else {
        setErrorMsg(`Credenciales de alumno incorrectas. Te quedan ${secStatus.attemptsLeft} intento(s) antes del bloqueo de seguridad.`);
      }
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockout.isLocked) return;

    setErrorMsg("");
    setIsSubmitting(true);

    const credential = teacherAuthMode === "pin" ? teacherPin.trim() : teacherEmail.trim();
    const success = await loginAsTeacher(credential);

    if (success) {
      registerSuccessfulLogin("profesor", credential);
      router.push("/");
    } else {
      const secStatus = registerFailedAttempt("profesor", credential);
      setLockout(secStatus);
      setIsSubmitting(false);

      if (secStatus.isLocked) {
        setErrorMsg(`Has superado el límite de ${secStatus.maxAttempts} intentos fallidos. Por seguridad del claustro docente, el acceso ha sido bloqueado temporalmente.`);
      } else {
        setErrorMsg(`PIN o credencial de profesor incorrecta. Te quedan ${secStatus.attemptsLeft} intento(s) antes del bloqueo de seguridad.`);
      }
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (otpModalEmail) {
    return (
      <OtpVerificationModal
        email={otpModalEmail}
        title="Acceso por One Time PIN"
        subtitle="Introduce el código de 6 dígitos enviado a tu correo electrónico:"
        onSuccess={() => {
          registerSuccessfulLogin("alumno", otpModalEmail);
          router.push("/");
        }}
        onCancel={() => {
          setOtpModalEmail(null);
          setIsSubmitting(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)] justify-center p-5 text-left relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--color-primary)]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[var(--color-secondary)]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full mx-auto space-y-6 relative z-10 py-4">
        
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto shadow-2xl shadow-[var(--color-primary)]/30 border-2 border-[var(--color-border)] mb-2 bg-[#0b132b] flex items-center justify-center p-1">
            <img 
              src="/logo.jpg" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://instagram.fvlc9-1.fna.fbcdn.net/v/t51.2885-19/322053422_459392079728607_1490916454349393229_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fvlc9-1.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gF-XbYvayL7-HV_SvcmisuKHZtOqEBU7IHA_LkS806EC8XXoEsMuNAuTaLe1td7wGU&_nc_ohc=ZCgrtTzAFkkQ7kNvwGXOOxL&_nc_gid=69Z2TlxJR5z02A7LgMOtuQ&edm=APoiHPcBAAAA&ccb=7-5&oh=00_AQFAWQ58x7RbOS7LOThuzG157X-k_fIZyOKE-GQGqxyfHA&oe=6A836EC6&_nc_sid=22de04";
              }}
              alt="Dance Factory Logo" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-full border border-[var(--color-secondary)]/20">
            DANCE FACTORY • APP OFICIAL
          </span>
          <h1 className="text-2xl font-extrabold font-[family-name:var(--font-heading)] text-white tracking-tight pt-1">
            Acceso a la App
          </h1>
        </div>

        {/* ROLE SELECTOR TABS */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-1.5 rounded-2xl flex gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setSelectedRole("alumno");
              setErrorMsg("");
            }}
            className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer " + (
              selectedRole === "alumno"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/25 scale-[1.02]"
                : "text-slate-400 hover:text-white"
            )}
          >
            <User size={16} />
            <span>Soy Alumno</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole("profesor");
              setErrorMsg("");
            }}
            className={"flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer " + (
              selectedRole === "profesor"
                ? "bg-[var(--color-secondary)] text-slate-950 shadow-md shadow-[var(--color-secondary)]/25 scale-[1.02]"
                : "text-slate-400 hover:text-white"
            )}
          >
            <GraduationCap size={16} />
            <span>Soy Profesor</span>
          </button>
        </div>

        {/* LOGIN CARD */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
          
          {/* LOCKOUT OVERLAY / BANNER */}
          {lockout.isLocked ? (
            <div className="p-4 rounded-2xl bg-red-950/60 border-2 border-red-500/50 text-red-200 text-xs space-y-3 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2.5 text-red-400 font-bold uppercase tracking-wider text-[11px]">
                <ShieldAlert size={18} className="shrink-0 animate-bounce text-red-400" />
                <span>Bloqueo por Seguridad Activo</span>
              </div>
              
              <p className="text-xs leading-relaxed text-slate-300">
                Se han registrado <strong className="text-white">3 intentos fallidos consecutivos</strong> de acceso como {selectedRole}. Para prevenir accesos no autorizados, el formulario ha sido bloqueado temporalmente.
              </p>

              <div className="bg-black/50 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                  <Timer size={14} className="text-red-400" />
                  Tiempo restante de espera:
                </span>
                <span className="text-lg font-mono font-black text-red-400 tracking-widest animate-pulse">
                  {formatCountdown(lockout.remainingSeconds)}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                Si has olvidado tu contraseña o PIN, contacta con Recepción.
              </p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p>{errorMsg}</p>
                    {lockout.failedCount > 0 && (
                      <span className="inline-block text-[10px] font-mono bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">
                        Intentos restantes: {lockout.attemptsLeft} / {lockout.maxAttempts}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* TAB ALUMNO FORM */}
          {/* ======================================================== */}
          {selectedRole === "alumno" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Toggle Password vs OTP */}
              <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px]">
                <button
                  type="button"
                  disabled={lockout.isLocked}
                  onClick={() => {
                    setStudentAuthMode("password");
                    setErrorMsg("");
                  }}
                  className={"flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer " + (
                    studentAuthMode === "password" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Entrar con Contraseña
                </button>
                <button
                  type="button"
                  disabled={lockout.isLocked}
                  onClick={() => {
                    setStudentAuthMode("otp");
                    setErrorMsg("");
                  }}
                  className={"flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer " + (
                    studentAuthMode === "otp" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  One Time PIN (OTP)
                </button>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Correo Electrónico de Alumno
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      disabled={lockout.isLocked || isSubmitting}
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="ej. alumno@gmail.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {studentAuthMode === "password" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Contraseña
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        disabled={lockout.isLocked || isSubmitting}
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[11px] text-slate-300 space-y-1">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <KeyRound size={14} className="text-[var(--color-secondary)]" />
                      <span>Acceso seguro por código de un solo uso</span>
                    </p>
                    <p className="text-[10.5px] text-slate-400 leading-normal">
                      Te enviaremos un código One Time PIN (OTP) de 6 dígitos a tu correo para acceder instantáneamente a tu carnet.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={lockout.isLocked || isSubmitting}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-2 group cursor-pointer active:scale-95 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {isSubmitting
                      ? "Procesando..."
                      : studentAuthMode === "otp"
                      ? "Solicitar Código OTP (6 dígitos)"
                      : "Entrar a Mi Carnet de Alumno"}
                  </span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              {/* Link to Register */}
              <div className="text-center pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-slate-400">
                  ¿Eres nuevo alumno?{" "}
                  <Link href="/registro" className="text-[var(--color-primary)] hover:underline font-bold">
                    Regístrate aquí
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB PROFESOR FORM */}
          {/* ======================================================== */}
          {selectedRole === "profesor" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px]">
                <button
                  type="button"
                  disabled={lockout.isLocked}
                  onClick={() => setTeacherAuthMode("pin")}
                  className={"flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer " + (
                    teacherAuthMode === "pin" ? "bg-[var(--color-secondary)] text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Entrar con PIN (4 dígitos)
                </button>
                <button
                  type="button"
                  disabled={lockout.isLocked}
                  onClick={() => setTeacherAuthMode("email")}
                  className={"flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer " + (
                    teacherAuthMode === "email" ? "bg-[var(--color-secondary)] text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Entrar con Email
                </button>
              </div>

              <form onSubmit={handleTeacherSubmit} className="space-y-3.5">
                {teacherAuthMode === "pin" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Código PIN Docente (4 dígitos)
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound className="absolute left-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        maxLength={4}
                        required
                        disabled={lockout.isLocked || isSubmitting}
                        value={teacherPin}
                        onChange={(e) => setTeacherPin(e.target.value)}
                        placeholder="Introduce tu PIN de 4 dígitos"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs font-mono tracking-widest focus:outline-none focus:border-[var(--color-secondary)] transition-colors placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Correo Corporativo de Profesor
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        disabled={lockout.isLocked || isSubmitting}
                        value={teacherEmail}
                        onChange={(e) => setTeacherEmail(e.target.value)}
                        placeholder="tu.nombre@dancefactory.es"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-secondary)] transition-colors placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={lockout.isLocked || isSubmitting}
                  className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 text-slate-950 font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-[var(--color-secondary)]/25 flex items-center justify-center gap-2 group cursor-pointer active:scale-95 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? "Verificando..." : "Entrar a Mis Clases de Profesor"}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Footer Security Note */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span>Sistema protegido contra fuerza bruta • Dance Factory Seguridad</span>
        </div>

      </div>
    </div>
  );
}
