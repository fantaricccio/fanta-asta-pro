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

  const [sitoOffline, setSitoOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<"leghe" | "licenze" | "listoni" | "ticket" | "logs">("leghe");

  const [loadingClassic, setLoadingClassic] = useState(false);
  const [msgClassic, setMsgClassic] = useState("");
  const [loadingMantra, setLoadingMantra] = useState(false);
  const [msgMantra, setMsgMantra] = useState("");

  const [leghe, setLeghe] = useState<any[]>([]);
  const [licenze, setLicenze] = useState<Record<string, any>>({});
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedLegaForUsers, setSelectedLegaForUsers] = useState<any>(null);
  const [selectedLegaForLogs, setSelectedLegaForLogs] = useState<string>("TUTTE");

  // Form Nuova Licenza
  const [licEmail, setLicEmail] = useState("");
  const [licMaxLeghe, setLicMaxLeghe] = useState("1");
  const [licNote, setLicNote] = useState("Stagione 2026/2027");

  // Campi editabili nella modal Utenti / Admin della lega
  const [nuovoAdminEmail, setNuovoAdminEmail] = useState("");
  const [slotEmailsDraft, setSlotEmailsDraft] = useState<Record<number, string>>({});
  const [tempPasswordBox, setTempPasswordBox] = useState<{ email: string; tempPassword: string; emailInviata: boolean } | null>(null);

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

    const unsubOffline = onValue(ref(db, "impostazioni_globali/sitoOffline"), (snap) => {
      setSitoOffline(Boolean(snap.val()));
    });

    const unsubLicenze = onValue(ref(db, "impostazioni_globali/licenze"), (snap) => {
      setLicenze(snap.val() || {});
    });

    const unsubTickets = onValue(ref(db, "impostazioni_globali/ticket_supporto"), (snap) => {
      const val = snap.val();
      if (val) {
        const arr = Object.keys(val)
          .map((k) => ({ id: k, ...val[k] }))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setTickets(arr);
      } else {
        setTickets([]);
      }
    });

    const legheRef = ref(db, "leghe");
    const unsubscribeLeghe = onValue(legheRef, (snapshot) => {
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

    return () => {
      unsubOffline();
      unsubLicenze();
      unsubTickets();
      unsubscribeLeghe();
    };
  }, [adminUser, selectedLegaForUsers?.id]);

  const toggleSitoOffline = async () => {
    await set(ref(db, "impostazioni_globali/sitoOffline"), !sitoOffline);
  };

  // --- GESTIONE LICENZE ---
  const emailToKey = (mail: string) => mail.trim().toLowerCase().replace(/\./g, "_");

  const salvaLicenza = async (e: React.FormEvent) => {
    e.preventDefault();
    const mailClean = licEmail.trim().toLowerCase();
    if (!mailClean) return;

    await set(ref(db, `impostazioni_globali/licenze/${emailToKey(mailClean)}`), {
      email: mailClean,
      maxLeghe: Math.max(1, parseInt(licMaxLeghe) || 1),
      attiva: true,
      note: licNote.trim() || "Licenza Attiva",
      aggiornataIl: new Date().toISOString(),
    });

    setLicEmail("");
    setLicMaxLeghe("1");
  };

  const toggleStatoLicenza = async (chiave: string, statoAttuale: boolean) => {
    await update(ref(db, `impostazioni_globali/licenze/${chiave}`), {
      attiva: !statoAttuale,
    });
  };

  const eliminaLicenza = async (chiave: string) => {
    if (!confirm("Rimuovere definitivamente questa licenza?")) return;
    await remove(ref(db, `impostazioni_globali/licenze/${chiave}`));
  };

  // --- AUTH ---
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
    window.location.href = `/dashboard?lega=${encodeURIComponent(idLega)}`;
  };

  const eliminaLega = async (idLega: string, nomeLega: string) => {
    if (confirm(`⚠️ Eliminare DEFINITIVAMENTE la lega "${nomeLega}"?`)) {
      await remove(ref(db, `leghe/${idLega}`));
    }
  };

  // --- GESTIONE AVANZATA ADMIN, PARTECIPANTI, INVITI E RESET PASSWORD TEMPORANEA ---
  const apriModalUtentiLega = (lega: any) => {
    setSelectedLegaForUsers(lega);
    setTempPasswordBox(null);
    setNuovoAdminEmail(lega.adminEmail || "");
    const drafts: Record<number, string> = {};
    if (lega.squadre) {
      Object.values(lega.squadre).forEach((sq: any) => {
        drafts[sq.id] = sq.emailProprietario || "";
      });
    }
    setSlotEmailsDraft(drafts);
  };

  const sostituisciAdminLega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLegaForUsers) return;
    const mailClean = nuovoAdminEmail.trim().toLowerCase();
    if (!mailClean) return;

    await update(ref(db, `leghe/${selectedLegaForUsers.id}`), {
      adminEmail: mailClean,
      adminUid: "",
    });
    alert(`✅ Admin della lega aggiornato a: ${mailClean}`);
  };

  const salvaEInvitaPartecipanteSlot = async (lega: any, squadra: any, inviaMail: boolean) => {
    const mailClean = (slotEmailsDraft[squadra.id] ?? squadra.emailProprietario ?? "").trim().toLowerCase();
    await update(ref(db, `leghe/${lega.id}/squadre/squadra_${squadra.id}`), {
      emailProprietario: mailClean,
      statoInvito: mailClean ? (squadra.ultimoAccesso ? "attivo" : "invitato") : "",
      invitatoIl: mailClean ? new Date().toISOString() : null,
    });

    if (inviaMail && mailClean) {
      const linkInvito = `${window.location.origin}/invito/${lega.id}`;
      try {
        const res = await fetch("/api/invita", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailDestinatario: mailClean,
            nomeLega: lega.nomeLega,
            linkInvito,
            mittente: "Super Admin FantaAsta Pro",
          }),
        });
        const data = await res.json();
        if (data.sentViaServer) {
          alert(`✅ Email di invito inviata con successo a ${mailClean}!`);
        } else {
          const subject = `Invito Lega Fantacalcio: ${lega.nomeLega}`;
          const body = `Ciao!\n\nSei stato invitato nella lega "${lega.nomeLega}" su FantaAsta Pro.\nAccedi da questo link:\n${linkInvito}`;
          window.open(
            `mailto:${encodeURIComponent(mailClean)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
            "_blank"
          );
        }
      } catch {
        alert("✅ Email salvata nello slot squadra!");
      }
    } else {
      alert("✅ Email partecipante salvata nello slot!");
    }
  };

  const generaPasswordTemporaneaUtente = async (lega: any, emailUtente: string) => {
    const mailClean = emailUtente.trim().toLowerCase();
    if (!mailClean) return;

    try {
      // 1. Invia anche email ufficiale di reset Firebase (per aggiornare la password su Firebase Auth)
      await sendPasswordResetEmail(auth, mailClean).catch(() => {});

      // 2. Genera password temporanea e imposta obbligo cambio al primo accesso
      const res = await fetch("/api/admin-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailUtente: mailClean, nomeLega: lega.nomeLega }),
      });
      const data = await res.json();

      if (data.ok && data.tempPassword) {
        await set(ref(db, `impostazioni_globali/force_password_change/${emailToKey(mailClean)}`), {
          email: mailClean,
          tempPassword: data.tempPassword,
          createdAt: new Date().toISOString(),
        });

        setTempPasswordBox({
          email: mailClean,
          tempPassword: data.tempPassword,
          emailInviata: Boolean(data.emailInviata),
        });
      }
    } catch {
      alert("Errore durante il reset password.");
    }
  };

  const toggleCoAdminSquadra = async (lega: any, squadra: any) => {
    const mail = (squadra.emailProprietario || "").trim().toLowerCase();
    if (!mail) {
      alert("Inserisci e salva prima un'email partecipante su questo slot.");
      return;
    }

    const coAdmins: string[] = Array.isArray(lega.coAdmins) ? [...lega.coAdmins] : [];
    const isCurrentlyCoAdmin =
      mail === (lega.adminEmail || "").toLowerCase() || coAdmins.map((m) => m.toLowerCase()).includes(mail);

    if (mail === (lega.adminEmail || "").toLowerCase()) {
      alert("Questo utente è già l'Admin principale della lega.");
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
    setSlotEmailsDraft((prev) => ({ ...prev, [squadraId]: "" }));
    await update(ref(db, `leghe/${legaId}/squadre/squadra_${squadraId}`), {
      emailProprietario: "",
      statoInvito: "",
      ultimoAccesso: null,
    });
  };

  // --- IMPORTAZIONE LISTONI ---
  const pulisciChiave = (str: any) => (str ? String(str).replace(/[.#$\[\]\/]/g, "") : "");
  const pulisciTestoPreservandoAsterisco = (str: any) =>
    str ? String(str).replace(/[.#$\[\]\/]/g, "").trim() : "";

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
              nomePulito.includes("*") ||
              (String(fuoriLista).trim() !== "" && String(fuoriLista).toLowerCase() !== "nan");

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

  // --- LOGS ---
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
        <h2 className="font-bold tracking-widest uppercase">Verifica Sicurezza...</h2>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
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

  const listaLicenze = Object.entries(licenze);
  const ticketApertiCount = tickets.filter((t) => t.stato !== "risolto").length;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="border-b border-red-900/50 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-red-500 uppercase tracking-widest">
              Super Admin Area
            </h1>
            <p className="text-neutral-500 mt-1 text-xs md:text-sm">
              Connesso come: <strong className="text-white">{adminUser.email}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSitoOffline}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border transition ${
                sitoOffline
                  ? "bg-red-600 text-white border-red-400 animate-pulse"
                  : "bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {sitoOffline ? "🔴 Sito OFFLINE (Clicca per Mettere Online)" : "🟢 Sito ONLINE (Clicca per Mettere Offline)"}
            </button>

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

        <nav className="flex flex-wrap gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab("leghe")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "leghe" ? "bg-blue-600 text-white shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Leghe & Utenti ({leghe.length})
          </button>
          <button
            onClick={() => setActiveTab("licenze")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "licenze" ? "bg-purple-600 text-white shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Licenze Admin ({listaLicenze.length})
          </button>
          <button
            onClick={() => setActiveTab("listoni")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "listoni" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Listoni Classic & Mantra
          </button>
          <button
            onClick={() => setActiveTab("ticket")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "ticket" ? "bg-sky-600 text-white shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Supporto ({ticketApertiCount})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === "logs" ? "bg-amber-500 text-neutral-950 shadow" : "text-neutral-400 hover:text-white"
            }`}
          >
            Log ({tuttiILog.length})
          </button>
        </nav>

        {/* TAB 1: GESTIONE LEGHE & UTENTI */}
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
                              onClick={() => apriModalUtentiLega(lega)}
                              className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-600/40 px-3 py-2 rounded text-xs font-bold transition"
                            >
                              Utenti / Inviti / Reset Pwd
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

        {/* TAB 2: GESTIONE LICENZE */}
        {activeTab === "licenze" && (
          <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Gestione Licenze Acquistate</h2>
              <p className="text-xs text-neutral-400">
                Solo gli utenti con una licenza attiva possono creare nuove leghe (fino al numero massimo acquistato).
              </p>
            </div>

            <form onSubmit={salvaLicenza} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Email Cliente / Admin</label>
                <input
                  type="email"
                  required
                  value={licEmail}
                  onChange={(e) => setLicEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Max Leghe Consentite</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={licMaxLeghe}
                  onChange={(e) => setLicMaxLeghe(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-sm text-white font-bold text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Stagione / Note</label>
                <input
                  type="text"
                  value={licNote}
                  onChange={(e) => setLicNote(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div className="md:col-span-4">
                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase py-3 rounded-xl text-xs tracking-wider"
                >
                  Attiva / Aggiorna Licenza
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-950 text-neutral-500 uppercase">
                  <tr>
                    <th className="p-3">Email Admin</th>
                    <th className="p-3 text-center">Leghe Consentite</th>
                    <th className="p-3">Stagione / Note</th>
                    <th className="p-3 text-center">Stato</th>
                    <th className="p-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {listaLicenze.map(([chiave, lic]: [string, any]) => (
                    <tr key={chiave}>
                      <td className="p-3 font-bold text-white">{lic.email}</td>
                      <td className="p-3 text-center font-black text-amber-400 text-sm">{lic.maxLeghe}</td>
                      <td className="p-3 text-neutral-400">{lic.note}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            lic.attiva ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {lic.attiva ? "Attiva" : "Sospesa"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => toggleStatoLicenza(chiave, lic.attiva)}
                          className="bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded text-xs font-bold"
                        >
                          {lic.attiva ? "Sospendi" : "Riattiva"}
                        </button>
                        <button
                          onClick={() => eliminaLicenza(chiave)}
                          className="bg-red-950 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-1 rounded text-xs font-bold"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 3: LISTONI */}
        {activeTab === "listoni" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-4">
              <h2 className="text-xl font-bold text-white">Listone Modalità CLASSIC</h2>
              <div className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center bg-neutral-950/50">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  disabled={loadingClassic}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importaExcelListone(f, "classic");
                  }}
                  className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
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
              <div className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center bg-neutral-950/50">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  disabled={loadingMantra}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importaExcelListone(f, "mantra");
                  }}
                  className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white cursor-pointer"
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

        {/* TAB 4: TICKET SUPPORTO */}
        {activeTab === "ticket" && (
          <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Segnalazioni & Richieste Supporto ({tickets.length})</h2>
            <div className="divide-y divide-neutral-800">
              {tickets.length === 0 ? (
                <p className="py-8 text-center text-neutral-500 italic text-sm">Nessuna segnalazione ricevuta.</p>
              ) : (
                tickets.map((t) => (
                  <div key={t.id} className="py-4 flex flex-col sm:flex-row justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded">
                          {t.categoria}
                        </span>
                        <span className="text-xs font-bold text-white">{t.utenteEmail}</span>
                        <span className="text-[11px] text-neutral-500">
                          • {new Date(t.createdAt).toLocaleString("it-IT")}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-300">{t.messaggio}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          update(ref(db, `impostazioni_globali/ticket_supporto/${t.id}`), {
                            stato: t.stato === "risolto" ? "aperto" : "risolto",
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          t.stato === "risolto"
                            ? "bg-emerald-600/20 text-emerald-400"
                            : "bg-amber-500 text-neutral-950"
                        }`}
                      >
                        {t.stato === "risolto" ? "✓ Risolto" : "Segna Risolto"}
                      </button>
                      <button
                        onClick={() => remove(ref(db, `impostazioni_globali/ticket_supporto/${t.id}`))}
                        className="bg-red-950 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* TAB 5: LOG */}
        {activeTab === "logs" && (
          <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-lg font-bold text-white">Registro Operazioni Aste & Riparazioni</h2>
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
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 px-4 py-2 rounded-lg text-xs font-black uppercase"
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
                  {tuttiILog.map((log, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-mono text-neutral-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("it-IT")}
                      </td>
                      <td className="p-3 font-bold text-white">{log.nomeLega}</td>
                      <td className="p-3 text-blue-400">{log.fase || "Prima Asta"}</td>
                      <td className="p-3 font-bold text-amber-400">{log.azione}</td>
                      <td className="p-3">{log.dettaglio}</td>
                      <td className="p-3 text-neutral-400">{log.autore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* MODAL GESTIONE UTENTI, FASI DI ACCESSO E RESET PASSWORD TEMPORANEA */}
      {selectedLegaForUsers && (
        <div
          onClick={() => setSelectedLegaForUsers(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="bg-neutral-800 p-4 flex justify-between items-center border-b border-neutral-700">
              <h3 className="text-lg font-black text-white">
                Gestione Utenti & Accessi • <span className="text-amber-400">{selectedLegaForUsers.nomeLega}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLegaForUsers(null)}
                className="bg-neutral-950 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-5 flex-1">
              {tempPasswordBox && (
                <div className="bg-amber-950/60 border border-amber-500 rounded-xl p-4 space-y-2 text-xs">
                  <div className="font-black text-amber-300 uppercase">
                    🔐 Password Temporanea Generata per {tempPasswordBox.email}
                  </div>
                  <p className="text-neutral-200">
                    Password temporanea: <strong className="font-mono text-base text-white bg-black/40 px-2 py-0.5 rounded">{tempPasswordBox.tempPassword}</strong>
                  </p>
                  <p className="text-neutral-300">
                    {tempPasswordBox.emailInviata
                      ? "✅ Email inviata automaticamente al partecipante con obbligo di cambio al primo accesso."
                      : "⚠️ Copia questa password temporanea e inviala al partecipante (oppure usa il link di reset Firebase già spedito alla sua casella). Al primo accesso sarà obbligato a cambiarla."}
                  </p>
                </div>
              )}

              <form onSubmit={sostituisciAdminLega} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                <label className="block text-[10px] font-black uppercase text-amber-400">
                  Admin Fondatore della Lega (Sostituisci Email Admin)
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={nuovoAdminEmail}
                    onChange={(e) => setNuovoAdminEmail(e.target.value)}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black px-4 py-2 rounded-lg text-xs uppercase"
                  >
                    Aggiorna Admin
                  </button>
                </div>
              </form>

              <div className="divide-y divide-neutral-800">
                {(selectedLegaForUsers.squadre ? Object.values(selectedLegaForUsers.squadre) : []).map((sq: any) => {
                  const mailSalvata = (sq.emailProprietario || "").trim().toLowerCase();
                  const mailInput = slotEmailsDraft[sq.id] ?? mailSalvata;
                  const coAdmins: string[] = Array.isArray(selectedLegaForUsers.coAdmins)
                    ? selectedLegaForUsers.coAdmins.map((m: string) => m.toLowerCase())
                    : [];
                  const isCoAdmin = mailSalvata && coAdmins.includes(mailSalvata);
                  const isOnlineOra = Boolean(selectedLegaForUsers.presenzeAsta?.[`squadra_${sq.id}`]);

                  // Fase di accesso partecipante
                  const faseBadge = !mailSalvata
                    ? { label: "Slot Libero", cls: "bg-neutral-800 text-neutral-400" }
                    : isOnlineOra
                    ? { label: "● Online Ora", cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" }
                    : sq.ultimoAccesso || sq.statoInvito === "attivo"
                    ? { label: "✓ Registrato", cls: "bg-sky-500/20 text-sky-300 border border-sky-500/40" }
                    : { label: "✉ Invitato (In attesa)", cls: "bg-amber-500/20 text-amber-300 border border-amber-500/40" };

                  return (
                    <div key={sq.id} className="py-3.5 space-y-2">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            Slot #{sq.id + 1}: {sq.nome}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${faseBadge.cls}`}>
                            {faseBadge.label}
                          </span>
                        </div>

                        {mailSalvata && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold uppercase">
                            {isCoAdmin ? "Admin + Giocatore" : "Solo Giocatore"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={mailInput}
                          onChange={(e) => setSlotEmailsDraft((prev) => ({ ...prev, [sq.id]: e.target.value }))}
                          placeholder="Inserisci o sostituisci email partecipante..."
                          className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => salvaEInvitaPartecipanteSlot(selectedLegaForUsers, sq, false)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold"
                          >
                            Salva
                          </button>
                          <button
                            type="button"
                            onClick={() => salvaEInvitaPartecipanteSlot(selectedLegaForUsers, sq, true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-black uppercase"
                          >
                            Invita
                          </button>
                          {mailSalvata && (
                            <>
                              <button
                                type="button"
                                onClick={() => generaPasswordTemporaneaUtente(selectedLegaForUsers, mailSalvata)}
                                className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 px-2.5 py-2 rounded-lg text-xs font-bold"
                                title="Invia password temporanea con obbligo cambio"
                              >
                                Reset Pwd
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCoAdminSquadra(selectedLegaForUsers, sq)}
                                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2.5 py-2 rounded-lg text-xs font-bold"
                              >
                                {isCoAdmin ? "Togli Admin" : "+ Admin"}
                              </button>
                              <button
                                type="button"
                                onClick={() => rimuoviPartecipanteDaSquadra(selectedLegaForUsers.id, sq.id)}
                                className="bg-red-950 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-2 rounded-lg text-xs font-bold"
                              >
                                Rimuovi
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-neutral-950 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedLegaForUsers(null)}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
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