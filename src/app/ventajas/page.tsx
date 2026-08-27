"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Gift, 
  Sparkles, 
  ShoppingBag, 
  HeartHandshake, 
  Tag, 
  Timer, 
  ShieldCheck, 
  Bell, 
  CheckCircle2, 
  Flame,
  Award
} from "lucide-react";
import { useStudent } from "@/context/StudentContext";
import StudentBottomNav from "@/components/StudentBottomNav";

export default function VentajasPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useStudent();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[var(--color-bg)] items-center justify-center text-white text-sm font-semibold">
        Cargando ventajas del club...
      </div>
    );
  }

  const upcomingPerks = [
    {
      icon: ShoppingBag,
      title: "Merchandising Oficial",
      desc: "Prendas de ensayo, sudaderas y equipamiento oficial Dance Factory con precio especial para alumnos y profesores.",
      tag: "Exclusivo Alumnos"
    },
    {
      icon: HeartHandshake,
      title: "Salud, Fisioterapia & Bienestar",
      desc: "Convenios directos con clínicas de fisioterapia deportiva, osteopatía y readaptación física para bailarines.",
      tag: "Convenios"
    },
    {
      icon: Tag,
      title: "Descuentos en Calzado & Ropa",
      desc: "Cupones de descuento exclusivos en las mejores tiendas especializadas en danza urbana, contemporáneo y ballet.",
      tag: "Cupones"
    },
    {
      icon: Award,
      title: "Workshops & Masterclasses",
      desc: "Acceso prioritario y tarifas reducidas en eventos, intensivos de fin de semana y competiciones.",
      tag: "Eventos"
    }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[var(--color-bg)] overflow-hidden text-left">
      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none pb-24">
        
        {/* Header */}
        <header className="p-6 pt-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-secondary)]/20">
              CLUB DANCE FACTORY
            </span>
            <h1 className="text-2xl font-[family-name:var(--font-heading)] text-white tracking-wide mt-1">
              Ventajas y Descuentos
            </h1>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Gift size={20} />
          </div>
        </header>

        {/* Main Body */}
        <main className="p-6 space-y-6">
          
          {/* HERO COMING SOON CARD */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#141d33] via-[var(--color-bg-card)] to-[#0c1428] border-2 border-amber-500/40 p-6 sm:p-7 shadow-2xl space-y-4">
            {/* Glow effect */}
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
                <Sparkles size={13} />
                <span>Próximamente</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Temporada 2026-2027</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-extrabold font-[family-name:var(--font-heading)] text-white tracking-tight leading-snug">
                Estamos preparando el nuevo Club de Ventajas
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Muy pronto podrás disfrutar de acuerdos comerciales exclusivos, cupones de descuento y promociones especiales diseñadas para la comunidad de Dance Factory.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-amber-300/90 font-medium">
              <Timer size={16} className="text-amber-400 shrink-0" />
              <span>Disponible en las próximas semanas directamente en esta sección.</span>
            </div>
          </div>

          {/* SNEAK PEEK OF UPCOMING BENEFITS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Qué incluirá el Club Dance Factory
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">En desarrollo</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {upcomingPerks.map((perk, index) => {
                const Icon = perk.icon;
                return (
                  <div
                    key={index}
                    className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-slate-600 transition-all flex items-start gap-3.5 shadow-md"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)]/20 to-[var(--color-primary)]/20 text-[var(--color-secondary)] flex items-center justify-center shrink-0 border border-white/5">
                      <Icon size={20} />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white tracking-wide truncate">
                          {perk.title}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 shrink-0">
                          {perk.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {perk.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* NOTIFICATION CALLOUT */}
          <div className="p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center gap-3.5 text-xs text-slate-300 shadow-md">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Bell size={18} />
            </div>
            <div className="space-y-0.5">
              <strong className="block text-white font-semibold">Aviso de lanzamiento</strong>
              <p className="text-[11px] text-slate-400">
                Te notificaremos en la app y por correo en cuanto los primeros convenios estén listos para canjear.
              </p>
            </div>
          </div>

        </main>
      </div>

      {/* Fixed Bottom Navigation */}
      <StudentBottomNav />
    </div>
  );
}
