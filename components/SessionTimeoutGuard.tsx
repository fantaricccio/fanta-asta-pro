"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 ore
const STORAGE_KEY = "fantaasta_last_activity";

export default function SessionTimeoutGuard({ children }: { children: React.ReactNode }) {
  const isLoggedRef = useRef(false);

  const eseguiLogoutScaduto = async () => {
    localStorage.removeItem(STORAGE_KEY);
    await signOut(auth);
    alert("⏳ Sessione scaduta dopo 2 ore di inattività. Effettua nuovamente il login.");
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/backoffice")) {
      window.location.href = "/backoffice";
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

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

  useEffect(() => {
    const aggiornaAttivita = () => {
      if (isLoggedRef.current) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    };

    const eventi = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    eventi.forEach((ev) => window.addEventListener(ev, aggiornaAttivita, { passive: true }));

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
  }, []);

  return <>{children}</>;
}