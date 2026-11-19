"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { db, auth, googleProvider } from "../lib/firebase";

const SUPER_ADMIN_EMAIL = "fantaricccio@gmail.com";

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [isBackofficeRoute, setIsBackofficeRoute] = useState(false);
  const [sitoOffline, setSitoOffline] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsBackofficeRoute(window.location.pathname.startsWith("/backoffice"));
    }

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const offRef = ref(db, "impostazioni_globali/sitoOffline");
    const unsubOff = onValue(
      offRef,
      (snap) => {
        setSitoOffline(Boolean(snap.val()));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubAuth();
      unsubOff();
    };
  }, []);

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isBackofficeRoute || isSuperAdmin || loading || !sitoOffline) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans text-center">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-8 shadow-2xl space-y-5">
        <div className="text-4xl">🚧</div>
        <h1 className="text-2xl font-black text-amber-400 uppercase tracking-wider">
          Piattaforma in Manutenzione
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          <strong>FantaAsta Pro</strong> è momentaneamente offline per aggiornamenti e test interni. Torneremo online a breve!
        </p>

        {user ? (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-slate-500">Connesso come: {user.email}</div>
            <button
              onClick={() => signOut(auth)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
            >
              Disconnetti
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
          >
            Accesso Riservato Amministratore
          </button>
        )}
      </div>
    </main>
  );
}