import { ReactNode } from "react";

export default function SmartphoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#070b16] flex justify-center font-sans antialiased selection:bg-[var(--color-primary)] selection:text-white">
      {/* Real Native Web App Container - Spans full width on mobile, sleek centered app on desktop */}
      <div className="w-full max-w-md min-h-screen bg-[var(--color-bg)] shadow-2xl relative flex flex-col pb-20">
        {children}
      </div>
    </div>
  );
}
