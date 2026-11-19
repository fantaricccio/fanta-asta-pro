"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ref, onValue, update } from "firebase/database";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { db, auth, googleProvider } from "../../../lib/firebase";

export default function PaginaInvitoLega() {
  const params = useParams();
  const router = useRouter();
  const legaId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessaggio, setAuthMessaggio] = useState("");

  const [lega, setLega] = useState<any>(null);
  const [squadre, setSquadre] = useState<any[]>([]);
  const [loadingLega, setLoadingLega] = useState(true);

  const [slotSelezionatoId, setSlotSelezionatoId] = useState<string>("");
  const [nomeSquadra, setNomeSquadra] = useState("");
  const [allenatore, setAllenatore] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!legaId) {
      setLoadingLega(false);
      return;
    }

    const legaRef = ref(db, `leghe/${legaId}`);
    const unsub = onValue(legaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLega(data);
        if (data.squadre) {
          const arr = Object.values(data.squadre).sort((a: any, b: any) => a.id - b.id);
          setSquadre(arr);
        }
      } else {
        setLega(null);
      }
      setLoadingLega(false);
    });

    return () => unsub();
  }, [legaId]);

  const tornaIndietro = () => {
    if (legaId) {
      localStorage.setItem("legaAttualeId", legaId);
      router.push("/dashboard");
    } else {
      router.push("/");
    }
  };

  const handleGoogleLogin = async () => {
    setAuthMessaggio("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setAuthMessaggio("❌ Accesso con Google non riuscito.");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessaggio("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setAuthMessaggio("⚠️ Email già registrata. Passa ad Accedi.");
      } else {
        setAuthMessaggio("❌ Credenziali non valide.");
      }
    }
  };

  const squadraGiaAssegnata = squadre.find(
    (sq) =>
      user?.email &&
      sq.emailProprietario &&
      sq.emailProprietario.toLowerCase().trim() === user.email.toLowerCase().trim()
  );

  const slotLiberi = squadre.filter((sq) => !sq.emailProprietario || sq.emailProprietario.trim() === "");

  const entraSubitoInDashboard = () => {
    localStorage.setItem("legaAttualeId", legaId);
    router.push("/dashboard");
  };

  const handleConfermaIscrizione = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !legaId || slotSelezionatoId === "") return;

    setSalvando(true);
    try {
      const teamRef = ref(db, `leghe/${legaId}/squadre/squadra_${slotSelezionatoId}`);
      await update(teamRef, {
        nome: nomeSquadra.trim(),
        allenatore: allenatore.trim(),
        emailProprietario: user.email.trim().toLowerCase(),
        logo: logoUrl.trim(),
      });

      localStorage.setItem("legaAttualeId", legaId);
      router.push("/dashboard");
    } catch {
      alert("Errore durante il salvataggio della squadra.");
    } finally {
      setSalvando(false);
    }
  };

  if (authLoading || loadingLega) {
    return (
      <div className="min-h-screen bg-slate-950 text-amber-400 flex flex-col items-center justify-center font-sans">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase">Verifica Invito Lega...</h2>
      </div>
    );
  }

  if (!lega) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans text-center">
        <div className="bg-slate-900 border border-red-800/60 p-8 rounded-2xl max-w-md space-y-4 shadow-2xl">
          <i className="fa-solid fa-link-slash text-4xl text-red-500"></i>
          <h1 className="text-xl font-black uppercase text-white">Link Non Valido</h1>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl"
          >
            Torna alla Home
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-center relative">
            <button
              onClick={() => router.push("/")}
              className="absolute left-4 top-4 bg-black/25 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <i className="fa-solid fa-arrow-left"></i> Indietro
            </button>
            <div className="text-xs font-black uppercase tracking-widest text-emerald-100 mb-1 mt-4">
              Invito nella lega
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">{lega.nomeLega}</h1>
          </div>

          <div className="p-6 space-y-5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-3"
            >
              <i className="fa-brands fa-google text-red-500 text-lg"></i>
              Continua con Google
            </button>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="La tua email"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white"
              />
              {authMessaggio && (
                <div className="text-xs p-2.5 rounded bg-red-950/60 border border-red-800 text-red-300">
                  {authMessaggio}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm uppercase"
              >
                {isRegistering ? "Registrati ed Entra" : "Accedi ed Entra"}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-xs text-slate-400 hover:text-amber-400 font-semibold"
              >
                {isRegistering ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-lg w-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center relative">
          <button
            onClick={tornaIndietro}
            className="absolute left-4 top-4 bg-black/25 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            <i className="fa-solid fa-arrow-left"></i> Indietro
          </button>
          <div className="text-xs font-black uppercase tracking-widest text-blue-200 mb-1 mt-4">
            Benvenuto nella Lega
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">{lega.nomeLega}</h1>
          <p className="text-xs text-blue-100 mt-1">Connesso come: {user.email}</p>
        </div>

        <div className="p-6 md:p-8">
          {squadraGiaAssegnata ? (
            <div className="text-center space-y-5">
              <h2 className="text-xl font-black text-white">Fai già parte di questa lega!</h2>
              <p className="text-sm text-slate-400">
                La tua squadra è <strong className="text-amber-400">{squadraGiaAssegnata.nome}</strong>.
              </p>
              <button
                onClick={entraSubitoInDashboard}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase py-4 rounded-xl shadow-lg"
              >
                Vai al Tabellone <i className="fa-solid fa-arrow-right ml-2"></i>
              </button>
            </div>
          ) : slotLiberi.length === 0 ? (
            <div className="text-center space-y-5">
              <h2 className="text-xl font-black text-white">Lega al Completo</h2>
              <button
                onClick={entraSubitoInDashboard}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl"
              >
                Torna al Tabellone
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfermaIscrizione} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  1. Scegli lo Slot Disponibile ({slotLiberi.length} liberi)
                </label>
                <select
                  required
                  value={slotSelezionatoId}
                  onChange={(e) => {
                    setSlotSelezionatoId(e.target.value);
                    const sq = slotLiberi.find((s) => String(s.id) === e.target.value);
                    if (sq && !nomeSquadra) setNomeSquadra(sq.nome);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-bold"
                >
                  <option value="">-- Seleziona uno slot --</option>
                  {slotLiberi.map((sq) => (
                    <option key={sq.id} value={sq.id}>
                      Slot #{sq.id + 1} ({sq.nome} • Budget {sq.crediti})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">2. Nome Squadra</label>
                <input
                  type="text"
                  required
                  value={nomeSquadra}
                  onChange={(e) => setNomeSquadra(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  3. Allenatore / Co-Presidente (Opzionale)
                </label>
                <input
                  type="text"
                  value={allenatore}
                  onChange={(e) => setAllenatore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">4. Link Logo (Opzionale)</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase py-4 rounded-xl shadow-lg"
              >
                {salvando ? "Registrazione..." : "Conferma ed Entra nella Lega"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}