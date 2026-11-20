"use client";

import { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { onAuthStateChanged, updatePassword, User } from "firebase/auth";
import { db, auth } from "../lib/firebase";

export default function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let unsubDb: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (unsubDb) {
        unsubDb();
        unsubDb = null;
      }

      if (currentUser?.email) {
        const key = currentUser.email.trim().toLowerCase().replace(/\./g, "_");
        const flagRef = ref(db, `impostazioni_globali/force_password_change/${key}`);
        unsubDb = onValue(flagRef, (snap) => {
          setMustChange(Boolean(snap.val()));
        });
      } else {
        setMustChange(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDb) unsubDb();
    };
  }, []);

  const handleCambiaPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore("");

    if (!user || !user.email) return;
    if (nuovaPassword.length < 6) {
      setErrore("⚠️ La nuova password deve avere almeno 6 caratteri.");
      return;
    }
    if (nuovaPassword !== confermaPassword) {
      setErrore("⚠️ Le due password non coincidono.");
      return;
    }

    setSalvando(true);
    try {
      await updatePassword(user, nuovaPassword);
      const key = user.email.trim().toLowerCase().replace(/\./g, "_");
      await remove(ref(db, `impostazioni_globali/force_password_change/${key}`));
      setMustChange(false);
      setNuovaPassword("");
      setConfermaPassword("");
      alert("✅ Password aggiornata con successo!");
    } catch (err: any) {
      console.error(err);
      setErrore("❌ Per sicurezza effettua di nuovo il login e riprova subito a cambiare la password.");
    } finally {
      setSalvando(false);
    }
  };

  if (!mustChange || !user) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/60 rounded-2xl p-6 md:p-8 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <div className="text-3xl">🔐</div>
          <h1 className="text-xl font-black text-amber-400 uppercase tracking-wider">
            Cambio Password Obbligatorio
          </h1>
          <p className="text-xs text-slate-400">
            Hai effettuato l'accesso con una password temporanea per <strong>{user.email}</strong>. Scegli ora la tua password definitiva per continuare.
          </p>
        </div>

        <form onSubmit={handleCambiaPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nuova Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={nuovaPassword}
              onChange={(e) => setNuovaPassword(e.target.value)}
              placeholder="Minimo 6 caratteri"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Conferma Nuova Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confermaPassword}
              onChange={(e) => setConfermaPassword(e.target.value)}
              placeholder="Ripeti la nuova password"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"
            />
          </div>

          {errore && (
            <div className="text-xs p-3 rounded-xl bg-red-950/70 border border-red-700 text-red-200 font-bold">
              {errore}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase py-3.5 rounded-xl text-xs shadow-lg"
          >
            {salvando ? "Salvataggio..." : "Imposta Password ed Entra"}
          </button>
        </form>
      </div>
    </main>
  );
}