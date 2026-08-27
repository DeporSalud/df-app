"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QrCode, Calendar, BookmarkCheck, Gift, User, Flame, Tag, GraduationCap } from "lucide-react";
import { useStudent } from "@/context/StudentContext";

export default function StudentBottomNav() {
  const pathname = usePathname();
  const { userRole } = useStudent();

  if (userRole === "profesor") {
    const teacherNavItems = [
      {
        name: "Mis Clases",
        href: "/",
        icon: Calendar,
        active: pathname === "/" || pathname.includes("tab=mis_clases")
      },
      {
        name: "Open Class",
        href: "/clases?tab=openclass",
        icon: Flame,
        active: pathname.startsWith("/clases")
      },
      {
        name: "Bonos (-10%)",
        href: "/clases?tab=bonos",
        icon: Tag,
        active: pathname.includes("tab=bonos")
      },
      {
        name: "Perfil",
        href: "/perfil",
        icon: GraduationCap,
        active: pathname.startsWith("/perfil")
      }
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-[#141d33]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-around items-center">
        {teacherNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={"flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all relative select-none cursor-pointer " + (
                isActive ? "text-[var(--color-secondary)] font-bold scale-105" : "text-slate-400 hover:text-white font-medium"
              )}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? "text-[var(--color-secondary)] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-400"} />
              </div>
              <span className={"text-[10px] mt-1 tracking-tight text-center truncate w-full " + (isActive ? "text-[var(--color-secondary)] font-bold" : "text-slate-400")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  const navItems = [
    {
      name: "Acceso QR",
      href: "/",
      icon: QrCode,
      active: pathname === "/"
    },
    {
      name: "Clases",
      href: "/clases",
      icon: Calendar,
      active: pathname.startsWith("/clases")
    },
    {
      name: "Mis Clases",
      href: "/mis-clases",
      icon: BookmarkCheck,
      active: pathname.startsWith("/mis-clases")
    },
    {
      name: "Ventajas",
      href: "/ventajas",
      icon: Gift,
      active: pathname.startsWith("/ventajas")
    },
    {
      name: "Perfil",
      href: "/perfil",
      icon: User,
      active: pathname.startsWith("/perfil")
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-[#141d33]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.active;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={"flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all relative select-none cursor-pointer " + (
              isActive
                ? "text-[var(--color-secondary)] font-bold scale-105"
                : "text-slate-400 hover:text-white font-medium"
            )}
          >
            <div className="relative">
              <Icon size={20} className={isActive ? "text-[var(--color-secondary)] drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-400"} />
            </div>
            <span className={"text-[10px] mt-1 tracking-tight text-center truncate w-full " + (isActive ? "text-[var(--color-secondary)] font-bold" : "text-slate-400")}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
