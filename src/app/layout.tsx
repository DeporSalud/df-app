import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmartphoneFrame from "@/components/SmartphoneFrame";
import PwaRegister from "@/components/PwaRegister";
import { StudentProvider } from "@/context/StudentContext";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-heading",
  subsets: ["latin"],
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "600"],
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b132b",
};

export const metadata: Metadata = {
  title: "Dance Factory - App Oficial",
  description: "App oficial de Dance Factory Alcorcón para Alumnos y Profesores. Carnet digital, reservas y bonos.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dance Factory"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bebasNeue.variable} ${poppins.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#070b16] text-[var(--color-text-body)]">
        <PwaRegister />
        <StudentProvider>
          <SmartphoneFrame>
            {children}
          </SmartphoneFrame>
        </StudentProvider>
      </body>
    </html>
  );
}
