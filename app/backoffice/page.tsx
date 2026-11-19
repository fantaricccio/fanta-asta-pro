"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ref, set, onValue, remove, update } from "firebase/database";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { db, auth, googleProvider } from "../../lib/firebase";
import * as XLSX from "xlsx";

const SUPER_ADMIN_EMAIL = "fantaricccio@gmail.com";

export default function SuperAdminBackoffice() {
  const router = useRouter();

  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [authMessaggio, setAuthMessaggio] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const [activeTab, setActiveTab] = useState<"leghe" | "listoni" | "logs">("leghe");

  const [loadingClassic, setLoadingClassic] = useState(false);
  const [msgClassic, setMsgClassic] = useState("");
  const [loadingMantra, setLoadingMantra] = useState(false);
  const [msgMantra, setMsgMantra] = useState("");

  const [leghe, setLeghe] = useState<any[]>([]);
  const [selectedLegaForUsers, setSelectedLegaForUsers] = useState<any>(null);
  const [selectedLegaForLogs, setSelectedLegaForLogs] = useState<string>("TUTTE");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          setAdminUser(user);
        } else {
          await signOut(auth);
          setAdminUser(null);
          setAuthMessaggio("⛔ Accesso negato: permessi Super Admin richiesti.");
        }
      } else {
        setAdminUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!adminUser) return;

    const legheRef = ref(db, "leghe");
    const unsubscribe = onValue(legheRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const legheArray = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setLeghe(legheArray);

        if (selectedLegaForUsers) {
          const updated = legheArray.find((l) => l.id === selectedLegaForUsers.id);
          if (updated) setSelectedLegaForUsers(updated);
        }
      } else {
        setLeghe([]);
      }
    });

    return () => unsubscribe();
  }, [adminUser, selectedLegaForUsers?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessaggio("");
    if (email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      setAuthMessaggio("⛔ Email non autorizzata.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setAuthMessaggio("❌ Email o Password errate.");
    }
  };

  const handleGoogleLogin = async () => {
    setAuthMessaggio("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setAuthMessaggio("⛔ Account Google non autorizzato.");
      }
    } catch {
      setAuthMessaggio("❌ Accesso con Google fallito.");
    }
  };

  const handleResetPassword = async () => {
    if (!email) return;
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessaggio("✅ Email di reset inviata!");
    } catch {
      setAuthMessaggio("❌ Errore nell'invio dell'email.");
    } finally {
      setIsResetting(false);
    }
  };

  const entraNellaLega = (idLega: string) => {
    localStorage.setItem("legaAttualeId", idLega);
    router.push("/dashboard");
  };

  const eliminaLega = async (idLega: string, nomeLega: string) => {
    if (confirm(`⚠️ Eliminare DEFINITIVAMENTE la lega "${nomeLega}"?`)) {
      await remove(ref(db, `leghe/${idLega}`));
    }
  };

  const toggleCoAdminSquadra = async (lega: any, squadra: any) => {
    const mail = (squadra.emailProprietario || "").trim().toLowerCase();
    if (!mail) {
      alert("Questa squadra non ha ancora un'email partecipante associata.");
      return;
    }

    const coAdmins: string[] = Array.isArray(lega.coAdmins) ? [...lega.coAdmins] : [];
    const isCurrentlyCoAdmin =
      mail === (lega.adminEmail || "").toLowerCase() || coAdmins.map((m) => m.toLowerCase()).includes(mail);

    if (mail === (lega.adminEmail || "").toLowerCase()) {
      alert("Questo utente è il creatore principale della lega (Admin fondatore).");
      return;
    }

    const nuoviCoAdmins = isCurrentlyCoAdmin
      ? coAdmins.filter((m) => m.toLowerCase() !== mail)
      : [...coAdmins, mail];

    await update(ref(db, `leghe/${lega.id}`), {
      coAdmins: nuoviCoAdmins,
    });
  };

  const rimuoviPartecipanteDaSquadra = async (legaId: string, squadraId: number) => {
    if (!confirm("Vuoi scollegare questo utente dallo slot squadra?")) return;
    await update(ref(db, `leghe/${legaId}/squadre/squadra_${squadraId}`), {
      emailProprietario: "",
    });
  };

  const pulisciChiave = (str: any) => {
    if (!str) return "";
    return String(str).replace(/[.#$\[\]\/]/g, "");
  };

  const pulisciTestoPreservandoAsterisco = (str: any) => {
    if (!str) return "";
    return String(str).replace(/[.#$\[\]\/]/g, "").trim();
  };

  const importaExcelListone = (file: File, tipo: "classic" | "mantra") => {
    const setLoad = tipo === "classic" ? setLoadingClassic : setLoadingMantra;
    const setMsg = tipo === "classic" ? setMsgClassic : setMsgMantra;

    setLoad(true);
    setMsg(`Lettura file ${tipo.toUpperCase()} in corso...`);

    const reader = new FileReader();
    reader.onload = async (evento) => {
      try {
        const data = new Uint8Array(evento.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const foglio = workbook.Sheets[workbook.SheetNames[0]];
        const righe: any[] = XLSX.utils.sheet_to_json(foglio);

        const listone: Record<string, any> = {};
        let salvati = 0;

        righe.forEach((riga) => {
          const rawId = riga["#"] || riga["Id"] || riga["ID"];
          const rawRuolo = riga["R."] || riga["Ruolo"];
          const rawRuoloMantra = riga["R.MANTRA"] || riga["Ruolo Mantra"] || rawRuolo;
          const rawNome = riga["Nome"];
          const rawSquadra = riga["Sq."] || riga["Squadra"];
          const rawQuotazione = riga["QUOT."] || riga["Quotazione"] || riga["Quotazione Iniziale"];
          const fuoriLista = riga["Fuori lista"] || riga["Fuori Lista"] || "";

          if (rawId && rawNome && rawRuolo) {
            const idPulito = pulisciChiave(rawId);
            const nomePulito = pulisciTestoPreservandoAsterisco(rawNome);
            const isAsterisco =
              nomePulito.includes("*") || (String(fuoriLista).trim() !== "" && String(fuoriLista).toLowerCase() !== "nan");

            listone[`giocatore_${idPulito}`] = {
              id: idPulito,
              ruolo: pulisciTestoPreservandoAsterisco(rawRuolo),
              ruoloMantra: pulisciTestoPreservandoAsterisco(rawRuoloMantra),
              nome: nomePulito,
              esteroAsterisco: isAsterisco,
              squadra: pulisciTestoPreservandoAsterisco(rawSquadra) || "Svincolato",
              quotazioneBase: parseInt(rawQuotazione) || 1,
              quotazioneAttuale: parseInt(rawQuotazione) || 1,
            };
            salvati++;
          }
        });

        if (salvati === 0) {
          setMsg("❌ Nessun giocatore valido trovato nel file.");
          setLoad(false);
          return;
        }

        const pathDb =
          tipo === "classic" ? "impostazioni_globali/listone_classic" : "impostazioni_globali/listone_mantra";

        await set(ref(db, pathDb), listone);
        setMsg(`✅ Listone ${tipo.toUpperCase()} salvato! (${salvati} calciatori caricati)`);
      } catch (err) {
        console.error(err);
        setMsg("❌ Errore durante l'elaborazione del file Excel.");
      } finally {
        setLoad(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const tuttiILog = leghe
    .flatMap((lega) =>
      (lega.auditLogs || []).map((log: any) => ({
        ...log,
        legaId: lega.id,
        nomeLega: lega.nomeLega,
      }))
    )
    .filter((l) => selectedLegaForLogs === "TUTTE" || l.legaId === selectedLegaForLogs)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const scaricaLogCSV = () => {
    const righe = [
      ["Data/Ora", "Lega", "Fase", "Azione", "Dettagli", "Autore"].join(";"),
      ...tuttiILog.map((l) =>
        [
          new Date(l.timestamp).toLocaleString("it-IT"),
          `"${(l.nomeLega || "").replace(/"/g, "'")}"`,
          `"${(l.fase || "Prima Asta").replace(/"/g, "'")}"`,
          `"${(l.azione || "").replace(/"/g, "'")}"`,
          `"${(l.dettaglio || "").replace(/"/g, "'")}"`,
          `"${(l.autore || "").replace(/"/g, "'")}"`,
        ].join(";")
      ),
    ];

    const blob = new Blob(["\uFEFF" + righe.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log_piattaforma_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-red-500 flex flex-col items-center justify-center font-sans">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase">Verifica Sicurezza...</h2>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-red-500 tracking-widest uppercase">System Admin</h1>
            <p className="text-neutral-400 mt-2 text-sm">Area riservata al proprietario della piattaforma</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-neutral-200 text-neutral-900 font-bold py-3 px-4 rounded-lg shadow-md transition flex items-center justify-center gap-3 mb-6"
          >
            Accedi con Google
          </button>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-3 px-4 text-white"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-3 px-4 text-white"
              required
            />
            {authMessaggio && (
              <div className="text-xs p-3 rounded bg-red-900/20 text-red-400 border border-red-900/30">
                {authMessaggio}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg uppercase tracking-wider"
            >
              Accedi al Sistema
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={isResetting}
              className="text-neutral-500 hover:text-white text-xs underline"
            >
              Hai dimenticato la password? Invia reset
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="border-b border-red-900/50 pb-5 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-red-500 uppercase tracking-widest">
              Super Admin Area
            </h1>
            <p className="text-neutral-500 mt-1 text-xs md:text-sm">
              Connesso come: <strong className="text-white">{adminUser.email}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/")}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-2 rounded border border-neutral-700 text-xs font-bold uppercase"
            >
              Portale Utenti
            </button>
            <button
              onClick={() => signOut(auth)}
              className="bg-red-900/30 hover:bg-red-600 text-red-300 hover:text-white px-3 py-2 rounded border border-red-900/50 text-xs font-bold uppercase"
            >
              Esci
            </button>
          </div>
        </header>

        {/* BARRA NAVIGAZIONE A SCHEDE IN ALTO */}
        <nav className="flex flex-wrap gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab("leghe")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "leghe" ? "bg-blue-600 text-white shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Leghe & Utenti ({leghe.length})
          </button>
          <button
            onClick={() => setActiveTab("listoni")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "listoni" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Listoni Classic & Mantra
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "logs" ? "bg-amber-500 text-neutral-950 shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Registro Log & Audit ({tuttiILog.length})
          </button>
        </nav>

        {/* TAB 1: GESTIONE LEGHE & RUOLI UTENTI */}
        {activeTab === "leghe" && (
          <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Leghe Attive sulla Piattaforma</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-400">
                <thead className="text-xs text-neutral-500 uppercase bg-neutral-950/60 border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Nome Lega</th>
                    <th className="px-4 py-3">Admin Fondatore</th>
                    <th className="px-4 py-3 text-center">Modalità</th>
                    <th className="px-4 py-3 text-center">Partecipanti</th>
                    <th className="px-4 py-3 text-right">Azioni Super Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {leghe.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-neutral-600 italic">
                        Nessuna lega creata al momento.
                      </td>
                    </tr>
                  ) : (
                    leghe.map((lega) => (
                      <tr key={lega.id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition">
                        <td className="px-4 py-4 font-bold text-white">
                          <div>{lega.nomeLega}</div>
                          <div className="text-[10px] text-neutral-600 font-mono">ID: {lega.id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-neutral-200 font-semibold">{lega.adminName || "Admin"}</div>
                          <div className="text-xs text-neutral-500">{lega.adminEmail}</div>
                        </td>
                        <td className="px-4 py-4 text-center uppercase text-xs font-bold text-amber-400">
                          {lega.modalita}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-neutral-300">{lega.partecipanti}</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedLegaForUsers(lega)}
                              className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-600/40 px-3 py-2 rounded text-xs font-bold transition"
                            >
                              Utenti / Ruoli
                            </button>
                            <button
                              onClick={() => entraNellaLega(lega.id)}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-xs font-bold transition"
                            >
                              Entra
                            </button>
                            <button
                              onClick={() => eliminaLega(lega.id, lega.nomeLega)}
                              className="bg-red-900/50 hover:bg-red-600 text-red-300 hover:text-white border border-red-900/50 px-3 py-2 rounded text-xs font-bold transition"
                            >
                              Elimina
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: CARICAMENTO LISTONI */}
        {activeTab === "listoni" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-4">
              <h2 className="text-xl font-bold text-white">Listone Modalità CLASSIC</h2>
              <p className="text-xs text-neutral-400">
                Carica il file Excel (.xlsx) del listone Classic. Il sistema mantiene l'asterisco <strong>*</strong> sui calciatori ceduti all'estero o in serie minori.
              </p>
              <div className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center bg-neutral-950/50">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  disabled={loadingClassic}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importaExcelListone(f, "classic");
                  }}
                  className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
              </div>
              {msgClassic && (
                <div className="p-3 rounded-lg text-xs font-bold bg-neutral-950 border border-neutral-800 text-emerald-400">
                  {msgClassic}
                </div>
              )}
            </section>

            <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-4">
              <h2 className="text-xl font-bold text-white">Listone Modalità MANTRA</h2>
              <p className="text-xs text-neutral-400">
                Carica il file Excel (.xlsx) del listone Mantra (con colonna <code>R.MANTRA</code>) per le leghe che giocano in modalità Mantra.
              </p>
              <div className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center bg-neutral-950/50">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  disabled={loadingMantra}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importaExcelListone(f, "mantra");
                  }}
                  className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
              </div>
              {msgMantra && (
                <div className="p-3 rounded-lg text-xs font-bold bg-neutral-950 border border-neutral-800 text-blue-400">
                  {msgMantra}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: REGISTRO LOG */}
        {activeTab === "logs" && (
          <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Registro Operazioni Aste & Riparazioni</h2>
                <p className="text-xs text-neutral-400">
                  Cronologia completa di assegnazioni, svincoli e sessioni per verifiche e assistenza.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedLegaForLogs}
                  onChange={(e) => setSelectedLegaForLogs(e.target.value)}
                  className="bg-neutral-950 border border-neutral-700 text-xs font-bold text-white rounded-lg px-3 py-2"
                >
                  <option value="TUTTE">Tutte le leghe</option>
                  {leghe.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nomeLega}
                    </option>
                  ))}
                </select>

                <button
                  onClick={scaricaLogCSV}
                  disabled={tuttiILog.length === 0}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition"
                >
                  Scarica Log (.CSV)
                </button>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-950 text-neutral-500 uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Data / Ora</th>
                    <th className="p-3">Lega</th>
                    <th className="p-3">Fase</th>
                    <th className="p-3">Azione</th>
                    <th className="p-3">Dettagli</th>
                    <th className="p-3">Autore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {tuttiILog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-600 italic">
                        Nessun evento registrato nei log.
                      </td>
                    </tr>
                  ) : (
                    tuttiILog.map((log, idx) => (
                      <tr key={idx} className="hover:bg-neutral-800/40">
                        <td className="p-3 font-mono text-neutral-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("it-IT")}
                        </td>
                        <td className="p-3 font-bold text-white">{log.nomeLega}</td>
                        <td className="p-3 text-blue-400 font-semibold">{log.fase || "Prima Asta"}</td>
                        <td className="p-3 font-bold uppercase text-amber-400">{log.azione}</td>
                        <td className="p-3">{log.dettaglio}</td>
                        <td className="p-3 text-neutral-400">{log.autore}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* MODAL GESTIONE UTENTI E RUOLI DI UNA LEGA (Con X Chiudi e pulsante Chiudi in basso) */}
      {selectedLegaForUsers && (
        <div
          onClick={() => setSelectedLegaForUsers(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="bg-neutral-800 p-4 flex justify-between items-center border-b border-neutral-700">
              <div>
                <h3 className="text-lg font-black text-white">
                  Gestione Ruoli • <span className="text-amber-400">{selectedLegaForUsers.nomeLega}</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Admin Fondatore: <strong>{selectedLegaForUsers.adminEmail}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLegaForUsers(null)}
                className="bg-neutral-950 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-neutral-800 flex-1">
              {(selectedLegaForUsers.squadre ? Object.values(selectedLegaForUsers.squadre) : []).map((sq: any) => {
                const mail = (sq.emailProprietario || "").trim().toLowerCase();
                const coAdmins: string[] = Array.isArray(selectedLegaForUsers.coAdmins)
                  ? selectedLegaForUsers.coAdmins.map((m: string) => m.toLowerCase())
                  : [];
                const isFounder = mail && mail === (selectedLegaForUsers.adminEmail || "").toLowerCase();
                const isCoAdmin = mail && (isFounder || coAdmins.includes(mail));

                return (
                  <div key={sq.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{sq.nome}</span>
                        {mail ? (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                              isCoAdmin
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            }`}
                          >
                            {isCoAdmin ? "Admin + Giocatore" : "Solo Giocatore"}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500">
                            Slot Libero
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {mail || "Nessun partecipante registrato"}
                      </div>
                    </div>

                    {mail && (
                      <div className="flex gap-2">
                        {!isFounder && (
                          <button
                            onClick={() => toggleCoAdminSquadra(selectedLegaForUsers, sq)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              isCoAdmin
                                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                : "bg-amber-600 hover:bg-amber-500 text-white"
                            }`}
                          >
                            {isCoAdmin ? "Rimuovi Admin" : "Promuovi ad Admin"}
                          </button>
                        )}
                        <button
                          onClick={() => rimuoviPartecipanteDaSquadra(selectedLegaForUsers.id, sq.id)}
                          className="bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                        >
                          Scollega
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-neutral-950 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedLegaForUsers(null)}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider"
              >
                Chiudi e Torna alle Leghe
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}