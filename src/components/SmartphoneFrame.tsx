import { ReactNode } from "react";

export default function SmartphoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#070b16] flex justify-center font-sans antialiased selection:bg-[var(--color-primary)] selection:text-white overflow-x-hidden">
      {/* Real Native Web App Container - Spans full width on mobile, sleek centered app on desktop */}
      <div className="w-full max-w-md min-h-[100dvh] bg-[var(--color-bg)] shadow-2xl relative flex flex-col overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
