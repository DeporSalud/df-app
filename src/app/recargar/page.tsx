"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RecargarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/clases?tab=bonos");
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-[var(--color-bg)] text-white p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[var(--color-secondary)]/15 border border-[var(--color-secondary)]/30 text-[var(--color-secondary)] mx-auto flex items-center justify-center animate-spin mb-4">
        <Loader2 size={24} />
      </div>
      <p className="text-xs font-semibold text-slate-300">
        Redirigiendo a la pasarela oficial de compra de bonos...
      </p>
    </div>
  );
}
