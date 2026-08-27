import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmartphoneFrame from "@/components/SmartphoneFrame";
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
};

export const metadata: Metadata = {
  title: "Dance Factory - Portal del Alumno",
  description: "Reserva tus clases, consulta tu bono y accede a la escuela.",
  manifest: "/manifest.json",
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
        <StudentProvider>
          <SmartphoneFrame>
            {children}
          </SmartphoneFrame>
        </StudentProvider>
      </body>
    </html>
  );
}
