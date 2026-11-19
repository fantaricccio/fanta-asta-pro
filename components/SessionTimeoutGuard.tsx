"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 ore in millisecondi
const STORAGE_KEY = "fantaasta_last_activity";

export default function SessionTimeoutGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      isLoggedRef.current = Boolean(user);
      if (user) {
        const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
        if (last > 0 && Date.now() - last > INACTIVITY_LIMIT_MS) {
          eseguiLogoutScaduto();
        } else {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
        }
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => unsub();
  }, []);

  const eseguiLogoutScaduto = async () => {
    localStorage.removeItem(STORAGE_KEY);
    await signOut(auth);
    alert("⏳ Sessione scaduta dopo 2 ore di inattività. Effettua nuovamente il login.");
    if (pathname?.startsWith("/backoffice")) {
      router.push("/backoffice");
    } else {
      router.push("/");
    }
  };

  useEffect(() => {
    const aggiornaAttivita = () => {
      if (isLoggedRef.current) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    };

    const eventi = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    eventi.forEach((ev) => window.addEventListener(ev, aggiornaAttivita, { passive: true }));

    // Controlla ogni 30 secondi se sono passate 2 ore dall'ultima azione
    const interval = setInterval(() => {
      if (!isLoggedRef.current) return;
      const last = Number(localStorage.getItem(STORAGE_KEY) || Date.now());
      if (Date.now() - last >= INACTIVITY_LIMIT_MS) {
        eseguiLogoutScaduto();
      }
    }, 30000);

    return () => {
      eventi.forEach((ev) => window.removeEventListener(ev, aggiornaAttivita));
      clearInterval(interval);
    };
  }, [pathname]);

  return <>{children}</>;
}