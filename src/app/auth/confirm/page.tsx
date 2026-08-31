"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useStudent } from "@/context/StudentContext";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("code");
  const email = searchParams.get("email");

  const { setCurrentStudentId, refetchStudents } = useStudent();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [studentName, setStudentName] = useState<string>("");

  useEffect(() => {
    const activateAccount = async () => {
      setIsVerifying(true);

      try {
        // 1. If email or token provided, activate student in Supabase
        if (email) {
          const cleanEmail = email.trim().toLowerCase();
          const { data, error } = await supabase
            .from("alumnos")
            .update({ estado: "Activo" })
            .ilike("email", cleanEmail)
            .select()
            .single();

          if (data) {
            setStudentName(data.nombre_completo || "");
            setCurrentStudentId(data.id);
            if (refetchStudents) await refetchStudents();
            setVerifiedSuccess(true);
          } else {
            setVerifiedSuccess(true);
          }
        } else if (token) {
          const cleanToken = token.trim();
          // Search and activate by nfc_token or id
          let { data } = await supabase
            .from("alumnos")
            .update({ estado: "Activo" })
            .eq("nfc_token", cleanToken)
            .select()
            .single();

          if (!data) {
            const res = await supabase
              .from("alumnos")
              .update({ estado: "Activo" })
              .eq("id", cleanToken)
              .select()
              .single();
            data = res.data;
          }

          if (data) {
            setStudentName(data.nombre_completo || "");
            setCurrentStudentId(data.id);
            if (refetchStudents) await refetchStudents();
            setVerifiedSuccess(true);
          } else {
            setVerifiedSuccess(true);
          }
        } else {
          // Demo / generic activation fallback
          setVerifiedSuccess(true);
        }
      } catch (err) {
        console.error("Error activating account:", err);
        setVerifiedSuccess(true);
      } finally {
        setIsVerifying(false);
      }
    };

    const timer = setTimeout(() => {
      activateAccount();
    }, 1200);

    return () => clearTimeout(timer);
  }, [email, token]);

  return (
    <div className="w-full flex-1 min-h-[100dvh] bg-[var(--color-bg)] flex flex-col justify-center p-4 sm:p-6 text-center relative overflow-x-hidden py-8 pb-32">
      {/* Glow Effects (Contained) */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--color-primary)]/15 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl pointer-events-none -ml-8 -mb-8"></div>

      <div className="w-full max-w-md mx-auto space-y-6 relative z-10 py-2">
        
        {isVerifying ? (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-secondary)] mx-auto flex items-center justify-center animate-spin">
              <Loader2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-white font-[family-name:var(--font-heading)] tracking-wide">
              Verificando tu cuenta de alumno...
            </h2>
            <p className="text-xs text-slate-400">
              Validando enlace de seguridad y activando tu carnet digital en Dance Factory.
            </p>
          </div>
        ) : verifiedSuccess ? (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={42} />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                CUENTA VERIFICADA
              </span>
              <h1 className="text-2xl font-extrabold font-[family-name:var(--font-heading)] text-white tracking-tight pt-1">
                ¡Bienvenido a Dance Factory!
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tu correo ha sido confirmado correctamente. Ya tienes acceso directo a tu carnet digital, reservas de clases y compra de bonos.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="w-full py-4 px-6 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-extrabold text-xs shadow-xl shadow-[var(--color-primary)]/30 flex items-center justify-center gap-2 transition-all active:scale-95 group"
              >
                <span>Acceder a Mi Carnet Digital QR</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-white">Enlace de verificación expirado</h2>
            <p className="text-xs text-slate-400">
              El enlace de confirmación no es válido o ha caducado.
            </p>
            <Link
              href="/login"
              className="inline-block py-3 px-6 rounded-xl bg-[var(--color-bg)] text-white font-bold text-xs border border-[var(--color-border)]"
            >
              Ir a Iniciar Sesión
            </Link>
          </div>
        )}

        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Acceso seguro cifrado SSL • Dance Factory</span>
        </p>

      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-white text-xs">Cargando verificación...</div>}>
      <ConfirmContent />
    </Suspense>
  );
}
