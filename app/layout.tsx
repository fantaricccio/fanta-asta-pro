import type { Metadata } from "next";
import "./globals.css";
import SessionTimeoutGuard from "../components/SessionTimeoutGuard";
import MaintenanceGate from "../components/MaintenanceGate";
import PasswordChangeGuard from "../components/PasswordChangeGuard";
import AstaHelpCopilot from "../components/AstaHelpCopilot";
import CookieBanner from "../components/CookieBanner";

export const metadata: Metadata = {
  title: "FantaAsta Pro - Gestione Asta & Leghe Fantacalcio",
  description: "Piattaforma professionale per aste live, online e gestione rose Fantacalcio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <SessionTimeoutGuard>
          <MaintenanceGate>
            <PasswordChangeGuard>{children}</PasswordChangeGuard>
          </MaintenanceGate>
        </SessionTimeoutGuard>
        <AstaHelpCopilot />
        <CookieBanner />
      </body>
    </html>
  );
}