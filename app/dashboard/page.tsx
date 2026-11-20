"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue, update, set, onDisconnect } from "firebase/database";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { sanitizeImageUrl, sanitizeText } from "../../lib/security";
import ThemeToggle from "../../components/ThemeToggle";
import SupportModal from "../../components/SupportModal";

const SUPER_ADMIN_EMAIL = "fantaricccio@gmail.com";

export default function DashboardLega() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [legaId, setLegaId] = useState<string | null>(null);
  const [lega, setLega] = useState<any>(null);
  const [squadre, setSquadre] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [onlineSquadreIds, setOnlineSquadreIds] = useState<number[]>([]);
  const [filtroSquadraId, setFiltroSquadraId] = useState<string>("TUTTE");
  const [brokenLogos, setBrokenLogos] = useState<Record<number, boolean>>({});

  // Modal Modifica Squadra (Admin su tutte, Partecipante SOLO sulla propria)
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editNome, setEditNome] = useState("");
  const [editAllenatore, setEditAllenatore] = useState("");
  const [editEmailProprietario, setEditEmailProprietario] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [logoErrorMsg, setLogoErrorMsg] = useState("");

  // Modal Albo d'Oro Storico
  const [showAlboDoro, setShowAlboDoro] = useState(false);
  const [alboStagione, setAlboStagione] = useState("2025/2026");
  const [alboPrimo, setAlboPrimo] = useState("");
  const [alboSecondo, setAlboSecondo] = useState("");
  const [alboTerzo, setAlboTerzo] = useState("");

  // Modal Impostazioni Asta
  const [showSettings, setShowSettings] = useState(false);
  const [astaModalita, setAstaModalita] = useState("manuale");
  const [astaChiamata, setAstaChiamata] = useState("libera");
  const [astaRuoloAttivo, setAstaRuoloAttivo] = useState("TUTTI");
  const [astaTimerSecondi, setAstaTimerSecondi] = useState("5");
  const [resetInCorso, setResetInCorso] = useState(false);

  // Modal Invito
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [messaggioCopiato, setMessaggioCopiato] = useState(false);
  const [inviteEmailDest, setInviteEmailDest] = useState("");
  const [invioEmailInCorso, setInvioEmailInCorso] = useState(false);

  // Gestione Sessioni Riparazione & Svincoli
  const [showRiparazioneManager, setShowRiparazioneManager] = useState(false);
  const [modalitaSvincoliAdmin, setModalitaSvincoliAdmin] = useState(false);
  const [svincoloTarget, setSvincoloTarget] = useState<{ squadra: any; calciatore: any; ruolo: string } | null>(null);
  const [tipoSvincolo, setTipoSvincolo] = useState<"volontario" | "cessione">("volontario");
  const [salvandoSvincolo, setSalvandoSvincolo] = useState(false);

  const [nomeNuovaRip, setNomeNuovaRip] = useState("Riparazione 1");
  const [ripMaxCambiTot, setRipMaxCambiTot] = useState("5");
  const [ripMaxP, setRipMaxP] = useState("");
  const [ripMaxD, setRipMaxD] = useState("");
  const [ripMaxC, setRipMaxC] = useState("");
  const [ripMaxA, setRipMaxA] = useState("");
  const [ripPercVolontario, setRipPercVolontario] = useState("50");
  const [ripPercAsterisco, setRipPercAsterisco] = useState("100");
  const [ripBloccoEx, setRipBloccoEx] = useState<"nessuno" | "questa_riparazione" | "permanente">("questa_riparazione");
  const [ripChiSvincola, setRipChiSvincola] = useState<"admin" | "partecipanti">("admin");
  const [ripDurataMinuti, setRipDurataMinuti] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      router.push("/");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("lega");
    const id = idFromUrl || localStorage.getItem("legaAttualeId");

    if (!id) {
      router.push("/");
      return;
    }

    localStorage.setItem("legaAttualeId", id);
    setLegaId(id);

    const legaRef = ref(db, "leghe/" + id);
    const unsubscribe = onValue(
      legaRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setLega(data);
          if (data.squadre) {
            const squadreArray = Object.values(data.squadre).sort((a: any, b: any) => a.id - b.id);
            setSquadre(squadreArray);
          }
          if (data.impostazioniAsta) {
            setAstaModalita(data.impostazioniAsta.modalita || "manuale");
            setAstaChiamata(data.impostazioniAsta.chiamata || "libera");
            setAstaRuoloAttivo(data.impostazioniAsta.ruoloAttivo || "TUTTI");
            setAstaTimerSecondi(String(data.impostazioniAsta.timerSecondi || "5"));
          }
          const numRip = (data.sessioniRiparazione || []).length;
          setNomeNuovaRip(`Riparazione ${numRip + 1}`);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Errore lettura Firebase:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, router]);

  const isMantra = lega?.modalita === "mantra";

  const isAdminLega = Boolean(
    user &&
      lega &&
      (user.uid === lega.adminUid ||
        user.email?.toLowerCase() === lega.adminEmail?.toLowerCase() ||
        user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
        (Array.isArray(lega.coAdmins) &&
          lega.coAdmins.map((m: string) => m.toLowerCase()).includes(user.email?.toLowerCase() || "")))
  );

  const miaSquadra = squadre.find(
    (sq) =>
      user?.email &&
      sq.emailProprietario &&
      sq.emailProprietario.toLowerCase().trim() === user.email.toLowerCase().trim()
  );

  useEffect(() => {
    if (!legaId) return;

    if (miaSquadra) {
      const presRef = ref(db, `leghe/${legaId}/presenzeAsta/squadra_${miaSquadra.id}`);
      set(presRef, {
        squadraId: miaSquadra.id,
        nome: miaSquadra.nome,
        online: true,
        dove: "dashboard",
        lastSeen: new Date().toISOString(),
      });
      onDisconnect(presRef).remove();
    }

    const allPresRef = ref(db, `leghe/${legaId}/presenzeAsta`);
    const unsubPres = onValue(allPresRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setOnlineSquadreIds(Object.values(val).map((p: any) => Number(p.squadraId)));
      } else {
        setOnlineSquadreIds([]);
      }
    });

    return () => unsubPres();
  }, [legaId, miaSquadra]);

  // Registra primo accesso del partecipante nella dashboard
  useEffect(() => {
    if (legaId && miaSquadra && !miaSquadra.ultimoAccesso) {
      update(ref(db, `leghe/${legaId}/squadre/squadra_${miaSquadra.id}`), {
        ultimoAccesso: new Date().toISOString(),
        statoInvito: "attivo",
      });
    }
  }, [legaId, miaSquadra]);

  const scriviLog = async (azione: string, dettaglio: string, faseOverride?: string) => {
    if (!legaId) return;
    const logsAttuali = lega?.auditLogs || [];
    const faseCorrente = faseOverride || lega?.faseAttivaNome || "Prima Asta";
    const nuovoLog = {
      timestamp: new Date().toISOString(),
      fase: faseCorrente,
      azione,
      dettaglio,
      autore: user?.email || "Sistema",
    };
    await update(ref(db, `leghe/${legaId}`), {
      auditLogs: [nuovoLog, ...logsAttuali].slice(0, 300),
    });
  };

  // --- ALBO D'ORO STORICO ---
  const alboDoroLista: any[] = lega?.alboDoro || [];

  const aggiungiVoceAlboDoro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legaId || !isAdminLega || !alboPrimo.trim()) return;

    const nuovaVoce = {
      id: `albo_${Date.now()}`,
      stagione: sanitizeText(alboStagione, 30),
      primo: sanitizeText(alboPrimo, 50),
      secondo: sanitizeText(alboSecondo, 50),
      terzo: sanitizeText(alboTerzo, 50),
    };

    await update(ref(db, `leghe/${legaId}`), {
      alboDoro: [nuovaVoce, ...alboDoroLista],
    });

    setAlboPrimo("");
    setAlboSecondo("");
    setAlboTerzo("");
  };

  const eliminaVoceAlboDoro = async (idVoce: string) => {
    if (!legaId || !isAdminLega) return;
    await update(ref(db, `leghe/${legaId}`), {
      alboDoro: alboDoroLista.filter((v) => v.id !== idVoce),
    });
  };

  // --- RESET COMPLETO ---
  const eseguiResetCompletoAsta = async () => {
    if (!legaId || !lega || !isAdminLega) return;

    const conferma1 = confirm(
      `⚠️ ATTENZIONE: Stai per AZZERARE tutti i giocatori assegnati nella lega "${lega.nomeLega}".\n\nTutte le rose torneranno vuote e i crediti verranno riportati al budget iniziale (${lega.budget} crediti). Confermi?`
    );
    if (!conferma1) return;

    setResetInCorso(true);
    try {
      const budgetIniziale = parseInt(lega.budget || "500");
      const slotTotali = isMantra
        ? parseInt(lega.totaleRosaMantra || "26")
        : parseInt(lega.portieri || "3") +
          parseInt(lega.difensori || "8") +
          parseInt(lega.centrocampisti || "8") +
          parseInt(lega.attaccanti || "6");

      const updates: Record<string, any> = {};

      squadre.forEach((sq) => {
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/crediti`] = budgetIniziale;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/giocatoriOccupati`] = 0;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/slotTotali`] = slotTotali;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/rosa`] = isMantra
          ? { POR: [], MOV: [] }
          : { P: [], D: [], C: [], A: [] };
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/cambiPerSessione`] = null;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/giocatoriSvincolati`] = null;
      });

      updates[`leghe/${legaId}/storicoAsta`] = null;
      updates[`leghe/${legaId}/sessioniRiparazione`] = null;
      updates[`leghe/${legaId}/faseAttivaId`] = null;
      updates[`leghe/${legaId}/faseAttivaNome`] = "Prima Asta";
      updates[`leghe/${legaId}/statoAstaOnline`] = null;

      await update(ref(db), updates);
      await scriviLog("RESET COMPLETO ASTA", "Azzerate tutte le rose e ripristinati i budget iniziali", "Prima Asta");

      setShowSettings(false);
      alert("✅ Reset completato!");
    } catch (error) {
      console.error(error);
      alert("❌ Errore durante il reset dell'asta.");
    } finally {
      setResetInCorso(false);
    }
  };

  const scaricaRoseFantacalcioIt = () => {
    if (!lega || squadre.length === 0) return;

    const chiaviReparto = isMantra ? ["POR", "MOV"] : ["P", "D", "C", "A"];
    const righe: string[] = [];

    squadre.forEach((sq) => {
      chiaviReparto.forEach((chiave) => {
        (sq.rosa?.[chiave] || []).forEach((g: any) => {
          righe.push(`${sq.nome};${g.id};${g.prezzoPagato}`);
        });
      });
    });

    if (righe.length === 0) {
      alert("Nessun giocatore assegnato nelle rose da esportare.");
      return;
    }

    const blob = new Blob([righe.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rose_fantacalcio_it_${(lega.nomeLega || "lega").replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- MODIFICA SQUADRA (Admin su tutte; Partecipante SOLO sulla propria) ---
  const salvaModificheSquadra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legaId || !editingTeam) return;

    const eLaMiaSquadra = Boolean(
      user?.email &&
        editingTeam.emailProprietario &&
        editingTeam.emailProprietario.toLowerCase().trim() === user.email.toLowerCase().trim()
    );

    if (!isAdminLega && !eLaMiaSquadra) {
      alert("⛔ Puoi modificare solo la tua squadra!");
      return;
    }

    setLogoErrorMsg("");
    const cleanLogo = sanitizeImageUrl(editLogo);
    if (editLogo.trim() !== "" && !cleanLogo) {
      setLogoErrorMsg("⚠️ URL non valido: inserisci un indirizzo web completo che inizi con https://");
      return;
    }

    setBrokenLogos((prev) => ({ ...prev, [editingTeam.id]: false }));
    const teamRef = ref(db, `leghe/${legaId}/squadre/squadra_${editingTeam.id}`);

    const payload: Record<string, any> = {
      nome: sanitizeText(editNome, 40) || editingTeam.nome,
      allenatore: sanitizeText(editAllenatore, 50),
      logo: cleanLogo,
    };

    if (isAdminLega) {
      payload.emailProprietario = editEmailProprietario.trim().toLowerCase();
    }

    await update(teamRef, payload);
    setEditingTeam(null);
  };

  const salvaImpostazioniAsta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legaId || !isAdminLega) return;

    await update(ref(db, `leghe/${legaId}/impostazioniAsta`), {
      modalita: astaModalita,
      chiamata: astaChiamata,
      ruoloAttivo: astaRuoloAttivo,
      timerSecondi: Math.min(60, Math.max(3, parseInt(astaTimerSecondi) || 5)),
    });

    setShowSettings(false);
  };

  const apriModalEdit = (squadra: any) => {
    setEditingTeam(squadra);
    setEditNome(squadra.nome);
    setEditAllenatore(squadra.allenatore || "");
    setEditEmailProprietario(squadra.emailProprietario || "");
    setEditLogo(squadra.logo || "");
    setLogoErrorMsg("");
  };

  const getInviteUrl = () => {
    if (typeof window === "undefined" || !legaId) return "";
    return `${window.location.origin}/invito/${legaId}`;
  };

  const copiaLinkInvito = async () => {
    const url = getInviteUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiato(true);
      setTimeout(() => setLinkCopiato(false), 3000);
    } catch {
      alert("Copia questo link: " + url);
    }
  };

  const copiaMessaggioInvitoCompleto = async () => {
    const url = getInviteUrl();
    const msg = `Ciao! Sei stato invitato nella lega "${lega?.nomeLega}" su FantaAsta Pro.\nClicca qui per registrarti e scegliere la tua squadra:\n${url}`;
    try {
      await navigator.clipboard.writeText(msg);
      setMessaggioCopiato(true);
      setTimeout(() => setMessaggioCopiato(false), 3000);
    } catch {
      alert(msg);
    }
  };

  const condividiSuWhatsApp = () => {
    const url = getInviteUrl();
    const testo = `⚽ Unisciti alla lega "${lega?.nomeLega}" su FantaAsta Pro! Scegli la tua squadra qui: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(testo)}`, "_blank");
  };

  const inviaInvitoViaEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const dest = inviteEmailDest.trim();
    if (!dest) return;

    const url = getInviteUrl();
    setInvioEmailInCorso(true);
    try {
      const res = await fetch("/api/invita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailDestinatario: dest,
          nomeLega: lega?.nomeLega,
          linkInvito: url,
          mittente: lega?.adminName || user?.email,
        }),
      });
      const data = await res.json();

      if (data.sentViaServer) {
        alert(`✅ Invito inviato via email a ${dest}!`);
      } else {
        const oggetto = `Invito Lega Fantacalcio: ${lega?.nomeLega}`;
        const corpo = `Ciao!\n\nSei stato invitato a partecipare alla lega "${lega?.nomeLega}" su FantaAsta Pro.\n\nClicca sul link qui sotto per registrarti e scegliere la tua squadra:\n${url}\n\nA presto!`;
        window.open(
          `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`,
          "_blank"
        );
      }
      setInviteEmailDest("");
    } finally {
      setInvioEmailInCorso(false);
    }
  };

  // --- RIPARAZIONE & SVINCOLI ---
  const sessioniRiparazione: any[] = lega?.sessioniRiparazione || [];
  const sessioneAttiva = sessioniRiparazione.find((s) => s.attiva);

  const creaEApriSessioneRiparazione = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legaId || !isAdminLega) return;

    const idSessione = `rip_${Date.now()}`;
    const scadenza =
      ripChiSvincola === "partecipanti" && parseInt(ripDurataMinuti) > 0
        ? new Date(Date.now() + parseInt(ripDurataMinuti) * 60 * 1000).toISOString()
        : null;

    const nuovaSessione = {
      id: idSessione,
      nome: sanitizeText(nomeNuovaRip, 40) || `Riparazione ${sessioniRiparazione.length + 1}`,
      attiva: true,
      finestraSvincoliAperta: true,
      chiSvincola: ripChiSvincola,
      scadenzaSvincoli: scadenza,
      maxCambiTotali: Math.max(1, parseInt(ripMaxCambiTot) || 5),
      vincoliReparto: {
        P: ripMaxP !== "" ? parseInt(ripMaxP) : null,
        D: ripMaxD !== "" ? parseInt(ripMaxD) : null,
        C: ripMaxC !== "" ? parseInt(ripMaxC) : null,
        A: ripMaxA !== "" ? parseInt(ripMaxA) : null,
      },
      percVolontario: Math.min(100, Math.max(0, parseInt(ripPercVolontario) || 50)),
      percAsterisco: Math.min(100, Math.max(0, parseInt(ripPercAsterisco) || 100)),
      bloccoExGiocatori: ripBloccoEx,
      creataIl: new Date().toISOString(),
    };

    const aggiornate = sessioniRiparazione.map((s) => ({ ...s, attiva: false, finestraSvincoliAperta: false }));

    await update(ref(db, `leghe/${legaId}`), {
      sessioniRiparazione: [...aggiornate, nuovaSessione],
      faseAttivaId: idSessione,
      faseAttivaNome: nuovaSessione.nome,
    });

    await scriviLog(
      "APERTURA RIPARAZIONE",
      `Avviata "${nuovaSessione.nome}" (Max cambi: ${nuovaSessione.maxCambiTotali}, Svincoli: ${ripChiSvincola})`,
      nuovaSessione.nome
    );

    if (ripChiSvincola === "admin") setModalitaSvincoliAdmin(true);
    setShowRiparazioneManager(false);
  };

  const chiudiFinestraSvincoliSessione = async () => {
    if (!legaId || !sessioneAttiva || !isAdminLega) return;
    const aggiornate = sessioniRiparazione.map((s) =>
      s.id === sessioneAttiva.id ? { ...s, finestraSvincoliAperta: false } : s
    );
    await update(ref(db, `leghe/${legaId}`), {
      sessioniRiparazione: aggiornate,
    });
    setModalitaSvincoliAdmin(false);
    await scriviLog("CHIUSURA SVINCOLI", `Chiusa finestra svincoli per "${sessioneAttiva.nome}"`, sessioneAttiva.nome);
  };

  const finestraPartecipantiAperta = Boolean(
    sessioneAttiva &&
      sessioneAttiva.chiSvincola === "partecipanti" &&
      sessioneAttiva.finestraSvincoliAperta &&
      (!sessioneAttiva.scadenzaSvincoli || new Date(sessioneAttiva.scadenzaSvincoli).getTime() > Date.now())
  );

  const hasAsterisco = (calciatore: any) => {
    return Boolean(calciatore?.esteroAsterisco || String(calciatore?.nome || "").includes("*"));
  };

  const calcolaRimborsoSvincolo = (prezzoPagato: number, tipo: "volontario" | "cessione") => {
    const perc =
      tipo === "volontario"
        ? sessioneAttiva?.percVolontario ?? parseInt(lega?.recuperoVolontario ?? "50")
        : sessioneAttiva?.percAsterisco ?? parseInt(lega?.recuperoCessione ?? "100");

    if (perc <= 0) return 0;
    const calcolato = Math.floor((prezzoPagato * perc) / 100);
    return prezzoPagato > 0 && calcolato < 1 ? 1 : calcolato;
  };

  const apriConfermaSvincolo = (squadra: any, calciatore: any, ruolo: string) => {
    setSvincoloTarget({ squadra, calciatore, ruolo });
    setTipoSvincolo(hasAsterisco(calciatore) ? "cessione" : "volontario");
  };

  const eseguiSvincolo = async () => {
    if (!legaId || !svincoloTarget || salvandoSvincolo) return;

    const { squadra, calciatore, ruolo } = svincoloTarget;
    const isMiaSquadra = Boolean(miaSquadra && miaSquadra.id === squadra.id);
    if (!isAdminLega && !(finestraPartecipantiAperta && isMiaSquadra)) {
      alert("⛔ Non sei autorizzato a svincolare giocatori di questa squadra.");
      return;
    }

    const idSess = sessioneAttiva?.id || "riparazione_generale";
    const nomeSess = sessioneAttiva?.nome || "Riparazione";

    const cambiSessione = squadra.cambiPerSessione?.[idSess] || { P: 0, D: 0, C: 0, A: 0, POR: 0, MOV: 0, totale: 0 };
    const maxTot = sessioneAttiva?.maxCambiTotali ?? parseInt(lega?.maxCambi ?? "5");
    const maxReparto = sessioneAttiva?.vincoliReparto?.[ruolo];

    if (tipoSvincolo === "volontario") {
      if (cambiSessione.totale >= maxTot) {
        alert(`⛔ ${squadra.nome} ha raggiunto il limite massimo di ${maxTot} cambi in "${nomeSess}"!`);
        return;
      }
      if (maxReparto !== null && maxReparto !== undefined && (cambiSessione[ruolo] || 0) >= maxReparto) {
        alert(`⛔ ${squadra.nome} ha raggiunto il limite di ${maxReparto} cambi nel reparto ${ruolo}!`);
        return;
      }
    }

    setSalvandoSvincolo(true);
    try {
      const creditiRecuperati = calcolaRimborsoSvincolo(Number(calciatore.prezzoPagato || 0), tipoSvincolo);
      const rosaAttualeRuolo = squadra.rosa?.[ruolo] || [];
      const nuovaRosaRuolo = rosaAttualeRuolo.filter((g: any) => String(g.id) !== String(calciatore.id));

      const nuoviCambiSessione = {
        ...cambiSessione,
        [ruolo]: (cambiSessione[ruolo] || 0) + (tipoSvincolo === "volontario" ? 1 : 0),
        totale: cambiSessione.totale + (tipoSvincolo === "volontario" ? 1 : 0),
      };

      const svincolatiSquadra: any[] = squadra.giocatoriSvincolati || [];
      const nuovoRecordEx = {
        giocatoreId: String(calciatore.id),
        nome: calciatore.nome,
        sessioneId: idSess,
        regolaBlocco: sessioneAttiva?.bloccoExGiocatori || "questa_riparazione",
      };

      const updates: Record<string, any> = {};
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/crediti`] = squadra.crediti + creditiRecuperati;
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/giocatoriOccupati`] = Math.max(
        0,
        squadra.giocatoriOccupati - 1
      );
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/rosa/${ruolo}`] = nuovaRosaRuolo;
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/cambiPerSessione/${idSess}`] = nuoviCambiSessione;
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/giocatoriSvincolati`] = [
        ...svincolatiSquadra,
        nuovoRecordEx,
      ];

      await update(ref(db), updates);

      await scriviLog(
        "SVINCOLO",
        `${squadra.nome} ha svincolato ${calciatore.nome} (${ruolo}) [${tipoSvincolo === "cessione" ? "Asterisco/Cessione" : "Volontario"}] -> +${creditiRecuperati} cr`,
        nomeSess
      );

      setSvincoloTarget(null);
    } catch (error) {
      console.error(error);
      alert("Errore durante lo svincolo.");
    } finally {
      setSalvandoSvincolo(false);
    }
  };

  const maxPorMantra = parseInt(lega?.portieriMantra || "3");
  const totRosaMantra = parseInt(lega?.totaleRosaMantra || "26");

  const repartiConfig = isMantra
    ? [
        {
          codice: "POR",
          nome: "Portieri (Por)",
          max: maxPorMantra,
          headerBg: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
          badgeBg: "bg-yellow-500 text-slate-950",
        },
        {
          codice: "MOV",
          nome: "Calciatori di Movimento",
          max: Math.max(1, totRosaMantra - maxPorMantra),
          headerBg: "bg-purple-500/15 border-purple-500/30 text-purple-300",
          badgeBg: "bg-purple-500 text-white",
        },
      ]
    : [
        {
          codice: "P",
          nome: "Portieri",
          max: parseInt(lega?.portieri || "3"),
          headerBg: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
          badgeBg: "bg-yellow-500 text-slate-950",
        },
        {
          codice: "D",
          nome: "Difensori",
          max: parseInt(lega?.difensori || "8"),
          headerBg: "bg-green-500/15 border-green-500/30 text-green-400",
          badgeBg: "bg-green-500 text-slate-950",
        },
        {
          codice: "C",
          nome: "Centrocampisti",
          max: parseInt(lega?.centrocampisti || "8"),
          headerBg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
          badgeBg: "bg-blue-500 text-white",
        },
        {
          codice: "A",
          nome: "Attaccanti",
          max: parseInt(lega?.attaccanti || "6"),
          headerBg: "bg-red-500/15 border-red-500/30 text-red-400",
          badgeBg: "bg-red-500 text-white",
        },
      ];

  const getBadgeColorCalciatore = (ruoloStr: string, defaultBg: string) => {
    if (!isMantra) return defaultBg;
    const r = (ruoloStr || "").toLowerCase();
    if (r.startsWith("por")) return "bg-yellow-500 text-slate-950";
    if (r.startsWith("dd") || r.startsWith("ds") || r.startsWith("dc")) return "bg-green-500 text-slate-950";
    if (r.startsWith("e") || r.startsWith("m") || r.startsWith("c")) return "bg-blue-500 text-white";
    if (r.startsWith("w") || r.startsWith("t")) return "bg-purple-500 text-white";
    if (r.startsWith("a") || r.startsWith("pc")) return "bg-red-500 text-white";
    return defaultBg;
  };

  const getOffertaMassima = (squadra: any) => {
    const slotRimanenti = squadra.slotTotali - squadra.giocatoriOccupati;
    if (slotRimanenti <= 0) return 0;
    return squadra.crediti - (slotRimanenti - 1);
  };

  const squadreVisibili =
    filtroSquadraId === "TUTTE"
      ? squadre
      : squadre.filter((s) => String(s.id) === String(filtroSquadraId));

  const slotLiberiCount = squadre.filter((sq) => !sq.emailProprietario || sq.emailProprietario.trim() === "").length;

  if (loading || !authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-amber-400 flex flex-col items-center justify-center font-sans">
        <h2 className="font-bold tracking-widest uppercase">Caricamento Tabellone Rose...</h2>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-2.5 md:p-4 font-sans relative">
      <div className="w-full space-y-3">
        
        {/* HEADER DINAMICO */}
        <header className="flex flex-col xl:flex-row justify-between items-center bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-lg gap-3">
          <div className="flex items-center gap-3 w-full xl:w-auto">
            <button
              onClick={() => router.push("/")}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold transition shrink-0"
            >
              ← Esci
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-black text-amber-400 truncate">
                  {lega?.nomeLega || "Lega Senza Nome"}
                </h1>
                <span className="bg-purple-950 text-purple-300 border border-purple-700/60 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                  {lega?.modalita}
                </span>
                <span className="bg-blue-950 text-blue-300 border border-blue-800/60 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                  {lega?.faseAttivaNome || "Prima Asta"}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider flex flex-wrap items-center gap-x-2">
                <span>Budget: {lega?.budget}</span>
                <span>•</span>
                <span>{squadre.length} Squadre</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                  Online: {onlineSquadreIds.length}/{squadre.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
            <SupportModal nomeLega={lega?.nomeLega} />
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setShowAlboDoro(true)}
              className="bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 px-3 py-2 rounded-lg text-xs font-black uppercase transition"
            >
              🏆 Albo d'Oro
            </button>

            <select
              value={filtroSquadraId}
              onChange={(e) => setFiltroSquadraId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
            >
              <option value="TUTTE">Tutte ({squadre.length})</option>
              {squadre.map((sq) => (
                <option key={sq.id} value={sq.id}>
                  Solo: {sq.nome}
                </option>
              ))}
            </select>

            <button
              onClick={scaricaRoseFantacalcioIt}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition"
            >
              Esporta Fantacalcio.it
            </button>

            {isAdminLega ? (
              <>
                <button
                  onClick={() => setShowRiparazioneManager(true)}
                  className="bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-700/60 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition"
                >
                  Riparazione / Svincoli
                </button>

                <button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5"
                >
                  <span>Invita</span>
                  {slotLiberiCount > 0 && (
                    <span className="bg-emerald-500 text-slate-950 text-[10px] px-1.5 rounded-full font-black">
                      {slotLiberiCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => router.push("/asta")}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider shadow-lg transition"
                >
                  {astaModalita === "online" ? "Sala Asta Online" : "Avvia Asta Live"}
                </button>

                <button
                  onClick={() => setShowSettings(true)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition"
                >
                  Impostazioni
                </button>
              </>
            ) : (
              astaModalita === "online" &&
              miaSquadra && (
                <button
                  onClick={() => router.push("/asta")}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider shadow-lg transition animate-pulse"
                >
                  Entra in Sala Asta ({miaSquadra.nome})
                </button>
              )
            )}
          </div>
        </header>

        {/* BANNER SVINCOLI ATTIVI */}
        {(modalitaSvincoliAdmin && isAdminLega) || finestraPartecipantiAperta ? (
          <div className="bg-rose-950/80 border border-rose-600/70 rounded-xl px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
            <div className="text-rose-100">
              <strong>Sessione Svincoli Aperta ({sessioneAttiva?.nome}):</strong>{" "}
              {modalitaSvincoliAdmin && isAdminLega
                ? "Clicca sul tasto Taglia accanto a un calciatore per svincolarlo."
                : "Puoi svincolare in autonomia i calciatori della tua squadra."}
              {sessioneAttiva?.scadenzaSvincoli && (
                <strong className="ml-2 text-amber-300">
                  Scadenza: {new Date(sessioneAttiva.scadenzaSvincoli).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </strong>
              )}
            </div>
            {isAdminLega && (
              <button
                onClick={chiudiFinestraSvincoliSessione}
                className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg font-black uppercase text-[11px] shrink-0"
              >
                Chiudi Svincoli
              </button>
            )}
          </div>
        ) : null}

        {/* TABELLONE ROSE: AFFIANCATO IN ORIZZONTALE SU PC E CELLULARE */}
        <div
          className={`flex flex-row flex-nowrap gap-2.5 overflow-x-auto pb-3 ${
            squadreVisibili.length === 1 ? "justify-center" : ""
          }`}
        >
          {squadreVisibili.map((squadra) => {
            const mancantiTotali = Math.max(0, squadra.slotTotali - squadra.giocatoriOccupati);
            const maxOfferta = getOffertaMassima(squadra);
            const isMia = Boolean(miaSquadra && miaSquadra.id === squadra.id);
            const isOnline = onlineSquadreIds.includes(Number(squadra.id));
            const puoModificareQuestaSquadra = isAdminLega || isMia;
            const puoSvincolareQuestaSquadra =
              (modalitaSvincoliAdmin && isAdminLega) || (finestraPartecipantiAperta && isMia);
            const safeLogoUrl = sanitizeImageUrl(squadra.logo);

            return (
              <div
                key={squadra.id}
                className={`bg-slate-900 rounded-xl border shadow-xl flex flex-col overflow-hidden ${
                  puoSvincolareQuestaSquadra
                    ? "border-rose-500/60"
                    : isMia
                    ? "border-amber-500/60"
                    : "border-slate-800"
                } ${squadreVisibili.length === 1 ? "w-full max-w-md" : "min-w-[235px] flex-1"}`}
              >
                <div className="bg-slate-800/90 p-2.5 border-b border-slate-700">
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="relative shrink-0"
                        title={
                          isOnline
                            ? "Online ora"
                            : !squadra.emailProprietario
                            ? "Slot libero"
                            : squadra.ultimoAccesso || squadra.statoInvito === "attivo"
                            ? "Registrato"
                            : "Invitato"
                        }
                      >
                        {safeLogoUrl && !brokenLogos[squadra.id] ? (
                          <img
                            src={safeLogoUrl}
                            alt={squadra.nome}
                            onError={() => setBrokenLogos((prev) => ({ ...prev, [squadra.id]: true }))}
                            className="w-8 h-8 rounded-full object-cover border border-slate-600 bg-white"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 text-xs font-black text-slate-300">
                            {squadra.nome?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${
                            isOnline
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse"
                              : !squadra.emailProprietario
                              ? "bg-slate-500"
                              : squadra.ultimoAccesso || squadra.statoInvito === "attivo"
                              ? "bg-sky-400"
                              : "bg-amber-400"
                          }`}
                        ></span>
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xs md:text-sm font-black text-white truncate leading-tight" title={squadra.nome}>
                          {squadra.nome}
                        </h2>
                        <p className="text-[10px] text-slate-400 truncate">
                          {isOnline ? (
                            <span className="text-emerald-400 font-bold">● Online</span>
                          ) : !squadra.emailProprietario ? (
                            <span className="text-slate-500">Slot Libero</span>
                          ) : squadra.ultimoAccesso || squadra.statoInvito === "attivo" ? (
                            <span className="text-sky-400 font-semibold">✓ Registrato</span>
                          ) : (
                            <span className="text-amber-400 font-semibold">✉ Invitato</span>
                          )}
                          {squadra.allenatore ? ` • ${squadra.allenatore}` : ""}
                        </p>
                      </div>
                    </div>

                    {puoModificareQuestaSquadra && (
                      <button
                        onClick={() => apriModalEdit(squadra)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white px-2 py-1 rounded-md border border-slate-600 text-[10px] font-bold transition shrink-0"
                        title={isAdminLega ? "Configura Squadra" : "Modifica il nome della tua squadra"}
                      >
                        Modifica
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-slate-950/80 py-1 px-1 rounded border border-slate-700/70">
                      <div className="text-[8px] uppercase text-slate-400 font-bold">Crediti</div>
                      <div className="text-xs font-black text-amber-400">{squadra.crediti}</div>
                    </div>
                    <div className="bg-slate-950/80 py-1 px-1 rounded border border-slate-700/70">
                      <div className="text-[8px] uppercase text-slate-400 font-bold">Max Off.</div>
                      <div className="text-xs font-black text-emerald-400">{maxOfferta}</div>
                    </div>
                    <div className="bg-slate-950/80 py-1 px-1 rounded border border-slate-700/70">
                      <div className="text-[8px] uppercase text-slate-400 font-bold">
                        {mancantiTotali === 0 ? "Completa" : `Mancano ${mancantiTotali}`}
                      </div>
                      <div className="text-xs font-black text-white">
                        {squadra.giocatoriOccupati}/{squadra.slotTotali}
                      </div>
                    </div>
                  </div>

                  {sessioniRiparazione.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sessioniRiparazione.map((sess) => {
                        const usati = squadra.cambiPerSessione?.[sess.id]?.totale || 0;
                        return (
                          <span
                            key={sess.id}
                            className="bg-slate-950 border border-slate-700/80 text-[9px] font-bold px-1.5 py-0.5 rounded text-sky-300"
                          >
                            {sess.nome}: {usati}/{sess.maxCambiTotali}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-1.5 space-y-2 flex-1 bg-slate-900">
                  {repartiConfig.map((rep) => {
                    const giocatoriPresi = squadra.rosa?.[rep.codice] || [];
                    const spesoReparto = giocatoriPresi.reduce(
                      (acc: number, g: any) => acc + Math.max(0, Number(g.prezzoPagato || 0)),
                      0
                    );

                    return (
                      <div key={rep.codice} className="rounded-lg border border-slate-800 overflow-hidden">
                        <div
                          className={`px-2 py-0.5 border-b text-[10px] font-black uppercase tracking-wider flex justify-between items-center ${rep.headerBg}`}
                        >
                          <span>
                            {rep.nome} ({giocatoriPresi.length}/{rep.max})
                          </span>
                          {spesoReparto > 0 && (
                            <span className="text-[9px] font-mono font-bold">Speso: {spesoReparto}</span>
                          )}
                        </div>

                        <div className="divide-y divide-slate-800/70 bg-slate-950/40">
                          {Array.from({ length: rep.max }).map((_, slotIdx) => {
                            const calciatore = giocatoriPresi[slotIdx];
                            const ruoloCalciatore = calciatore?.ruolo || rep.codice;
                            const badgeStyle = calciatore
                              ? getBadgeColorCalciatore(ruoloCalciatore, rep.badgeBg)
                              : rep.badgeBg;

                            return (
                              <div
                                key={slotIdx}
                                className="px-2 py-1 text-[11px] flex items-center justify-between gap-1 min-h-[26px]"
                              >
                                {calciatore ? (
                                  <>
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span
                                        className={`px-1 h-4 rounded text-[8px] font-black flex items-center justify-center shrink-0 ${badgeStyle}`}
                                      >
                                        {ruoloCalciatore}
                                      </span>
                                      <span className="font-bold text-white truncate" title={calciatore.nome}>
                                        {calciatore.nome}
                                      </span>
                                      <span className="text-[9px] text-slate-500 uppercase shrink-0">
                                        {calciatore.squadraSerieA?.slice(0, 3)}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="font-mono font-black text-amber-400 text-[11px]">
                                        {calciatore.prezzoPagato}
                                      </span>

                                      {puoSvincolareQuestaSquadra && (
                                        <button
                                          type="button"
                                          onClick={() => apriConfermaSvincolo(squadra, calciatore, rep.codice)}
                                          className="bg-rose-600 hover:bg-rose-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase transition"
                                        >
                                          Taglia
                                        </button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1 text-slate-600">
                                      <span className="w-3.5 text-[9px] font-mono text-right">{slotIdx + 1}.</span>
                                      <span className="italic text-[10px]">---</span>
                                    </div>
                                    <span className="text-slate-700 font-mono text-[10px]">-</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: CONFIGURAZIONE SQUADRA */}
      {editingTeam && (
        <div
          onClick={() => setEditingTeam(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md overflow-hidden"
          >
            <div className="bg-slate-700 p-4 flex justify-between items-center border-b border-slate-600">
              <h3 className="text-lg font-bold text-white">
                {isAdminLega ? "Configura Squadra" : "Personalizza la Tua Squadra"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="bg-slate-800 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition"
              >
                ✕ Chiudi
              </button>
            </div>

            <form onSubmit={salvaModificheSquadra} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Squadra</label>
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Allenatore/i</label>
                <input
                  type="text"
                  value={editAllenatore}
                  onChange={(e) => setEditAllenatore(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                />
              </div>

              {isAdminLega && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Partecipante</label>
                  <input
                    type="email"
                    value={editEmailProprietario}
                    onChange={(e) => setEditEmailProprietario(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Link Diretto Immagine Logo</label>
                <input
                  type="url"
                  value={editLogo}
                  onChange={(e) => {
                    setEditLogo(e.target.value);
                    setLogoErrorMsg("");
                  }}
                  placeholder="https://esempio.com/logo.png"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm"
                />
                {logoErrorMsg && <p className="text-xs text-red-400 font-bold mt-1">{logoErrorMsg}</p>}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg"
                >
                  Salva Dati
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALBO D'ORO STORICO */}
      {showAlboDoro && (
        <div
          onClick={() => setShowAlboDoro(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-amber-500/40 w-full max-w-lg overflow-hidden max-h-[88vh] flex flex-col"
          >
            <div className="bg-gradient-to-r from-amber-600 to-yellow-700 p-4 flex justify-between items-center">
              <h3 className="text-lg font-black text-white">🏆 Albo d'Oro • {lega?.nomeLega}</h3>
              <button
                type="button"
                onClick={() => setShowAlboDoro(false)}
                className="bg-black/30 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {isAdminLega && (
                <form onSubmit={aggiungiVoceAlboDoro} className="bg-slate-950 p-4 rounded-xl border border-slate-700 space-y-3">
                  <div className="text-[10px] font-black uppercase text-amber-400">Registra Podio Stagione</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={alboStagione}
                      onChange={(e) => setAlboStagione(e.target.value)}
                      placeholder="Stagione (es. 2025/2026)"
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                    />
                    <input
                      type="text"
                      required
                      value={alboPrimo}
                      onChange={(e) => setAlboPrimo(e.target.value)}
                      placeholder="🥇 1° Classificato"
                      className="bg-slate-900 border border-amber-500/50 rounded-lg p-2 text-xs text-white font-bold"
                    />
                    <input
                      type="text"
                      value={alboSecondo}
                      onChange={(e) => setAlboSecondo(e.target.value)}
                      placeholder="🥈 2° Classificato"
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={alboTerzo}
                      onChange={(e) => setAlboTerzo(e.target.value)}
                      placeholder="🥉 3° Classificato"
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase py-2.5 rounded-lg text-xs"
                  >
                    Aggiungi all'Albo d'Oro
                  </button>
                </form>
              )}

              <div className="space-y-2.5">
                {alboDoroLista.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">
                    Nessuna stagione registrata nell'Albo d'Oro di questa lega.
                  </p>
                ) : (
                  alboDoroLista.map((voce) => (
                    <div
                      key={voce.id}
                      className="bg-slate-950 border border-slate-700 rounded-xl p-3.5 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-xs font-black uppercase text-amber-400">{voce.stagione}</div>
                        <div className="text-sm font-black text-white mt-0.5">🥇 {voce.primo}</div>
                        {(voce.secondo || voce.terzo) && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {voce.secondo && <span className="mr-3">🥈 {voce.secondo}</span>}
                            {voce.terzo && <span>🥉 {voce.terzo}</span>}
                          </div>
                        )}
                      </div>
                      {isAdminLega && (
                        <button
                          type="button"
                          onClick={() => eliminaVoceAlboDoro(voce.id)}
                          className="bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-1 rounded text-xs font-bold"
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPOSTAZIONI REGIA ASTA + RESET */}
      {showSettings && isAdminLega && (
        <div
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            <div className="bg-slate-700 p-4 flex justify-between items-center border-b border-slate-600">
              <h3 className="text-lg font-bold text-white">Impostazioni Asta</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="bg-slate-800 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition"
              >
                ✕ Chiudi
              </button>
            </div>

            <form onSubmit={salvaImpostazioniAsta} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Modalità Svolgimento</label>
                <select
                  value={astaModalita}
                  onChange={(e) => setAstaModalita(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-semibold"
                >
                  <option value="manuale">In Presenza / Manuale (Solo Admin assegna)</option>
                  <option value="online">Online a Distanza (Turni Poker e rilanci live)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipologia Chiamata Giocatori</label>
                <select
                  value={astaChiamata}
                  onChange={(e) => setAstaChiamata(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-semibold"
                >
                  <option value="libera">Lista Calciatori (Chiamata Libera / Turni Poker)</option>
                  <option value="random">Estrazione Random dal Listone</option>
                  <option value="alfabetica">Ordine Alfabetico (A → Z)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ruoli Consentiti</label>
                  <select
                    value={astaRuoloAttivo}
                    onChange={(e) => setAstaRuoloAttivo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-semibold"
                  >
                    <option value="TUTTI">Tutti i Ruoli</option>
                    {isMantra ? (
                      <>
                        <option value="Por">Solo Portieri (Por)</option>
                        <option value="Dd">Solo Dd</option>
                        <option value="Ds">Solo Ds</option>
                        <option value="Dc">Solo Dc</option>
                        <option value="E">Solo E</option>
                        <option value="M">Solo M</option>
                        <option value="C">Solo C</option>
                        <option value="W">Solo W</option>
                        <option value="T">Solo T</option>
                        <option value="A">Solo A</option>
                        <option value="Pc">Solo Pc</option>
                      </>
                    ) : (
                      <>
                        <option value="P">Solo Portieri (P)</option>
                        <option value="D">Solo Difensori (D)</option>
                        <option value="C">Solo Centrocampisti (C)</option>
                        <option value="A">Solo Attaccanti (A)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Timer Rilancio (Sec)</label>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    value={astaTimerSecondi}
                    onChange={(e) => setAstaTimerSecondi(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg"
                >
                  Salva Regole
                </button>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-700 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-rose-400">Zona Reset Asta</div>
                <button
                  type="button"
                  disabled={resetInCorso}
                  onClick={eseguiResetCompletoAsta}
                  className="w-full bg-rose-950/70 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-700/70 font-black uppercase text-xs py-3 rounded-xl transition"
                >
                  {resetInCorso ? "Azzeramento..." : "Reset Completo Giocatori Assegnati"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: INVITO PARTECIPANTI */}
      {showInviteModal && isAdminLega && (
        <div
          onClick={() => setShowInviteModal(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 flex justify-between items-center">
              <h3 className="text-lg font-black text-white">Invita Partecipanti</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="bg-black/30 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Scegli come invitare i fantallenatori nella lega (<strong className="text-amber-400">{slotLiberiCount} slot liberi</strong>):
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">1. Copia Link Diretto</label>
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getInviteUrl()}
                    className="bg-transparent text-xs text-slate-300 font-mono w-full focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copiaLinkInvito}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase shrink-0 transition ${
                      linkCopiato ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {linkCopiato ? "✓ Copiato" : "Copia Link"}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">2. Condivisione Rapida WhatsApp</label>
                <button
                  type="button"
                  onClick={condividiSuWhatsApp}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black py-3 rounded-xl shadow-lg transition text-xs uppercase tracking-wider"
                >
                  Invia Invito su WhatsApp
                </button>
              </div>

              <form onSubmit={inviaInvitoViaEmail} className="space-y-2 pt-2 border-t border-slate-700">
                <label className="text-[10px] font-black uppercase text-slate-400">3. Invia Invito via Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={inviteEmailDest}
                    onChange={(e) => setInviteEmailDest(e.target.value)}
                    placeholder="email.amico@gmail.com"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={invioEmailInCorso}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase transition shrink-0"
                  >
                    {invioEmailInCorso ? "Invio..." : "Invia Email"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={copiaMessaggioInvitoCompleto}
                  className="w-full bg-slate-900 hover:bg-slate-950 border border-slate-700 text-slate-300 font-bold py-2 rounded-lg text-[11px] transition"
                >
                  {messaggioCopiato ? "✓ Testo invito copiato!" : "Oppure copia testo invito negli appunti"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider"
              >
                Torna al Tabellone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RIPARAZIONE & SVINCOLI */}
      {showRiparazioneManager && isAdminLega && (
        <div
          onClick={() => setShowRiparazioneManager(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-xl overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-rose-700 to-red-800 p-4 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-lg font-black text-white">Gestione Riparazione & Svincoli</h3>
              <button
                type="button"
                onClick={() => setShowRiparazioneManager(false)}
                className="bg-black/30 hover:bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-6 space-y-6">
              {sessioneAttiva && (
                <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-amber-400">Sessione Attiva</div>
                      <div className="text-base font-black text-white">{sessioneAttiva.nome}</div>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full font-bold">
                      Max Cambi: {sessioneAttiva.maxCambiTotali}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {sessioneAttiva.chiSvincola === "admin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalitaSvincoliAdmin(!modalitaSvincoliAdmin);
                          setShowRiparazioneManager(false);
                        }}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-lg text-xs font-black uppercase"
                      >
                        {modalitaSvincoliAdmin ? "Disattiva Svincoli Admin" : "Attiva Svincoli Admin sul Tabellone"}
                      </button>
                    )}

                    {sessioneAttiva.finestraSvincoliAperta && (
                      <button
                        type="button"
                        onClick={chiudiFinestraSvincoliSessione}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold uppercase border border-slate-700"
                      >
                        Chiudi Finestra Svincoli
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={creaEApriSessioneRiparazione} className="space-y-4">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider border-b border-slate-700 pb-1">
                  Avvia Nuova Sessione di Riparazione
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Sessione</label>
                    <input
                      type="text"
                      required
                      value={nomeNuovaRip}
                      onChange={(e) => setNomeNuovaRip(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Max Cambi Totali</label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      required
                      value={ripMaxCambiTot}
                      onChange={(e) => setRipMaxCambiTot(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white font-bold text-center"
                    />
                  </div>
                </div>

                {!isMantra && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Vincolo Cambi per Reparto (Vuoto = nessun limite specifico)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Max P", val: ripMaxP, set: setRipMaxP },
                        { label: "Max D", val: ripMaxD, set: setRipMaxD },
                        { label: "Max C", val: ripMaxC, set: setRipMaxC },
                        { label: "Max A", val: ripMaxA, set: setRipMaxA },
                      ].map((r) => (
                        <input
                          key={r.label}
                          type="number"
                          min="0"
                          max="25"
                          placeholder={r.label}
                          value={r.val}
                          onChange={(e) => r.set(e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-center text-xs text-white font-bold"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      % Rimborso Volontario
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={ripPercVolontario}
                      onChange={(e) => setRipPercVolontario(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      % Rimborso con * (Estero)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={ripPercAsterisco}
                      onChange={(e) => setRipPercAsterisco(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Divieto Riacquisto Giocatori Svincolati dalla Stessa Squadra
                  </label>
                  <select
                    value={ripBloccoEx}
                    onChange={(e) => setRipBloccoEx(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-white font-bold"
                  >
                    <option value="questa_riparazione">Sì, vietato SOLO in questa riparazione</option>
                    <option value="permanente">Sì, vietato in questa E nelle successive riparazioni</option>
                    <option value="nessuno">Nessun divieto (può ricomprarlo)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Chi esegue gli svincoli?
                    </label>
                    <select
                      value={ripChiSvincola}
                      onChange={(e) => setRipChiSvincola(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-white font-bold"
                    >
                      <option value="admin">Solo l'Admin (Manuale)</option>
                      <option value="partecipanti">Ogni Partecipante in autonomia</option>
                    </select>
                  </div>

                  {ripChiSvincola === "partecipanti" && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Durata Finestra (Minuti, vuoto = manuale)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Es. 30"
                        value={ripDurataMinuti}
                        onChange={(e) => setRipDurataMinuti(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRiparazioneManager(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl text-xs uppercase"
                  >
                    Annulla / Indietro
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider py-3.5 rounded-xl shadow-lg text-xs"
                  >
                    Avvia Riparazione
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFERMA SVINCOLO */}
      {svincoloTarget && (
        <div
          onClick={() => setSvincoloTarget(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-rose-600/60 w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-rose-700 to-red-800 p-4 flex justify-between items-center">
              <h3 className="text-lg font-black text-white">Conferma Svincolo</h3>
              <button
                type="button"
                onClick={() => setSvincoloTarget(null)}
                className="bg-black/30 hover:bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-4">
                <div className="text-[10px] uppercase font-bold text-slate-400">{svincoloTarget.squadra.nome}</div>
                <div className="text-xl font-black text-white flex items-center gap-2">
                  <span>{svincoloTarget.calciatore.nome}</span>
                  {hasAsterisco(svincoloTarget.calciatore) && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] px-2 py-0.5 rounded font-black">
                      * ESTERO / FUORI LISTA
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Pagato: <strong className="text-amber-400">{svincoloTarget.calciatore.prezzoPagato} cr</strong>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTipoSvincolo("volontario")}
                  className={`w-full p-3 rounded-xl border text-left flex justify-between items-center ${
                    tipoSvincolo === "volontario"
                      ? "bg-rose-950/60 border-rose-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">Svincolo Volontario</div>
                    <div className="text-[10px] opacity-80">Consuma 1 cambio</div>
                  </div>
                  <div className="font-black text-emerald-400">
                    +{calcolaRimborsoSvincolo(Number(svincoloTarget.calciatore.prezzoPagato || 0), "volontario")} cr
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoSvincolo("cessione")}
                  className={`w-full p-3 rounded-xl border text-left flex justify-between items-center ${
                    tipoSvincolo === "cessione"
                      ? "bg-amber-950/50 border-amber-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">Calciatore con * (Estero / Serie Minore)</div>
                    <div className="text-[10px] opacity-80">Non consuma cambi volontari</div>
                  </div>
                  <div className="font-black text-emerald-400">
                    +{calcolaRimborsoSvincolo(Number(svincoloTarget.calciatore.prezzoPagato || 0), "cessione")} cr
                  </div>
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSvincoloTarget(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={salvandoSvincolo}
                  onClick={eseguiSvincolo}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase py-3 rounded-xl"
                >
                  {salvandoSvincolo ? "Salvataggio..." : "Conferma Svincolo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}