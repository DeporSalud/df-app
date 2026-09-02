"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  GraduationCap, 
  KeyRound, 
  Mail, 
  ArrowRight, 
  AlertTriangle, 
  ShieldAlert, 
  Timer, 
  ShieldCheck, 
  Delete, 
  Lock, 
  CheckCircle2, 
  RefreshCw,
  Search,
  ChevronLeft,
  Sparkles
} from "lucide-react";
import { useStudent, PROFESORES_LIST, Teacher } from "@/context/StudentContext";
import { 
  checkLockout, 
  registerFailedAttempt, 
  registerSuccessfulLogin, 
  checkTeacherLockout,
  syncTeacherLockoutWithSupabase,
  syncAllTeachersLockoutsWithSupabase,
  registerFailedTeacherAttempt,
  registerSuccessfulTeacherLogin,
  unlockTeacher,
  unlockRole,
  LockoutStatus 
} from "@/lib/securityService";
import OtpVerificationModal from "@/components/OtpVerificationModal";

// Safe haptic feedback helper
const triggerHaptic = (pattern: number | number[] = 15) => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
};

const KEYPAD_BUTTONS = [
  { digit: "1", sub: "" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "clear", sub: "C" },
  { digit: "0", sub: "+" },
  { digit: "backspace", sub: "⌫" },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginAsTeacher, requestStudentOtp, verifyStudentWithOtp } = useStudent();
  
  const [selectedRole, setSelectedRole] = useState<"alumno" | "profesor">("alumno");

  // Auto-clean any legacy generic lock on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("df_sec_lockout_profesor");
      window.dispatchEvent(new Event("df_security_lock_updated"));
    }
  }, []);

  // Student Form (100% Passwordless OTP)
  const [studentEmail, setStudentEmail] = useState("");
  const [otpModalEmail, setOtpModalEmail] = useState<string | null>(null);

  // Teacher Selection & Keypad State (Option 1)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherPin, setTeacherPin] = useState("");
  const [isPinError, setIsPinError] = useState(false);
  const [lockedTeacherIds, setLockedTeacherIds] = useState<Set<string>>(new Set());

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security Lockout State for the currently selected teacher or general
  const [teacherLockout, setTeacherLockout] = useState<LockoutStatus>({
    isLocked: false,
    isPermanentLock: false,
    remainingSeconds: 0,
    attemptsLeft: 3,
    failedCount: 0,
    maxAttempts: 3
  });

  // Global sync for all teachers from Supabase (to update list indicators in real time)
  const syncAllTeachers = useCallback(async () => {
    const ids = PROFESORES_LIST.map(p => p.id);
    const lockedSet = await syncAllTeachersLockoutsWithSupabase(ids);
    setLockedTeacherIds(lockedSet);
  }, []);

  useEffect(() => {
    if (selectedRole !== "profesor") return;
    syncAllTeachers();
    const interval = setInterval(syncAllTeachers, 1500);
    return () => clearInterval(interval);
  }, [selectedRole, syncAllTeachers]);

  // Refresh teacher lockout status for the active selected teacher
  const syncTeacherLockout = useCallback(async () => {
    if (selectedTeacher) {
      const status = await syncTeacherLockoutWithSupabase(selectedTeacher.id);
      setTeacherLockout(status);
      if (!status.isLocked) {
        setErrorMsg("");
        setIsPinError(false);
      }
    } else {
      setTeacherLockout({
        isLocked: false,
        isPermanentLock: false,
        remainingSeconds: 0,
        attemptsLeft: 3,
        failedCount: 0,
        maxAttempts: 3
      });
    }
  }, [selectedTeacher]);

  useEffect(() => {
    syncTeacherLockout();
    window.addEventListener("df_security_lock_updated", syncTeacherLockout);
    window.addEventListener("storage", syncTeacherLockout);
    return () => {
      window.removeEventListener("df_security_lock_updated", syncTeacherLockout);
      window.removeEventListener("storage", syncTeacherLockout);
    };
  }, [syncTeacherLockout]);

  // Periodic polling if teacher is locked (to detect Reception unlock in real time)
  useEffect(() => {
    if (!teacherLockout.isLocked || !selectedTeacher) return;

    const interval = setInterval(() => {
      syncTeacherLockout();
    }, 1500);

    return () => clearInterval(interval);
  }, [teacherLockout.isLocked, selectedTeacher, syncTeacherLockout]);

  // Handle Student Request OTP
  const handleStudentRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!studentEmail.trim()) {
      setErrorMsg("Por favor, introduce tu correo electrónico.");
      return;
    }

    setIsSubmitting(true);
    const res = await requestStudentOtp(studentEmail.trim().toLowerCase());

    if (res.success) {
      setOtpModalEmail(studentEmail.trim().toLowerCase());
    } else {
      setErrorMsg(res.error || "No se pudo solicitar el código OTP. Comprueba que el correo sea correcto.");
    }
    setIsSubmitting(false);
  };

  // Handle Teacher PIN Login for selected teacher
  const handleTeacherPinLogin = async (pinToVerify: string) => {
    if (!selectedTeacher || teacherLockout.isLocked || isSubmitting) return;

    setErrorMsg("");
    setIsPinError(false);
    setIsSubmitting(true);

    const isMatch = selectedTeacher.pin === pinToVerify.trim();

    if (isMatch) {
      triggerHaptic([20, 20]);
      registerSuccessfulTeacherLogin(selectedTeacher.id);
      await loginAsTeacher(selectedTeacher.pin);
      router.push("/");
    } else {
      triggerHaptic([40, 30, 40]);
      setIsPinError(true);
      const secStatus = await registerFailedTeacherAttempt(
        selectedTeacher.id, 
        selectedTeacher.name, 
        selectedTeacher.email, 
        selectedTeacher.sede
      );
      setTeacherLockout(secStatus);
      setIsSubmitting(false);

      if (secStatus.isLocked) {
        setErrorMsg(`Acceso de ${selectedTeacher.name} bloqueado tras 3 intentos fallidos.`);
      } else {
        setErrorMsg(`PIN incorrecto. Te quedan ${secStatus.attemptsLeft} intento(s) antes del bloqueo.`);
        setTimeout(() => {
          setTeacherPin("");
          setIsPinError(false);
        }, 800);
      }
    }
  };

  // Numpad Key Click Handler
  const handleKeypadClick = (digit: string) => {
    if (!selectedTeacher || teacherLockout.isLocked || isSubmitting) return;
    triggerHaptic(15);
    setErrorMsg("");
    setIsPinError(false);

    if (teacherPin.length >= 4) return;

    const nextPin = teacherPin + digit;
    setTeacherPin(nextPin);

    if (nextPin.length === 4) {
      handleTeacherPinLogin(nextPin);
    }
  };

  const handleKeypadDelete = () => {
    if (!selectedTeacher || teacherLockout.isLocked || isSubmitting) return;
    triggerHaptic(15);
    setErrorMsg("");
    setIsPinError(false);
    setTeacherPin(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (!selectedTeacher || teacherLockout.isLocked || isSubmitting) return;
    triggerHaptic(15);
    setErrorMsg("");
    setIsPinError(false);
    setTeacherPin("");
  };

  // Physical Keyboard Support for PIN on Desktop
  useEffect(() => {
    if (selectedRole !== "profesor" || !selectedTeacher || teacherLockout.isLocked || isSubmitting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeypadClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleKeypadDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleKeypadClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRole, selectedTeacher, teacherLockout.isLocked, isSubmitting, teacherPin]);

  const filteredTeachers = PROFESORES_LIST.filter(t => 
    t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
    t.email.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  if (otpModalEmail) {
    return (
      <OtpVerificationModal
        email={otpModalEmail}
        title="Acceso por One Time PIN"
        subtitle="Introduce el código de 6 dígitos enviado a tu correo electrónico:"
        onVerifyCode={async (code) => {
          return await verifyStudentWithOtp(otpModalEmail, code);
        }}
        onSuccess={() => {
          registerSuccessfulLogin("alumno", otpModalEmail);
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }}
        onCancel={() => {
          setOtpModalEmail(null);
          setIsSubmitting(false);
        }}
      />
    );
  }

  return (
    <div className="w-full flex-1 min-h-[100dvh] bg-[var(--color-bg)] flex flex-col justify-center p-4 sm:p-5 text-left relative overflow-x-hidden py-8 pb-32">
      {/* Glow Effects (Contained) */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--color-primary)]/15 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl pointer-events-none -ml-8 -mb-8"></div>

      <div className="w-full max-w-md mx-auto space-y-5 relative z-10 py-2">
        
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
              setIsPinError(false);
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
              setIsPinError(false);
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
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden">
          
          {/* ======================================================== */}
          {/* TAB ALUMNO (100% PASSWORDLESS OTP) */}
          {/* ======================================================== */}
          {selectedRole === "alumno" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[11.5px] text-slate-300 space-y-1.5">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <KeyRound size={15} className="text-[var(--color-secondary)]" />
                  <span>Acceso Seguro con Código OTP</span>
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Introduce tu correo y te enviaremos un código de acceso de 6 dígitos para entrar directamente a tu carnet digital sin contraseñas.
                </p>
              </div>

              <form onSubmit={handleStudentRequestOtp} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Correo Electrónico de Alumno
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      disabled={isSubmitting}
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="ej. alumno@gmail.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-2 group cursor-pointer active:scale-95 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Enviando código...</span>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>Solicitar Código de Acceso (OTP)</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
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
          {/* TAB PROFESOR (OPCIÓN 1: SELECTOR VISUAL + TECLADO PIN)  */}
          {/* ======================================================== */}
          {selectedRole === "profesor" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* PASO 1: SELECCIÓN DEL PROFESOR */}
              {!selectedTeacher ? (
                <div className="space-y-3">
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                      <GraduationCap size={16} className="text-[var(--color-secondary)]" />
                      <span>Claustro Docente Dance Factory</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Selecciona tu perfil de profesor para identificarte
                    </p>
                  </div>

                  {/* Search Filter */}
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      placeholder="Buscar profesor..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-secondary)] transition-colors placeholder:text-slate-500"
                    />
                  </div>

                  {/* Grid de Profesores */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {filteredTeachers.map((teacher) => {
                      const isTeacherLocked = lockedTeacherIds.has(teacher.id) || checkTeacherLockout(teacher.id).isLocked;

                      return (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => {
                            setSelectedTeacher(teacher);
                            setTeacherPin("");
                            setIsPinError(false);
                            setErrorMsg("");
                            const status = checkTeacherLockout(teacher.id);
                            setTeacherLockout(status);
                          }}
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group ${
                            isTeacherLocked
                              ? "bg-red-950/30 border-red-500/40 hover:border-red-400"
                              : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-secondary)]/60 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                              isTeacherLocked
                                ? "bg-red-500/20 text-red-400 border-red-500/40"
                                : "bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] border-[var(--color-secondary)]/30 group-hover:bg-[var(--color-secondary)] group-hover:text-slate-950 transition-colors"
                            }`}>
                              {teacher.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white group-hover:text-[var(--color-secondary)] transition-colors">
                                {teacher.name}
                              </h4>
                            </div>
                          </div>

                          {isTeacherLocked ? (
                            <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                              <Lock size={10} /> Bloqueado
                            </span>
                          ) : (
                            <ArrowRight size={14} className="text-slate-500 group-hover:text-[var(--color-secondary)] group-hover:translate-x-0.5 transition-all" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* PASO 2: TECLADO PIN IPHONE PARA EL PROFESOR SELECCIONADO */
                <div className="space-y-4 animate-in fade-in duration-200 text-center">
                  
                  {/* Selected Teacher Header Badge */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-secondary)] text-slate-950 flex items-center justify-center text-xs font-bold shrink-0">
                        {selectedTeacher.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Docente Seleccionado</span>
                        <h4 className="text-xs font-bold text-white">{selectedTeacher.name}</h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacher(null);
                        setTeacherPin("");
                        setErrorMsg("");
                        setIsPinError(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft size={12} />
                      <span>Cambiar</span>
                    </button>
                  </div>

                  {/* BLOQUEO POR SEGURIDAD SI ESTE PROFESOR HA FALLADO 3 VECES */}
                  {teacherLockout.isLocked ? (
                    <div className="p-5 sm:p-6 rounded-2xl bg-red-950/70 border-2 border-red-500/60 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border-2 border-red-500/40 flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
                        <ShieldAlert size={32} className="animate-pulse" />
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30">
                          Bloqueo de Seguridad Activo
                        </span>
                        <h3 className="text-lg font-extrabold text-white pt-1">
                          Acceso Bloqueado: {selectedTeacher.name}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                        Se han registrado <strong>3 intentos fallidos de PIN</strong> para {selectedTeacher.name}. Por protocolo de seguridad, este acceso requiere desbloqueo presencial en Recepción.
                      </p>

                      <div className="p-3.5 rounded-xl bg-black/50 border border-red-500/30 text-xs text-amber-300 flex items-center justify-center gap-2 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                        <span>Esperando desbloqueo desde Recepción...</span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-normal">
                        Solicita en Recepción (Studio 1 o Studio 2) que pulsen <strong>Desbloquear a {selectedTeacher.name}</strong> en el panel de control.
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeacher(null);
                          setTeacherPin("");
                        }}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <ChevronLeft size={14} />
                        <span>Seleccionar otro profesor</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Subtitle */}
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                          <KeyRound size={14} className="text-[var(--color-secondary)]" />
                          <span>Introduce tus 4 dígitos de PIN</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          PIN personal de {selectedTeacher.name}
                        </p>
                      </div>

                      {/* Error Alert */}
                      {errorMsg && (
                        <div className="p-2.5 rounded-xl bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-semibold animate-in fade-in">
                          <p>{errorMsg}</p>
                        </div>
                      )}

                      {/* 4-DOT PIN INDICATOR (IPHONE STYLE) */}
                      <div className={`flex items-center justify-center gap-4 py-1.5 ${isPinError ? "animate-shake" : ""}`}>
                        {[0, 1, 2, 3].map((idx) => {
                          const isFilled = teacherPin.length > idx;
                          return (
                            <div
                              key={idx}
                              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                                isPinError
                                  ? "bg-red-500 border-2 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.7)]"
                                  : isFilled
                                  ? "bg-[var(--color-secondary)] border-2 border-[var(--color-secondary)] shadow-[0_0_14px_rgba(251,191,36,0.8)] scale-110"
                                  : "bg-transparent border-2 border-slate-600"
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* IPHONE CIRCULAR NUMERIC KEYPAD */}
                      <div className="grid grid-cols-3 gap-3 max-w-[250px] mx-auto pt-1">
                        {KEYPAD_BUTTONS.map((item) => {
                          if (item.digit === "clear") {
                            return (
                              <button
                                key="clear"
                                type="button"
                                disabled={isSubmitting || teacherPin.length === 0}
                                onClick={handleKeypadClear}
                                className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed mx-auto cursor-pointer"
                              >
                                Borrar
                              </button>
                            );
                          }
                          if (item.digit === "backspace") {
                            return (
                              <button
                                key="backspace"
                                type="button"
                                disabled={isSubmitting || teacherPin.length === 0}
                                onClick={handleKeypadDelete}
                                className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed mx-auto cursor-pointer"
                              >
                                <Delete size={20} />
                              </button>
                            );
                          }
                          return (
                            <button
                              key={item.digit}
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleKeypadClick(item.digit)}
                              className="w-16 h-16 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:bg-[var(--color-secondary)]/30 active:scale-90 border border-white/10 text-white transition-all flex flex-col items-center justify-center mx-auto cursor-pointer shadow-md select-none group disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span className="text-xl font-bold font-mono group-hover:text-[var(--color-secondary)] transition-colors leading-none">
                                {item.digit}
                              </span>
                              {item.sub && (
                                <span className="text-[8px] tracking-widest text-slate-400 font-semibold mt-0.5">
                                  {item.sub}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Attempts Remaining Badge */}
                      <div className="pt-1.5">
                        <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                          {teacherLockout.attemptsLeft === 3 ? "3 intentos permitidos" : `⚠️ ${teacherLockout.attemptsLeft} intento(s) restante(s) antes del bloqueo`}
                        </span>
                      </div>
                    </>
                  )}

                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Security Note */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span>Blindaje contra fuerza bruta • Desbloqueo por Recepción</span>
        </div>

      </div>
    </div>
  );
}
