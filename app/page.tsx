"use client";

import { useState, useEffect } from "react";
import { ref, push, set, onValue } from "firebase/database";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { db, auth, googleProvider } from "../lib/firebase";
import { sanitizeText } from "../lib/security";
import ThemeToggle from "../components/ThemeToggle";
import SupportModal from "../components/SupportModal";

const SUPER_ADMIN_EMAIL = "fantaricccio@gmail.com";

export default function HomePortale() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessaggio, setAuthMessaggio] = useState("");

  const [mieLeghe, setMieLeghe] = useState<any[]>([]);
  const [miaLicenza, setMiaLicenza] = useState<any>(null);

  const [formData, setFormData] = useState({
    nomeLega: "",
    modalita: "classic",
    partecipanti: "8",
    budget: "500",
    portieri: "3",
    difensori: "8",
    centrocampisti: "8",
    attaccanti: "6",
    portieriMantra: "3",
    totaleRosaMantra: "26",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMieLeghe([]);
      setMiaLicenza(null);
      return;
    }

    const userEmail = user.email?.toLowerCase().trim() || "";
    const licKey = userEmail.replace(/\./g, "_");

    const unsubLic = onValue(ref(db, `impostazioni_globali/licenze/${licKey}`), (snap) => {
      setMiaLicenza(snap.val());
    });

    const legheRef = ref(db, "leghe");
    const unsubscribe = onValue(legheRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.keys(data)
          .map((key) => {
            const lega = data[key];
            const coAdmins: string[] = Array.isArray(lega.coAdmins)
              ? lega.coAdmins.map((m: string) => m.toLowerCase().trim())
              : [];

            const isAdmin =
              lega.adminUid === user.uid ||
              (lega.adminEmail && lega.adminEmail.toLowerCase().trim() === userEmail) ||
              coAdmins.includes(userEmail);

            let miaSquadraNome = "";
            if (lega.squadre) {
              const squadreArr: any[] = Object.values(lega.squadre);
              const trovata = squadreArr.find(
                (sq) => sq.emailProprietario && sq.emailProprietario.toLowerCase().trim() === userEmail
              );
              if (trovata) miaSquadraNome = trovata.nome;
            }

            if (!isAdmin && !miaSquadraNome) return null;

            return {
              id: key,
              ...lega,
              ruoloUtente:
                isAdmin && miaSquadraNome
                  ? `Admin & ${miaSquadraNome}`
                  : isAdmin
                  ? "Admin Lega"
                  : `Squadra: ${miaSquadraNome}`,
              isAdmin,
              isFondatore:
                lega.adminUid === user.uid ||
                (lega.adminEmail && lega.adminEmail.toLowerCase().trim() === userEmail),
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        setMieLeghe(lista);
      } else {
        setMieLeghe([]);
      }
    });

    return () => {
      unsubLic();
      unsubscribe();
    };
  }, [user]);

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const legheCreateDaMe = mieLeghe.filter((l) => l.isFondatore).length;
  const maxLegheConsentite = isSuperAdmin ? 999 : miaLicenza?.attiva ? Number(miaLicenza.maxLeghe || 1) : 0;
  const puoCreareNuovaLega = isSuperAdmin || (Boolean(miaLicenza?.attiva) && legheCreateDaMe < maxLegheConsentite);

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
        setAuthMessaggio("⚠️ Questa email è già registrata. Prova ad accedere.");
      } else if (error.code === "auth/weak-password") {
        setAuthMessaggio("⚠️ La password deve avere almeno 6 caratteri.");
      } else {
        setAuthMessaggio("❌ Email o password non validi.");
      }
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthMessaggio("⚠️ Inserisci la tua email nel campo sopra.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessaggio("✅ Email per reimpostare la password inviata!");
    } catch {
      setAuthMessaggio("❌ Impossibile inviare l'email.");
    }
  };

  const apriLegaEsistente = (idLega: string) => {
    localStorage.setItem("legaAttualeId", idLega);
    window.location.href = `/dashboard?lega=${encodeURIComponent(idLega)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSalvaNuovaLega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !puoCreareNuovaLega) return;

    try {
      const legheRef = ref(db, "leghe");
      const nuovaLegaRef = push(legheRef);

      const isMantra = formData.modalita === "mantra";
      const slotTotali = isMantra
        ? parseInt(formData.totaleRosaMantra || "26")
        : parseInt(formData.portieri) +
          parseInt(formData.difensori) +
          parseInt(formData.centrocampisti) +
          parseInt(formData.attaccanti);

      const squadreIniziali: Record<string, any> = {};
      const numPartecipanti = parseInt(formData.partecipanti);

      for (let i = 0; i < numPartecipanti; i++) {
        squadreIniziali[`squadra_${i}`] = {
          id: i,
          nome: `Squadra ${i + 1}`,
          allenatore: "",
          emailProprietario: "",
          logo: "",
          crediti: parseInt(formData.budget),
          giocatoriOccupati: 0,
          slotTotali: slotTotali,
          rosa: isMantra ? { POR: [], MOV: [] } : { P: [], D: [], C: [], A: [] },
        };
      }

      await set(nuovaLegaRef, {
        ...formData,
        nomeLega: sanitizeText(formData.nomeLega, 50),
        adminUid: user.uid,
        adminEmail: user.email?.toLowerCase(),
        adminName: user.displayName || user.email?.split("@")[0] || "Admin",
        squadre: squadreIniziali,
        faseAttivaNome: "Prima Asta",
        impostazioniAsta: {
          modalita: "manuale",
          chiamata: "libera",
          ruoloAttivo: "TUTTI",
          timerSecondi: 5,
        },
        createdAt: new Date().toISOString(),
      });

      if (nuovaLegaRef.key) {
        localStorage.setItem("legaAttualeId", nuovaLegaRef.key);
        window.location.href = `/dashboard?lega=${encodeURIComponent(nuovaLegaRef.key)}`;
      }
    } catch (error) {
      console.error("Errore durante la creazione:", error);
      alert("Errore di connessione al database.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-amber-400 flex flex-col items-center justify-center font-sans">
        <h2 className="font-bold tracking-widest uppercase">Caricamento Piattaforma...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <SupportModal />
          <ThemeToggle />
        </div>

        <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden relative z-10">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center">
            <h1 className="text-3xl font-black text-white tracking-tight">⚽ FantaAsta Pro</h1>
            <p className="text-blue-100 mt-1 text-sm">Gestisci la tua asta live e le rose della tua lega in cloud.</p>
          </div>

          <div className="p-6 md:p-8">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-3 mb-6 border border-slate-300"
            >
              Continua con Google
            </button>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@esempio.it"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                />
              </div>

              {authMessaggio && (
                <div className="text-xs p-3 rounded border font-medium bg-red-900/30 text-red-300 border-red-700">
                  {authMessaggio}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition uppercase tracking-wider text-sm"
              >
                {isRegistering ? "Crea Account Gratuito" : "Accedi"}
              </button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthMessaggio("");
                }}
                className="hover:text-amber-400 font-semibold transition"
              >
                {isRegistering ? "Hai già un account? Accedi qui" : "Non hai un account? Registrati ora"}
              </button>

              {!isRegistering && (
                <button type="button" onClick={handleResetPassword} className="text-slate-500 hover:text-slate-300 underline">
                  Password dimenticata?
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER UTENTE CON STATO LICENZA + SUPPORTO + TEMA */}
        <header className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                <span>Ciao, {user.displayName || user.email?.split("@")[0]}</span>
                {isSuperAdmin ? (
                  <span className="bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                    Super Admin
                  </span>
                ) : miaLicenza?.attiva ? (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                    Licenza Admin ({legheCreateDaMe}/{maxLegheConsentite} leghe)
                  </span>
                ) : (
                  <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                    Account Partecipante
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">{user.email}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SupportModal />
            <ThemeToggle />
            <button
              onClick={() => signOut(auth)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition"
            >
              Esci
            </button>
          </div>
        </header>

        {/* LE TUE LEGHE */}
        <section className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-amber-400 uppercase tracking-wider mb-4">
            Le Tue Leghe ({mieLeghe.length})
          </h2>
          {mieLeghe.length === 0 ? (
            <p className="text-sm text-slate-400">
              Non risulti ancora iscritto a nessuna lega. Se sei stato invitato, apri il link di invito ricevuto dal tuo Admin!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mieLeghe.map((lega) => (
                <div
                  key={lega.id}
                  className="bg-slate-900/80 border border-slate-700 hover:border-blue-500 rounded-xl p-4 flex justify-between items-center gap-3 transition group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-lg group-hover:text-amber-400 transition truncate">
                        {lega.nomeLega}
                      </h3>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          lega.isAdmin
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {lega.ruoloUtente}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {lega.partecipanti} Squadre • Budget {lega.budget} • {lega.modalita?.toUpperCase()}
                    </p>
                  </div>
                  <button
                    onClick={() => apriLegaEsistente(lega.id)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow transition shrink-0"
                  >
                    Apri →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CREAZIONE LEGA (Solo se in possesso di Licenza Admin attiva) */}
        {puoCreareNuovaLega ? (
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">⚽ Crea una Nuova Lega</h1>
              <p className="text-blue-100 mt-1 text-sm font-medium">
                Slot licenza disponibili: {maxLegheConsentite - legheCreateDaMe} su {maxLegheConsentite}
              </p>
            </div>

            <form onSubmit={handleSalvaNuovaLega} className="p-6 md:p-8 space-y-8">
              <section>
                <h2 className="text-lg font-bold text-amber-400 border-b border-slate-600 pb-2 mb-4 uppercase tracking-wider">
                  1. Impostazioni Generali
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-1">Nome Lega</label>
                    <input
                      type="text"
                      name="nomeLega"
                      required
                      placeholder="Es. Fantaricccio 2026/2027"
                      value={formData.nomeLega}
                      onChange={handleChange}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">Modalità di Gioco</label>
                    <select
                      name="modalita"
                      value={formData.modalita}
                      onChange={handleChange}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white font-bold"
                    >
                      <option value="classic">Classic (P, D, C, A)</option>
                      <option value="mantra">Mantra (Multi-ruolo Por, Dd, Ds, Dc, E, M, C, W, T, A, Pc)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">Numero Partecipanti</label>
                    <select
                      name="partecipanti"
                      value={formData.partecipanti}
                      onChange={handleChange}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                    >
                      <option value="6">6 Squadre</option>
                      <option value="8">8 Squadre</option>
                      <option value="10">10 Squadre</option>
                      <option value="12">12 Squadre</option>
                      <option value="14">14 Squadre</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-1">Budget Iniziale (Crediti)</label>
                    <input
                      type="number"
                      name="budget"
                      min="1"
                      value={formData.budget}
                      onChange={handleChange}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-amber-400 border-b border-slate-600 pb-2 mb-4 uppercase tracking-wider">
                  2. Composizione Rosa ({formData.modalita === "mantra" ? "Mantra" : "Classic"})
                </h2>

                {formData.modalita === "classic" ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Portieri</label>
                      <input
                        type="number"
                        name="portieri"
                        min="1"
                        value={formData.portieri}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border-l-4 border-yellow-500 rounded-lg p-2.5 text-center text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Difensori</label>
                      <input
                        type="number"
                        name="difensori"
                        min="1"
                        value={formData.difensori}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border-l-4 border-green-500 rounded-lg p-2.5 text-center text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Centrocamp.</label>
                      <input
                        type="number"
                        name="centrocampisti"
                        min="1"
                        value={formData.centrocampisti}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border-l-4 border-blue-500 rounded-lg p-2.5 text-center text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Attaccanti</label>
                      <input
                        type="number"
                        name="attaccanti"
                        min="1"
                        value={formData.attaccanti}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border-l-4 border-red-500 rounded-lg p-2.5 text-center text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Slot Portieri (Por)</label>
                      <input
                        type="number"
                        name="portieriMantra"
                        min="1"
                        max="5"
                        value={formData.portieriMantra}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border-l-4 border-yellow-500 rounded-lg p-3 text-center text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        Totale Giocatori in Rosa
                      </label>
                      <input
                        type="number"
                        name="totaleRosaMantra"
                        min="15"
                        max="40"
                        value={formData.totaleRosaMantra}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border-l-4 border-purple-500 rounded-lg p-3 text-center text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </section>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-black text-lg py-4 rounded-xl shadow-lg uppercase tracking-widest"
                >
                  Crea Lega Ora
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 text-center space-y-3">
            <h3 className="text-base font-black text-amber-400 uppercase">Vuoi creare e gestire una tua Lega?</h3>
            <p className="text-xs text-slate-300 max-w-lg mx-auto">
              {miaLicenza?.attiva
                ? `Hai già raggiunto il limite massimo di ${maxLegheConsentite} leghe incluse nella tua licenza attuale.`
                : "La creazione di una nuova lega è riservata agli Admin con licenza attiva. Contatta il supporto per attivare la tua licenza."}
            </p>
            <div className="flex justify-center pt-1">
              <SupportModal />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}