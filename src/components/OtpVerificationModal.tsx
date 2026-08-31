"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  KeyRound, 
  Lock, 
  Sparkles,
  ChevronLeft
} from "lucide-react";
import { 
  verifyOtpCode, 
  generateAndSendOtp, 
  getOtpCooldown, 
  getActiveOtpCode 
} from "@/lib/otpService";

interface OtpVerificationModalProps {
  email: string;
  onSuccess: () => void;
  onCancel?: () => void;
  onVerifyCode?: (code: string) => Promise<{ success: boolean; error?: string }>;
  title?: string;
  subtitle?: string;
}

export default function OtpVerificationModal({
  email,
  onSuccess,
  onCancel,
  onVerifyCode,
  title = "Verificación por Correo",
  subtitle = "Hemos enviado un código One Time PIN (OTP) de 6 dígitos a tu correo:"
}: OtpVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [hintCode, setHintCode] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize and check cooldown
  useEffect(() => {
    const { remainingSeconds } = getOtpCooldown(email);
    setCooldown(remainingSeconds > 0 ? remainingSeconds : 60);

    // Initial check for active code (for user demo convenience)
    const active = getActiveOtpCode(email);
    if (active) setHintCode(active);

    // Auto-focus first input
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 200);
  }, [email]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    setErrorMsg("");
    const clean = value.replace(/[^0-9]/g, "");

    // Handle paste of 6 digits in any box
    if (clean.length === 6) {
      const newDigits = clean.split("");
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      triggerVerification(newDigits.join(""));
      return;
    }

    const digit = clean.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // If a digit was entered, advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all 6 digits filled, auto-verify
    const fullCode = newDigits.join("");
    if (fullCode.length === 6 && !newDigits.includes("")) {
      triggerVerification(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    if (pasted.length >= 6) {
      const newDigits = pasted.slice(0, 6).split("");
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      triggerVerification(newDigits.join(""));
    }
  };

  const triggerVerification = async (codeToVerify: string) => {
    setIsVerifying(true);
    setErrorMsg("");

    await new Promise(r => setTimeout(r, 400)); // Smooth UI feel

    let result: { success: boolean; error?: string } = await verifyOtpCode(email, codeToVerify);

    if (onVerifyCode) {
      const customRes = await onVerifyCode(codeToVerify);
      if (!customRes.success) {
        result = { success: false, error: customRes.error || "Error al verificar el código." };
      } else {
        result = { success: true };
      }
    }

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 700);
    } else {
      setErrorMsg(result.error || "Código incorrecto. Revisa e inténtalo de nuevo.");
      setIsVerifying(false);
      // Clear inputs for re-try
      setTimeout(() => {
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }, 600);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg("");

    const res = await generateAndSendOtp(email);
    if (res.success) {
      setCooldown(60);
      if (res.code) setHintCode(res.code);
    } else {
      setErrorMsg(res.error || "No se pudo reenviar el código. Inténtalo de nuevo.");
    }
    setIsResending(false);
  };

  return (
    <div className="w-full flex-1 min-h-[100dvh] bg-[var(--color-bg)] flex flex-col justify-center p-4 sm:p-6 text-center relative overflow-x-hidden py-8 pb-32 font-sans">
      {/* Background Glows (Contained) */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--color-primary)]/15 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl pointer-events-none -ml-8 -mb-8"></div>

      <div className="w-full max-w-md mx-auto space-y-6 relative z-10 py-2">
        
        {/* Top Back Action if available */}
        {onCancel && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Volver</span>
            </button>
          </div>
        )}

        {/* Card Container */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
          
          {/* Header Icon */}
          <div className="w-18 h-18 rounded-3xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-secondary)] mx-auto flex items-center justify-center shadow-xl shadow-[var(--color-primary)]/25 relative">
            <KeyRound size={36} className="text-[var(--color-secondary)]" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[var(--color-bg-card)] flex items-center justify-center text-[10px] font-bold text-white">
              OTP
            </span>
          </div>

          {/* Title & Email */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-full border border-[var(--color-secondary)]/20">
              SEGURIDAD • ONE TIME PIN
            </span>
            <h1 className="text-2xl font-extrabold font-[family-name:var(--font-heading)] text-white tracking-tight pt-1">
              {title}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              {subtitle}
            </p>
            <div className="py-1.5 px-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-mono font-bold text-[var(--color-secondary)] inline-block max-w-full truncate shadow-inner">
              {email}
            </div>
          </div>

          {/* Success Banner */}
          {isSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-center gap-2.5 animate-in zoom-in-90">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="font-bold">¡Código Verificado! Accediendo a tu Carnet...</span>
            </div>
          ) : (
            <>
              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center justify-center gap-2 animate-shake">
                  <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 6 Digit Inputs */}
              <div className="flex justify-center gap-2 sm:gap-2.5 my-4" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    disabled={isVerifying || isSuccess}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    className={`w-11 h-13 sm:w-12 sm:h-14 rounded-2xl bg-[var(--color-bg)] border-2 text-center text-xl sm:text-2xl font-black font-mono text-white transition-all shadow-inner focus:outline-none disabled:opacity-50 ${
                      digit
                        ? "border-[var(--color-secondary)] bg-[var(--color-primary)]/10 shadow-lg shadow-[var(--color-primary)]/20"
                        : "border-[var(--color-border)] focus:border-[var(--color-primary)]"
                    }`}
                  />
                ))}
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isVerifying || digits.join("").length !== 6}
                onClick={() => triggerVerification(digits.join(""))}
                className="w-full py-3.5 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-extrabold text-xs shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{isVerifying ? "Comprobando Código..." : "Verificar y Activar Cuenta"}</span>
                <ArrowRight size={16} />
              </button>

              {/* Resend OTP Section */}
              <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-slate-400">
                <span>¿No has recibido el código?</span>
                {cooldown > 0 ? (
                  <span className="font-mono text-slate-400 font-medium">
                    Reenviar en 00:{cooldown.toString().padStart(2, "0")} s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-[var(--color-secondary)] hover:text-white font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={13} className={isResending ? "animate-spin" : ""} />
                    <span>Reenviar Código</span>
                  </button>
                )}
              </div>
            </>
          )}

        </div>

        {/* Security Footer Note */}
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Verificación OTP protegida • Dance Factory Alcorcón</span>
        </p>

      </div>
    </div>
  );
}
