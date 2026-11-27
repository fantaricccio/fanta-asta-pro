"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue, update, set, onDisconnect } from "firebase/database";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import ThemeToggle from "../../components/ThemeToggle";

const SUPER_ADMIN_EMAIL = "fantaricccio@gmail.com";
const RUOLI_MANTRA = ["TUTTI", "Por", "Dd", "Ds", "Dc", "E", "M", "C", "W", "T", "A", "Pc"];
const RUOLI_CLASSIC = ["TUTTI", "P", "D", "C", "A"];

export interface WatchlistEntry {
  giocatoreId: string;
  nome: string;
  ruolo: string;
  squadra: string;
  priorita: "top" | "titolare" | "scommessa";
  budgetMax: number;
  nota: string;
  updatedAt: string;
}

export default function SalaAstaLive() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [legaId, setLegaId] = useState<string | null>(null);
  const [lega, setLega] = useState<any>(null);
  const [squadre, setSquadre] = useState<any[]>([]);
  const [listone, setListone] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modalità Proiettore / TV + Audio Timer
  const [modalitaTV, setModalitaTV] = useState(false);
  const [audioAttivo, setAudioAttivo] = useState(true);
  const lastBeepSecRef = useRef<number | null>(null);

  const [tipoChiamata, setTipoChiamata] = useState<"libera" | "random" | "alfabetica">("libera");
  const [filtroRuolo, setFiltroRuolo] = useState("TUTTI");
  const [ricerca, setRicerca] = useState("");

  const [giocatoreSelezionato, setGiocatoreSelezionato] = useState<any>(null);
  const [prezzoAcquisto, setPrezzoAcquisto] = useState<string>("");
  const [erroreAssegnazione, setErroreAssegnazione] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [connessiIds, setConnessiIds] = useState<number[]>([]);
  const [secondiRimasti, setSecondiRimasti] = useState<number>(0);
  const [offertaCustomOnline, setOffertaCustomOnline] = useState<string>("");
  const [timerSetupOnline, setTimerSetupOnline] = useState<string>("5");
  const closingLockRef = useRef<boolean>(false);

  // Watchlist Privata (sincronizzabile anche con la Guida sul portale)
  const [watchlistMap, setWatchlistMap] = useState<Record<string, WatchlistEntry>>({});
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [wlTargetPlayer, setWlTargetPlayer] = useState<any>(null);
  const [wlPriorita, setWlPriorita] = useState<"top" | "titolare" | "scommessa">("top");
  const [wlBudgetMax, setWlBudgetMax] = useState<string>("20");
  const [wlNota, setWlNota] = useState<string>("");
  const [rightSidebarTab, setRightSidebarTab] = useState<"storico" | "watchlist">("storico");

  // Modalità Asta a Busta Chiusa
  const [bustaDurataOre, setBustaDurataOre] = useState<string>("24");
  const [bustaTitolo, setBustaTitolo] = useState<string>("Buste Chiuse Svincolati");
  const [bustaSelectedPlayer, setBustaSelectedPlayer] = useState<any>(null);
  const [bustaOffertaCrediti, setBustaOffertaCrediti] = useState<string>("1");
  const [bustaRicerca, setBustaRicerca] = useState<string>("");
  const [aprendoBuste, setAprendoBuste] = useState(false);

  const playBeep = (freq: number, durationSec: number, type: OscillatorType = "sine") => {
    if (!audioAttivo || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch {
      // Ignora se il browser blocca l'audio prima di un click
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Carica la Watchlist Privata dell'utente loggato (visibile solo a lui)
  useEffect(() => {
    if (!user) {
      setWatchlistMap({});
      return;
    }
    const wlRef = ref(db, `utenti_watchlist/${user.uid}`);
    const unsubWl = onValue(wlRef, (snap) => {
      setWatchlistMap(snap.val() || {});
    });
    return () => unsubWl();
  }, [user]);

  useEffect(() => {
    const id = localStorage.getItem("legaAttualeId");
    if (!id) {
      router.push("/");
      return;
    }
    setLegaId(id);

    const legaRef = ref(db, `leghe/${id}`);
    const unsubLega = onValue(legaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLega(data);
        if (data.squadre) {
          const arr = Object.values(data.squadre).sort((a: any, b: any) => a.id - b.id);
          setSquadre(arr);
        }
        if (data.impostazioniAsta) {
          if (data.impostazioniAsta.chiamata) setTipoChiamata(data.impostazioniAsta.chiamata);
          if (data.impostazioniAsta.ruoloAttivo) setFiltroRuolo(data.impostazioniAsta.ruoloAttivo);
          if (data.impostazioniAsta.timerSecondi) setTimerSetupOnline(String(data.impostazioniAsta.timerSecondi));
        }
      }
      setLoading(false);
    });

    return () => unsubLega();
  }, [router]);

  const isMantra = lega?.modalita === "mantra";

  useEffect(() => {
    if (!lega) return;
    const pathListone = isMantra ? "impostazioni_globali/listone_mantra" : "impostazioni_globali/listone_classic";

    const listoneRef = ref(db, pathListone);
    const unsubListone = onValue(listoneRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.values(data).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        setListone(arr);
      } else {
        setListone([]);
      }
    });

    return () => unsubListone();
  }, [lega, isMantra]);

  const isAdminLega = Boolean(
    user &&
      lega &&
      (user.uid === lega.adminUid ||
        user.email?.toLowerCase() === lega.adminEmail?.toLowerCase() ||
        user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
        (Array.isArray(lega.coAdmins) &&
          lega.coAdmins.map((m: string) => m.toLowerCase()).includes(user.email?.toLowerCase() || "")))
  );

  const miaSquadra = useMemo(() => {
    if (!user?.email) return null;
    const mail = user.email.toLowerCase().trim();
    return squadre.find((sq) => sq.emailProprietario && sq.emailProprietario.toLowerCase().trim() === mail) || null;
  }, [squadre, user]);

  const modalitaSala = lega?.impostazioniAsta?.modalita || "manuale";
  const isModalitaOnline = modalitaSala === "online";
  const isModalitaBuste = modalitaSala === "buste";

  useEffect(() => {
    if (!legaId || !miaSquadra) return;

    const presRef = ref(db, `leghe/${legaId}/presenzeAsta/squadra_${miaSquadra.id}`);
    set(presRef, {
      squadraId: miaSquadra.id,
      nome: miaSquadra.nome,
      online: true,
      dove: "asta",
      lastSeen: new Date().toISOString(),
    });
    onDisconnect(presRef).remove();

    const allPresRef = ref(db, `leghe/${legaId}/presenzeAsta`);
    const unsubPres = onValue(allPresRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setConnessiIds(Object.values(val).map((p: any) => Number(p.squadraId)));
      } else {
        setConnessiIds([]);
      }
    });

    return () => unsubPres();
  }, [legaId, miaSquadra]);

  const idGiocatoriAcquistati = useMemo(() => {
    const acquistati = new Set<string>();
    squadre.forEach((sq) => {
      if (sq.rosa) {
        ["P", "D", "C", "A", "POR", "MOV"].forEach((chiave) => {
          (sq.rosa[chiave] || []).forEach((g: any) => acquistati.add(String(g.id)));
        });
      }
    });
    return acquistati;
  }, [squadre]);

  const getRuoloDisplay = (g: any) => {
    if (isMantra) return g.ruoloMantra || g.ruolo || "MOV";
    return g.ruolo || "C";
  };

  const getChiaveReparto = (g: any) => {
    if (isMantra) {
      const r = (g.ruoloMantra || g.ruolo || "").toLowerCase();
      return r.includes("por") || r === "p" ? "POR" : "MOV";
    }
    return g.ruolo;
  };

  const giocatoriDisponibili = useMemo(() => {
    const ruoloFiltro = isModalitaOnline ? lega?.impostazioniAsta?.ruoloAttivo || "TUTTI" : filtroRuolo;

    return listone
      .filter((g) => {
        if (idGiocatoriAcquistati.has(String(g.id))) return false;
        if (ruoloFiltro !== "TUTTI") {
          if (isMantra) {
            const listaRuoli = (g.ruoloMantra || g.ruolo || "")
              .split(/[;\/,\s]+/)
              .map((x: string) => x.trim().toLowerCase());
            if (!listaRuoli.includes(ruoloFiltro.toLowerCase())) return false;
          } else {
            if (g.ruolo !== ruoloFiltro) return false;
          }
        }
        if (ricerca.trim() !== "") {
          const q = ricerca.toLowerCase();
          return g.nome.toLowerCase().includes(q) || g.squadra.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [listone, idGiocatoriAcquistati, filtroRuolo, ricerca, isModalitaOnline, lega, isMantra]);

  const verificaDivietoExGiocatore = (squadra: any, giocatoreId: string): string | null => {
    const svincolati: any[] = squadra?.giocatoriSvincolati || [];
    if (svincolati.length === 0) return null;

    const sessioni: any[] = lega?.sessioniRiparazione || [];
    const sessioneAttiva = sessioni.find((s) => s.attiva);

    for (const rec of svincolati) {
      if (String(rec.giocatoreId) === String(giocatoreId)) {
        const regola = sessioneAttiva?.bloccoExGiocatori || rec.regolaBlocco || "questa_riparazione";
        if (regola === "permanente") {
          return `⛔ ${squadra.nome} ha già svincolato questo calciatore e il regolamento vieta di riacquistarlo per tutta la stagione!`;
        }
        if (regola === "questa_riparazione" && sessioneAttiva && rec.sessioneId === sessioneAttiva.id) {
          return `⛔ ${squadra.nome} ha svincolato questo calciatore in "${sessioneAttiva.nome}" e non può riacquistarlo in questa sessione!`;
        }
      }
    }
    return null;
  };

  const getMaxSlotChiave = (chiave: string) => {
    if (!lega) return 0;
    if (isMantra) {
      const maxPor = parseInt(lega.portieriMantra || "3");
      const totRosa = parseInt(lega.totaleRosaMantra || "26");
      return chiave === "POR" ? maxPor : Math.max(1, totRosa - maxPor);
    }
    if (chiave === "P") return parseInt(lega.portieri || "3");
    if (chiave === "D") return parseInt(lega.difensori || "8");
    if (chiave === "C") return parseInt(lega.centrocampisti || "8");
    if (chiave === "A") return parseInt(lega.attaccanti || "6");
    return 0;
  };

  const getOffertaMassima = (squadra: any) => {
    const slotRimanentiTotali = squadra.slotTotali - squadra.giocatoriOccupati;
    if (slotRimanentiTotali <= 0) return 0;
    return squadra.crediti - (slotRimanentiTotali - 1);
  };

  const switchModalitaSala = async (nuovaMod: "manuale" | "online" | "buste") => {
    if (!legaId || !isAdminLega) return;
    await update(ref(db, `leghe/${legaId}/impostazioniAsta`), {
      modalita: nuovaMod,
    });
  };

  // =========================================================================
  // WATCHLIST PRIVATA (SOLO UTENTE LOGGATO)
  // =========================================================================
  const apriEditorWatchlist = (giocatore: any) => {
    if (!user) return;
    const existing = watchlistMap[`calc_${giocatore.id}`];
    setWlTargetPlayer(giocatore);
    setWlPriorita(existing?.priorita || "top");
    setWlBudgetMax(String(existing?.budgetMax || Math.max(1, Number(giocatore.quotazioneBase || 10))));
    setWlNota(existing?.nota || "");
    setShowWatchlistModal(true);
  };

  const salvaInWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !wlTargetPlayer) return;

    const entry: WatchlistEntry = {
      giocatoreId: String(wlTargetPlayer.id),
      nome: wlTargetPlayer.nome,
      ruolo: getRuoloDisplay(wlTargetPlayer),
      squadra: wlTargetPlayer.squadra,
      priorita: wlPriorita,
      budgetMax: Math.max(1, parseInt(wlBudgetMax) || 1),
      nota: wlNota.trim(),
      updatedAt: new Date().toISOString(),
    };

    await set(ref(db, `utenti_watchlist/${user.uid}/calc_${wlTargetPlayer.id}`), entry);
    setShowWatchlistModal(false);
    setWlTargetPlayer(null);
  };

  const rimuoviDaWatchlist = async (giocatoreId: string) => {
    if (!user) return;
    await set(ref(db, `utenti_watchlist/${user.uid}/calc_${giocatoreId}`), null);
  };

  const watchlistArray = useMemo(() => {
    const rank = { top: 1, titolare: 2, scommessa: 3 };
    return Object.values(watchlistMap).sort((a, b) => rank[a.priorita] - rank[b.priorita]);
  }, [watchlistMap]);

  // =========================================================================
  // ASTA A BUSTA CHIUSA PER SVINCOLATI
  // =========================================================================
  const sessioneBuste = lega?.busteChiuse || null;
  const mieBusteInviate: any[] =
    sessioneBuste && miaSquadra
      ? Object.values(sessioneBuste.offerte?.[miaSquadra.id] || {})
      : [];

  const avviaSessioneBusteChiuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legaId || !isAdminLega) return;
    const ore = Math.max(1, parseFloat(bustaDurataOre) || 24);
    const scadenza = new Date(Date.now() + ore * 3600 * 1000).toISOString();

    await set(ref(db, `leghe/${legaId}/busteChiuse`), {
      id: `busta_${Date.now()}`,
      titolo: bustaTitolo.trim() || "Buste Chiuse Svincolati",
      aperta: true,
      scadenza,
      creataIl: new Date().toISOString(),
      offerte: null,
      risultatiApertura: null,
    });
  };

  const inviaOffertaInBusta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legaId || !miaSquadra || !sessioneBuste?.aperta || !bustaSelectedPlayer) return;

    const bloccoEx = verificaDivietoExGiocatore(miaSquadra, bustaSelectedPlayer.id);
    if (bloccoEx) {
      alert(bloccoEx);
      return;
    }

    const chiaveRep = getChiaveReparto(bustaSelectedPlayer);
    const occupatiRuolo = (miaSquadra.rosa?.[chiaveRep] || []).length;
    const maxRuolo = getMaxSlotChiave(chiaveRep);
    if (occupatiRuolo >= maxRuolo) {
      alert(`⛔ Hai già completato gli slot ${chiaveRep} (${maxRuolo}/${maxRuolo})!`);
      return;
    }

    const importo = Math.max(1, parseInt(bustaOffertaCrediti) || 1);
    const giaOffertiAltrove = mieBusteInviate
      .filter((b: any) => String(b.giocatoreId) !== String(bustaSelectedPlayer.id))
      .reduce((acc: number, b: any) => acc + Number(b.offerta || 0), 0);

    const maxDisponibile = getOffertaMassima(miaSquadra) - giaOffertiAltrove;
    if (importo > maxDisponibile) {
      alert(`⛔ Crediti insufficienti considerando le altre buste già inviate (Max disponibile: ${Math.max(0, maxDisponibile)} cr).`);
      return;
    }

    await set(
      ref(db, `leghe/${legaId}/busteChiuse/offerte/${miaSquadra.id}/calc_${bustaSelectedPlayer.id}`),
      {
        squadraId: miaSquadra.id,
        squadraNome: miaSquadra.nome,
        giocatoreId: String(bustaSelectedPlayer.id),
        nome: bustaSelectedPlayer.nome,
        ruolo: getRuoloDisplay(bustaSelectedPlayer),
        chiaveReparto: chiaveRep,
        squadraSerieA: bustaSelectedPlayer.squadra,
        offerta: importo,
        timestamp: new Date().toISOString(),
      }
    );

    setBustaSelectedPlayer(null);
    setBustaOffertaCrediti("1");
    setBustaRicerca("");
    alert(`✉️ Busta segreta salvata! Puoi modificarla o ritirarla fino all'apertura.`);
  };

  const ritiraOffertaInBusta = async (giocatoreId: string) => {
    if (!legaId || !miaSquadra || !sessioneBuste?.aperta) return;
    await set(ref(db, `leghe/${legaId}/busteChiuse/offerte/${miaSquadra.id}/calc_${giocatoreId}`), null);
  };

  const apriBusteEAssegna = async () => {
    if (!legaId || !isAdminLega || !sessioneBuste) return;
    if (
      !confirm(
        `🔓 Vuoi CHIUDERE le buste e APRIRE tutte le offerte segrete contemporaneamente?\n\nI calciatori con un unico miglior offerente verranno assegnati automaticamente; eventuali pareggi verranno segnalati per il ballottaggio.`
      )
    ) {
      return;
    }

    setAprendoBuste(true);
    try {
      const offertePerSquadra = sessioneBuste.offerte || {};
      const perCalciatore: Record<string, any[]> = {};

      Object.values(offertePerSquadra).forEach((mappaCalc: any) => {
        Object.values(mappaCalc || {}).forEach((off: any) => {
          if (!perCalciatore[off.giocatoreId]) perCalciatore[off.giocatoreId] = [];
          perCalciatore[off.giocatoreId].push(off);
        });
      });

      const updates: Record<string, any> = {};
      const risultati: any[] = [];
      const faseNome = lega?.faseAttivaNome || "Buste Chiuse";

      // Copia mutabile locale delle squadre per scalare crediti e slot in sequenza
      const squadreMut: Record<number, any> = {};
      squadre.forEach((s) => {
        squadreMut[s.id] = {
          ...s,
          rosa: JSON.parse(JSON.stringify(s.rosa || {})),
        };
      });

      const storicoAggiornato = [...(lega?.storicoAsta || [])];
      const logsAggiornati = [...(lega?.auditLogs || [])];

      Object.entries(perCalciatore).forEach(([calcId, listaOfferte]) => {
        const ordinate = [...listaOfferte].sort((a, b) => Number(b.offerta) - Number(a.offerta));
        const top = ordinate[0];
        const pareggi = ordinate.filter((o) => Number(o.offerta) === Number(top.offerta));

        if (pareggi.length > 1) {
          risultati.push({
            giocatoreId: calcId,
            nome: top.nome,
            ruolo: top.ruolo,
            esito: "PAREGGIO",
            dettaglio: `Ballottaggio a ${top.offerta} cr tra: ${pareggi.map((p) => p.squadraNome).join(", ")}`,
            offerte: ordinate,
          });
        } else {
          const sq = squadreMut[top.squadraId];
          const chiaveRep = top.chiaveReparto;
          const maxSlot = getMaxSlotChiave(chiaveRep);
          const curLista = sq?.rosa?.[chiaveRep] || [];

          if (sq && curLista.length < maxSlot && sq.crediti >= Number(top.offerta)) {
            const acquisto = {
              id: calcId,
              nome: top.nome,
              ruolo: top.ruolo,
              chiaveReparto: chiaveRep,
              squadraSerieA: top.squadraSerieA || "",
              prezzoPagato: Number(top.offerta),
              fase: faseNome,
              timestamp: new Date().toISOString(),
            };
            sq.rosa[chiaveRep] = [...curLista, acquisto];
            sq.crediti -= Number(top.offerta);
            sq.giocatoriOccupati += 1;

            storicoAggiornato.unshift({
              ...acquisto,
              squadraId: sq.id,
              squadraNome: sq.nome,
            });
            logsAggiornati.unshift({
              timestamp: new Date().toISOString(),
              fase: faseNome,
              azione: "BUSTA CHIUSA",
              dettaglio: `${top.nome} (${top.ruolo}) -> ${sq.nome} a ${top.offerta} cr`,
              autore: "Apertura Buste",
            });

            risultati.push({
              giocatoreId: calcId,
              nome: top.nome,
              ruolo: top.ruolo,
              esito: "ASSEGNATO",
              dettaglio: `Aggiudicato a ${sq.nome} per ${top.offerta} cr`,
              offerte: ordinate,
            });
          } else {
            risultati.push({
              giocatoreId: calcId,
              nome: top.nome,
              ruolo: top.ruolo,
              esito: "NON_ASSEGNATO",
              dettaglio: `Slot o crediti insufficienti per ${top.squadraNome}`,
              offerte: ordinate,
            });
          }
        }
      });

      Object.values(squadreMut).forEach((sq) => {
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/crediti`] = sq.crediti;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/giocatoriOccupati`] = sq.giocatoriOccupati;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/rosa`] = sq.rosa;
      });

      updates[`leghe/${legaId}/storicoAsta`] = storicoAggiornato.slice(0, 100);
      updates[`leghe/${legaId}/auditLogs`] = logsAggiornati.slice(0, 300);
      updates[`leghe/${legaId}/busteChiuse/aperta`] = false;
      updates[`leghe/${legaId}/busteChiuse/risultatiApertura`] = risultati;

      await update(ref(db), updates);
      playBeep(880, 0.35, "triangle");
      alert(`✅ Buste aperte! Controlla l'esito delle assegnazioni ed eventuali pareggi.`);
    } finally {
      setAprendoBuste(false);
    }
  };

  // =========================================================================
  // ASTA ONLINE POKER (INVARIATA)
  // =========================================================================
  const statoOnline = lega?.statoAstaOnline || {
    attiva: false,
    inPausa: false,
    ordineTurni: [],
    indiceTurnoCorrente: 0,
    giocatoreCorrente: null,
    offertaAttuale: 0,
    migliorOfferenteId: null,
    migliorOfferenteNome: "",
    scadenzaTimestamp: null,
    secondiResiduiPausa: null,
  };

  const avviaAstaOnline = async () => {
    if (!legaId || !isAdminLega) return;

    let poolSquadreIds = connessiIds.length > 0 ? [...connessiIds] : squadre.map((s) => s.id);
    if (poolSquadreIds.length === 0) return;

    for (let i = poolSquadreIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [poolSquadreIds[i], poolSquadreIds[j]] = [poolSquadreIds[j], poolSquadreIds[i]];
    }

    const sec = Math.max(3, parseInt(timerSetupOnline) || 5);
    await update(ref(db, `leghe/${legaId}/impostazioniAsta`), {
      timerSecondi: sec,
    });

    await set(ref(db, `leghe/${legaId}/statoAstaOnline`), {
      attiva: true,
      inPausa: false,
      ordineTurni: poolSquadreIds,
      indiceTurnoCorrente: 0,
      giocatoreCorrente: null,
      offertaAttuale: 0,
      migliorOfferenteId: null,
      migliorOfferenteNome: "",
      scadenzaTimestamp: null,
      secondiResiduiPausa: null,
    });
    closingLockRef.current = false;
  };

  const chiamaGiocatoreOnline = async (giocatore: any, chiamanteSquadra: any | null) => {
    if (!legaId || !giocatore) return;
    setErroreAssegnazione("");

    if (chiamanteSquadra) {
      const blocco = verificaDivietoExGiocatore(chiamanteSquadra, giocatore.id);
      if (blocco) {
        setErroreAssegnazione(blocco);
        return;
      }
    }

    const sec = parseInt(lega?.impostazioniAsta?.timerSecondi || "5");
    const scadenza = Date.now() + sec * 1000;
    const chiaveRep = getChiaveReparto(giocatore);

    const haChiamante = Boolean(chiamanteSquadra);
    const maxOffChiamante = haChiamante ? getOffertaMassima(chiamanteSquadra) : 0;
    const ruoloOk = haChiamante
      ? (chiamanteSquadra.rosa?.[chiaveRep] || []).length < getMaxSlotChiave(chiaveRep)
      : false;

    const offertaIniziale = haChiamante && ruoloOk && maxOffChiamante >= 1 ? 1 : 0;

    closingLockRef.current = false;
    lastBeepSecRef.current = null;
    await update(ref(db, `leghe/${legaId}/statoAstaOnline`), {
      giocatoreCorrente: giocatore,
      offertaAttuale: offertaIniziale,
      migliorOfferenteId: offertaIniziale > 0 ? chiamanteSquadra.id : null,
      migliorOfferenteNome: offertaIniziale > 0 ? chiamanteSquadra.nome : "Nessuna offerta",
      scadenzaTimestamp: scadenza,
      inPausa: false,
      secondiResiduiPausa: null,
    });
    setRicerca("");
  };

  const rilanciaOnline = async (nuovaOfferta: number) => {
    if (!legaId || !miaSquadra || !statoOnline.giocatoreCorrente || statoOnline.inPausa) return;
    setErroreAssegnazione("");

    const bloccoEx = verificaDivietoExGiocatore(miaSquadra, statoOnline.giocatoreCorrente.id);
    if (bloccoEx) {
      setErroreAssegnazione(bloccoEx);
      return;
    }

    const chiaveRep = getChiaveReparto(statoOnline.giocatoreCorrente);
    const occupatiRuolo = (miaSquadra.rosa?.[chiaveRep] || []).length;
    const maxRuolo = getMaxSlotChiave(chiaveRep);

    if (occupatiRuolo >= maxRuolo) {
      setErroreAssegnazione(`⛔ Hai già completato gli slot ${chiaveRep} (${maxRuolo}/${maxRuolo})!`);
      return;
    }

    const maxOff = getOffertaMassima(miaSquadra);
    if (nuovaOfferta > maxOff) {
      setErroreAssegnazione(`⛔ Puoi offrire al massimo ${maxOff} crediti!`);
      return;
    }

    if (nuovaOfferta <= (statoOnline.offertaAttuale || 0)) {
      setErroreAssegnazione(`⚠️ Devi offrire più di ${statoOnline.offertaAttuale} crediti.`);
      return;
    }

    const sec = parseInt(lega?.impostazioniAsta?.timerSecondi || "5");
    lastBeepSecRef.current = null;
    await update(ref(db, `leghe/${legaId}/statoAstaOnline`), {
      offertaAttuale: nuovaOfferta,
      migliorOfferenteId: miaSquadra.id,
      migliorOfferenteNome: miaSquadra.nome,
      scadenzaTimestamp: Date.now() + sec * 1000,
    });
    setOffertaCustomOnline("");
  };

  const togglePausaOnline = async () => {
    if (!legaId || !isAdminLega) return;

    if (!statoOnline.inPausa) {
      const residui = statoOnline.scadenzaTimestamp
        ? Math.max(1, Math.ceil((statoOnline.scadenzaTimestamp - Date.now()) / 1000))
        : parseInt(lega?.impostazioniAsta?.timerSecondi || "5");

      await update(ref(db, `leghe/${legaId}/statoAstaOnline`), {
        inPausa: true,
        secondiResiduiPausa: residui,
      });
    } else {
      const residui = statoOnline.secondiResiduiPausa || parseInt(lega?.impostazioniAsta?.timerSecondi || "5");
      await update(ref(db, `leghe/${legaId}/statoAstaOnline`), {
        inPausa: false,
        scadenzaTimestamp: Date.now() + residui * 1000,
        secondiResiduiPausa: null,
      });
    }
  };

  const cambiaRuoloOnline = async (nuovoRuolo: string) => {
    if (!legaId || !isAdminLega) return;
    await update(ref(db, `leghe/${legaId}/impostazioniAsta`), {
      ruoloAttivo: nuovoRuolo,
    });
  };

  const annullaGiocatoreOnline = async () => {
    if (!legaId || !isAdminLega) return;
    await update(ref(db, `leghe/${legaId}/statoAstaOnline`), {
      giocatoreCorrente: null,
      offertaAttuale: 0,
      migliorOfferenteId: null,
      migliorOfferenteNome: "",
      scadenzaTimestamp: null,
      inPausa: false,
      secondiResiduiPausa: null,
    });
  };

  const chiudiEAggiudicaOnline = async () => {
    if (!legaId || !statoOnline.giocatoreCorrente || closingLockRef.current) return;
    closingLockRef.current = true;
    playBeep(880, 0.35, "triangle");

    const giocatore = statoOnline.giocatoreCorrente;
    const vincitoreId = statoOnline.migliorOfferenteId;
    const prezzo = statoOnline.offertaAttuale || 0;
    const ordine = statoOnline.ordineTurni || [];
    const prossimoIndice = ordine.length > 0 ? ((statoOnline.indiceTurnoCorrente || 0) + 1) % ordine.length : 0;
    const faseNome = lega?.faseAttivaNome || "Prima Asta";

    const updates: Record<string, any> = {};

    if (vincitoreId !== null && vincitoreId !== undefined && prezzo > 0) {
      const sq = squadre.find((s) => Number(s.id) === Number(vincitoreId));
      if (sq) {
        const chiaveRep = getChiaveReparto(giocatore);
        const ruoloVis = getRuoloDisplay(giocatore);
        const rosaAttualeRuolo = sq.rosa?.[chiaveRep] || [];
        const nuovoAcquisto = {
          id: giocatore.id,
          nome: giocatore.nome,
          ruolo: ruoloVis,
          chiaveReparto: chiaveRep,
          squadraSerieA: giocatore.squadra,
          prezzoPagato: prezzo,
          fase: faseNome,
          timestamp: new Date().toISOString(),
        };

        const storicoAttuale = lega.storicoAsta || [];
        const nuovoStorico = [
          {
            ...nuovoAcquisto,
            squadraId: sq.id,
            squadraNome: sq.nome,
          },
          ...storicoAttuale,
        ].slice(0, 100);

        const logsAttuali = lega.auditLogs || [];
        const nuovoLog = {
          timestamp: new Date().toISOString(),
          fase: faseNome,
          azione: "ASSEGNAZIONE ONLINE",
          dettaglio: `${giocatore.nome} (${ruoloVis}) -> ${sq.nome} a ${prezzo} crediti`,
          autore: user?.email || "Asta Online",
        };

        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/crediti`] = sq.crediti - prezzo;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/giocatoriOccupati`] = sq.giocatoriOccupati + 1;
        updates[`leghe/${legaId}/squadre/squadra_${sq.id}/rosa/${chiaveRep}`] = [...rosaAttualeRuolo, nuovoAcquisto];
        updates[`leghe/${legaId}/storicoAsta`] = nuovoStorico;
        updates[`leghe/${legaId}/auditLogs`] = [nuovoLog, ...logsAttuali].slice(0, 300);
      }
    }

    updates[`leghe/${legaId}/statoAstaOnline/giocatoreCorrente`] = null;
    updates[`leghe/${legaId}/statoAstaOnline/offertaAttuale`] = 0;
    updates[`leghe/${legaId}/statoAstaOnline/migliorOfferenteId`] = null;
    updates[`leghe/${legaId}/statoAstaOnline/migliorOfferenteNome`] = "";
    updates[`leghe/${legaId}/statoAstaOnline/scadenzaTimestamp`] = null;
    updates[`leghe/${legaId}/statoAstaOnline/inPausa`] = false;
    updates[`leghe/${legaId}/statoAstaOnline/secondiResiduiPausa`] = null;
    updates[`leghe/${legaId}/statoAstaOnline/indiceTurnoCorrente`] = prossimoIndice;

    await update(ref(db), updates);
  };

  useEffect(() => {
    if (!isModalitaOnline || !statoOnline.attiva || !statoOnline.giocatoreCorrente) {
      setSecondiRimasti(0);
      return;
    }

    if (statoOnline.inPausa) {
      setSecondiRimasti(statoOnline.secondiResiduiPausa || 0);
      return;
    }

    const interval = setInterval(() => {
      if (!statoOnline.scadenzaTimestamp) return;
      const diff = statoOnline.scadenzaTimestamp - Date.now();
      const sec = Math.max(0, Math.ceil(diff / 1000));
      setSecondiRimasti(sec);

      if (sec > 0 && sec <= 3 && lastBeepSecRef.current !== sec) {
        lastBeepSecRef.current = sec;
        playBeep(sec === 1 ? 660 : 440, 0.14, "sine");
      }

      if (diff <= 0 && isAdminLega && !closingLockRef.current) {
        chiudiEAggiudicaOnline();
      }
    }, 150);

    return () => clearInterval(interval);
  }, [
    isModalitaOnline,
    statoOnline.attiva,
    statoOnline.giocatoreCorrente,
    statoOnline.inPausa,
    statoOnline.scadenzaTimestamp,
    statoOnline.secondiResiduiPausa,
    isAdminLega,
    audioAttivo,
  ]);

  // --- ASTA MANUALE ---
  const portaSulPalco = (giocatore: any) => {
    setGiocatoreSelezionato(giocatore);
    setPrezzoAcquisto("");
    setErroreAssegnazione("");
  };

  const annullaChiamataSulPalco = () => {
    setGiocatoreSelezionato(null);
    setPrezzoAcquisto("");
    setErroreAssegnazione("");
  };

  const chiamaRandom = () => {
    if (giocatoriDisponibili.length === 0) return;
    const idx = Math.floor(Math.random() * giocatoriDisponibili.length);
    portaSulPalco(giocatoriDisponibili[idx]);
  };

  const chiamaProssimoAlfabetico = () => {
    if (giocatoriDisponibili.length === 0) return;
    portaSulPalco(giocatoriDisponibili[0]);
  };

  const assegnaASquadra = async (squadra: any) => {
    setErroreAssegnazione("");
    if (!legaId || !giocatoreSelezionato || salvando) return;

    const bloccoEx = verificaDivietoExGiocatore(squadra, giocatoreSelezionato.id);
    if (bloccoEx) {
      setErroreAssegnazione(bloccoEx);
      alert(bloccoEx);
      return;
    }

    const prezzo = parseInt(prezzoAcquisto);
    if (isNaN(prezzo) || prezzo < 1) {
      setErroreAssegnazione("⚠️ Inserisci prima il prezzo pagato (almeno 1 credito) e poi clicca sulla squadra.");
      return;
    }

    const chiaveRep = getChiaveReparto(giocatoreSelezionato);
    const ruoloVis = getRuoloDisplay(giocatoreSelezionato);
    const rosaAttualeRuolo = squadra.rosa?.[chiaveRep] || [];
    const maxSlotRuolo = getMaxSlotChiave(chiaveRep);

    if (rosaAttualeRuolo.length >= maxSlotRuolo) {
      setErroreAssegnazione(`⛔ ${squadra.nome} ha già completato gli slot ${chiaveRep} (${maxSlotRuolo}/${maxSlotRuolo})!`);
      return;
    }

    const offertaMax = getOffertaMassima(squadra);
    if (prezzo > offertaMax) {
      setErroreAssegnazione(`⛔ ${squadra.nome} può offrire al massimo ${offertaMax} crediti.`);
      return;
    }

    setSalvando(true);
    try {
      const faseNome = lega?.faseAttivaNome || "Prima Asta";
      const nuovoAcquisto = {
        id: giocatoreSelezionato.id,
        nome: giocatoreSelezionato.nome,
        ruolo: ruoloVis,
        chiaveReparto: chiaveRep,
        squadraSerieA: giocatoreSelezionato.squadra,
        prezzoPagato: prezzo,
        fase: faseNome,
        timestamp: new Date().toISOString(),
      };

      const nuovaRosaRuolo = [...rosaAttualeRuolo, nuovoAcquisto];
      const storicoAttuale = lega.storicoAsta || [];
      const nuovoStorico = [
        {
          ...nuovoAcquisto,
          squadraId: squadra.id,
          squadraNome: squadra.nome,
        },
        ...storicoAttuale,
      ].slice(0, 100);

      const logsAttuali = lega.auditLogs || [];
      const nuovoLog = {
        timestamp: new Date().toISOString(),
        fase: faseNome,
        azione: "ASSEGNAZIONE MANUALE",
        dettaglio: `${giocatoreSelezionato.nome} (${ruoloVis}) -> ${squadra.nome} a ${prezzo} crediti`,
        autore: user?.email || "Admin",
      };

      const updates: Record<string, any> = {};
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/crediti`] = squadra.crediti - prezzo;
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/giocatoriOccupati`] = squadra.giocatoriOccupati + 1;
      updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/rosa/${chiaveRep}`] = nuovaRosaRuolo;
      updates[`leghe/${legaId}/storicoAsta`] = nuovoStorico;
      updates[`leghe/${legaId}/auditLogs`] = [nuovoLog, ...logsAttuali].slice(0, 300);

      await update(ref(db), updates);

      setGiocatoreSelezionato(null);
      setPrezzoAcquisto("");
      setRicerca("");
    } catch (error) {
      console.error(error);
      setErroreAssegnazione("❌ Errore di connessione durante il salvataggio.");
    } finally {
      setSalvando(false);
    }
  };

  const annullaAssegnazioneSpecifica = async (item: any) => {
    if (!legaId || !isAdminLega) return;
    if (
      !confirm(
        `Vuoi annullare l'assegnazione di ${item.nome} a ${item.squadraNome} (${item.prezzoPagato} crediti) e rimetterlo tra i disponibili?`
      )
    ) {
      return;
    }

    const squadra = squadre.find((s) => Number(s.id) === Number(item.squadraId));
    if (!squadra) return;

    const chiaveRep = item.chiaveReparto || (isMantra ? (item.ruolo?.toLowerCase().includes("por") ? "POR" : "MOV") : item.ruolo);
    const rosaRuolo = squadra.rosa?.[chiaveRep] || [];
    const rosaAggiornata = rosaRuolo.filter((g: any) => String(g.id) !== String(item.id));
    const storicoAggiornato = (lega?.storicoAsta || []).filter(
      (s: any) => !(String(s.id) === String(item.id) && s.timestamp === item.timestamp)
    );

    const logsAttuali = lega?.auditLogs || [];
    const nuovoLog = {
      timestamp: new Date().toISOString(),
      fase: lega?.faseAttivaNome || "Prima Asta",
      azione: "ANNULLAMENTO ACQUISTO",
      dettaglio: `Annullato ${item.nome} da ${item.squadraNome} (+${item.prezzoPagato} crediti rimborsati)`,
      autore: user?.email || "Admin",
    };

    const updates: Record<string, any> = {};
    updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/crediti`] = squadra.crediti + Number(item.prezzoPagato || 0);
    updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/giocatoriOccupati`] = Math.max(
      0,
      squadra.giocatoriOccupati - 1
    );
    updates[`leghe/${legaId}/squadre/squadra_${squadra.id}/rosa/${chiaveRep}`] = rosaAggiornata;
    updates[`leghe/${legaId}/storicoAsta`] = storicoAggiornato;
    updates[`leghe/${legaId}/auditLogs`] = [nuovoLog, ...logsAttuali].slice(0, 300);

    await update(ref(db), updates);
  };

  const badgeRuolo = (ruolo: string) => {
    const r = (ruolo || "").toLowerCase();
    if (r === "p" || r.startsWith("por")) return "bg-yellow-500 text-slate-950";
    if (r === "d" || r.startsWith("dd") || r.startsWith("ds") || r.startsWith("dc")) return "bg-green-500 text-slate-950";
    if (r === "c" || r.startsWith("e") || r.startsWith("m") || r.startsWith("c;")) return "bg-blue-500 text-white";
    if (r.startsWith("w") || r.startsWith("t")) return "bg-purple-500 text-white";
    if (r === "a" || r.startsWith("pc") || r.startsWith("a;")) return "bg-red-500 text-white";
    return "bg-slate-600 text-white";
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 text-amber-400 flex flex-col items-center justify-center font-sans">
        <h2 className="font-bold tracking-widest uppercase">Apertura Sala d&apos;Asta...</h2>
      </div>
    );
  }

  const puoAccedereAllaSala =
    isAdminLega || ((isModalitaOnline || isModalitaBuste) && Boolean(miaSquadra));

  if (!puoAccedereAllaSala) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans text-center">
        <div className="bg-slate-900 border border-red-800/60 p-8 rounded-2xl max-w-md space-y-4 shadow-2xl">
          <h1 className="text-xl font-black uppercase text-white">Accesso Riservato</h1>
          <p className="text-sm text-slate-400">
            Solo l&apos;amministratore può accedere alla sala d&apos;asta in modalità manuale. Segui il tabellone dalla Dashboard!
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl"
          >
            Torna al Tabellone Dashboard
          </button>
        </div>
      </div>
    );
  }

  const storicoAssegnazioni: any[] = lega?.storicoAsta || [];
  const listaFiltriRuolo = isMantra ? RUOLI_MANTRA : RUOLI_CLASSIC;

  // Verifica se il giocatore sul palco è nella Watchlist privata dell'utente
  const giocatoreSulPalco = isModalitaOnline ? statoOnline.giocatoreCorrente : giocatoreSelezionato;
  const watchlistTargetSulPalco = giocatoreSulPalco
    ? watchlistMap[`calc_${giocatoreSulPalco.id}`]
    : null;

  // =========================================================================
  // MODALITÀ PROIETTORE / TV
  // =========================================================================
  if (modalitaTV) {
    const giocatoreTV = giocatoreSulPalco;

    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans flex flex-col justify-between">
        <header className="flex justify-between items-center bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping"></span>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-amber-400">
              {lega?.nomeLega} • <span className="text-white">{lega?.faseAttivaNome || "Prima Asta"}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setModalitaTV(false)}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg"
            >
              ✕ Esci da Vista TV
            </button>
          </div>
        </header>

        <section className="my-6 bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-8 md:p-12 shadow-2xl text-center">
          {!giocatoreTV ? (
            <div className="py-10 space-y-3">
              <div className="text-sm font-black uppercase tracking-widest text-slate-400">In attesa della prossima chiamata</div>
              <div className="text-3xl md:text-5xl font-black text-white">Pronti per battere il prossimo calciatore</div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6 text-left">
                <span
                  className={`px-6 py-5 rounded-2xl font-black text-3xl md:text-5xl shadow-xl ${badgeRuolo(
                    getRuoloDisplay(giocatoreTV)
                  )}`}
                >
                  {getRuoloDisplay(giocatoreTV)}
                </span>
                <div>
                  <div className="text-xs md:text-sm font-black uppercase tracking-widest text-amber-400">
                    Calciatore all&apos;Asta
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">{giocatoreTV.nome}</h2>
                  <div className="text-lg md:text-2xl font-bold text-slate-400 uppercase mt-1">
                    {giocatoreTV.squadra} • Quotazione: {giocatoreTV.quotazioneBase}
                  </div>
                </div>
              </div>

              {isModalitaOnline && (
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-xs font-black uppercase text-slate-400">Offerta Attuale</div>
                    <div className="text-5xl md:text-7xl font-black text-amber-400 leading-none">
                      {statoOnline.offertaAttuale} <span className="text-xl">cr</span>
                    </div>
                    <div className="text-lg md:text-2xl font-black text-emerald-400 mt-2">
                      {statoOnline.migliorOfferenteNome}
                    </div>
                  </div>

                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-3xl border-4 border-amber-500 bg-slate-950 flex flex-col items-center justify-center font-black">
                    <span className="text-5xl md:text-7xl">{secondiRimasti}</span>
                    <span className="text-xs uppercase text-slate-400">sec</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {squadre.map((sq) => (
            <div key={sq.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
              <div className="min-w-0">
                <div className="text-base md:text-lg font-black text-white truncate">{sq.nome}</div>
                <div className="text-xs font-bold text-slate-400">
                  Rosa: {sq.giocatoriOccupati}/{sq.slotTotali} • Max: {getOffertaMassima(sq)}
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-black text-amber-400 shrink-0 ml-2">{sq.crediti}</div>
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-5 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* HEADER UNIFICATO */}
        <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row justify-between items-center gap-3 shadow-xl">
          <div className="flex items-center gap-3 w-full xl:w-auto">
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold uppercase transition shrink-0"
            >
              ← Tabellone
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-wider truncate">
                  Sala Asta • <span className="text-amber-400">{lega?.nomeLega}</span>
                </h1>
                <span className="bg-purple-950 text-purple-300 border border-purple-700/60 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                  {lega?.modalita}
                </span>
                <span className="bg-blue-950 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                  {lega?.faseAttivaNome || "Prima Asta"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Calciatori svincolati: <strong className="text-white">{giocatoriDisponibili.length}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setRightSidebarTab("watchlist")}
              className="bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 px-3 py-2 rounded-lg text-xs font-black uppercase transition"
              title="I tuoi obiettivi personali (visibili solo a te)"
            >
              ⭐ Miei Obiettivi ({watchlistArray.length})
            </button>

            <button
              type="button"
              onClick={() => setAudioAttivo(!audioAttivo)}
              className={`px-3 py-2 rounded-lg border text-xs font-black uppercase transition ${
                audioAttivo
                  ? "bg-slate-800 text-emerald-400 border-slate-700"
                  : "bg-slate-900 text-slate-500 border-slate-800"
              }`}
            >
              {audioAttivo ? "🔊 Audio ON" : "🔇 Audio OFF"}
            </button>

            <button
              type="button"
              onClick={() => setModalitaTV(true)}
              className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 px-3 py-2 rounded-lg text-xs font-black uppercase transition"
            >
              📺 Vista TV
            </button>

            {isAdminLega && (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => switchModalitaSala("manuale")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition ${
                    modalitaSala === "manuale" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Manuale
                </button>
                <button
                  type="button"
                  onClick={() => switchModalitaSala("online")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition ${
                    isModalitaOnline ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Online Poker
                </button>
                <button
                  type="button"
                  onClick={() => switchModalitaSala("buste")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition ${
                    isModalitaBuste ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ✉️ Busta Chiusa
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ALERT PRIVATO WATCHLIST QUANDO UN TUO OBIETTIVO SALE SUL PALCO */}
        {watchlistTargetSulPalco && (
          <div
            className={`rounded-xl p-3.5 border flex flex-wrap items-center justify-between gap-3 text-xs ${
              isModalitaOnline && (statoOnline.offertaAttuale || 0) > watchlistTargetSulPalco.budgetMax
                ? "bg-red-950/85 border-red-500 text-red-200"
                : "bg-amber-950/80 border-amber-500 text-amber-200"
            }`}
          >
            <div>
              <span className="font-black uppercase mr-2">⭐ Obiettivo nella tua Watchlist Privata:</span>
              <strong>{watchlistTargetSulPalco.nome}</strong> • Priorità:{" "}
              <strong className="uppercase">{watchlistTargetSulPalco.priorita}</strong>
              {watchlistTargetSulPalco.nota && <span> • Nota: &ldquo;{watchlistTargetSulPalco.nota}&rdquo;</span>}
            </div>
            <div className="font-black text-sm">
              Tuo Tetto Max: <span className="text-white">{watchlistTargetSulPalco.budgetMax} cr</span>
              {isModalitaOnline && (statoOnline.offertaAttuale || 0) > watchlistTargetSulPalco.budgetMax && (
                <span className="ml-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded uppercase">
                  ⚠️ Budget Superato!
                </span>
              )}
            </div>
          </div>
        )}

        {/* GRIGLIA PRINCIPALE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-4">
            {/* =============================================================== */}
            {/* MODALITÀ 3: ASTA A BUSTA CHIUSA PER SVINCOLATI                  */}
            {/* =============================================================== */}
            {isModalitaBuste ? (
              <div className="space-y-4">
                <section className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                        Offerte Segrete per Svincolati
                      </span>
                      <h2 className="text-lg font-black text-white mt-1">
                        ✉️ {sessioneBuste?.titolo || "Asta a Busta Chiusa"}
                      </h2>
                    </div>

                    {isAdminLega && sessioneBuste?.aperta && (
                      <button
                        type="button"
                        disabled={aprendoBuste}
                        onClick={apriBusteEAssegna}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs px-4 py-2.5 rounded-xl shadow"
                      >
                        {aprendoBuste ? "Apertura in corso..." : "🔓 Chiudi & Apri Tutte le Buste"}
                      </button>
                    )}
                  </div>

                  {/* Configurazione Admin se nessuna sessione buste è aperta */}
                  {!sessioneBuste?.aperta && isAdminLega && (
                    <form onSubmit={avviaSessioneBusteChiuse} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                      <div className="font-black text-amber-400 uppercase">Apri Nuova Sessione a Buste Chiuse</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 uppercase mb-1">Titolo Sessione</label>
                          <input
                            type="text"
                            value={bustaTitolo}
                            onChange={(e) => setBustaTitolo(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase mb-1">Durata (Ore)</label>
                          <input
                            type="number"
                            min="1"
                            value={bustaDurataOre}
                            onChange={(e) => setBustaDurataOre(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-center"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase py-3 rounded-xl"
                      >
                        Avvia Buste Chiuse Ora
                      </button>
                    </form>
                  )}

                  {/* Modulo Offerta Segreta per il Partecipante */}
                  {sessioneBuste?.aperta && miaSquadra && (
                    <div className="space-y-4 text-xs">
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap justify-between items-center gap-2">
                        <span>
                          Squadra: <strong className="text-amber-400">{miaSquadra.nome}</strong> • Crediti residui:{" "}
                          <strong className="text-emerald-400">{miaSquadra.crediti} cr</strong>
                        </span>
                        {sessioneBuste.scadenza && (
                          <span className="text-slate-400">
                            Scadenza:{" "}
                            <strong className="text-white">
                              {new Date(sessioneBuste.scadenza).toLocaleString("it-IT", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </span>
                        )}
                      </div>

                      {/* Le mie buste già inviate */}
                      {mieBusteInviate.length > 0 && (
                        <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-3.5 space-y-2">
                          <div className="font-black uppercase text-indigo-300 text-[11px]">
                            🔒 Le Tue Buste Segrete Inviate (Visibili solo a te fino all&apos;apertura):
                          </div>
                          <div className="space-y-1.5">
                            {mieBusteInviate.map((b: any) => (
                              <div
                                key={b.giocatoreId}
                                className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800"
                              >
                                <div>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black mr-2 ${badgeRuolo(b.ruolo)}`}>
                                    {b.ruolo}
                                  </span>
                                  <strong className="text-white">{b.nome}</strong>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-black text-amber-400">{b.offerta} cr</span>
                                  <button
                                    type="button"
                                    onClick={() => ritiraOffertaInBusta(b.giocatoreId)}
                                    className="text-red-400 hover:text-red-300 font-bold"
                                  >
                                    Ritira
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selezione Calciatore Svincolato per inserire offerta in busta */}
                      {!bustaSelectedPlayer ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={bustaRicerca}
                            onChange={(e) => setBustaRicerca(e.target.value)}
                            placeholder="Cerca svincolato su cui fare un'offerta in busta chiusa..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white"
                          />
                          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
                            {listone
                              .filter(
                                (g) =>
                                  !idGiocatoriAcquistati.has(String(g.id)) &&
                                  (bustaRicerca.trim() === "" ||
                                    g.nome.toLowerCase().includes(bustaRicerca.toLowerCase()) ||
                                    g.squadra.toLowerCase().includes(bustaRicerca.toLowerCase()))
                              )
                              .slice(0, 30)
                              .map((g) => {
                                const rVis = getRuoloDisplay(g);
                                return (
                                  <div
                                    key={g.id}
                                    onClick={() => {
                                      setBustaSelectedPlayer(g);
                                      setBustaOffertaCrediti("1");
                                    }}
                                    className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${badgeRuolo(rVis)}`}>
                                        {rVis}
                                      </span>
                                      <span className="font-bold text-white">{g.nome}</span>
                                      <span className="text-[10px] text-slate-400">({g.squadra})</span>
                                    </div>
                                    <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded text-[10px] uppercase">
                                      Offri in Busta
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : (
                        <form
                          onSubmit={inviaOffertaInBusta}
                          className="bg-slate-950 border border-amber-500/50 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[10px] uppercase text-slate-400">Offerta Segreta per:</span>
                              <div className="text-base font-black text-white">
                                {bustaSelectedPlayer.nome} ({getRuoloDisplay(bustaSelectedPlayer)})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBustaSelectedPlayer(null)}
                              className="text-slate-400 hover:text-white"
                            >
                              ✕ Annulla
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              required
                              value={bustaOffertaCrediti}
                              onChange={(e) => setBustaOffertaCrediti(e.target.value)}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-lg font-black text-amber-400"
                            />
                            <button
                              type="submit"
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase px-5 rounded-xl"
                            >
                              Sigilla Busta ✉️
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Risultati Apertura Buste */}
                  {sessioneBuste?.risultatiApertura && (
                    <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
                      <h3 className="font-black uppercase text-emerald-400">
                        🔓 Esito Apertura Buste Chiuse
                      </h3>
                      {sessioneBuste.risultatiApertura.map((ris: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border ${
                            ris.esito === "PAREGGIO"
                              ? "bg-amber-950/50 border-amber-500"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-white">
                              {ris.nome} ({ris.ruolo})
                            </span>
                            <span
                              className={
                                ris.esito === "ASSEGNATO"
                                  ? "text-emerald-400"
                                  : ris.esito === "PAREGGIO"
                                  ? "text-amber-400"
                                  : "text-red-400"
                              }
                            >
                              {ris.dettaglio}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Tutte le buste: {(ris.offerte || []).map((o: any) => `${o.squadraNome} (${o.offerta} cr)`).join(" • ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : isModalitaOnline ? (
              (() => {
                const ordineTurni: number[] = statoOnline.ordineTurni || [];
                const idSquadraDiTurno = ordineTurni[statoOnline.indiceTurnoCorrente || 0];
                const squadraDiTurno = squadre.find((s) => Number(s.id) === Number(idSquadraDiTurno));
                const eIlMioTurno = Boolean(miaSquadra && squadraDiTurno && miaSquadra.id === squadraDiTurno.id);
                const chiamataMode = lega?.impostazioniAsta?.chiamata || "libera";
                const ruoloAttivo = lega?.impostazioniAsta?.ruoloAttivo || "TUTTI";

                return (
                  <div className="space-y-4">
                    <section className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] font-bold uppercase text-slate-400">
                        <span>
                          {statoOnline.attiva
                            ? "Ordine Turni (Tavolo Poker)"
                            : `Partecipanti Connessi (${connessiIds.length}/${squadre.length})`}
                        </span>

                        {isAdminLega && statoOnline.attiva && (
                          <div className="flex items-center gap-2">
                            <select
                              value={ruoloAttivo}
                              onChange={(e) => cambiaRuoloOnline(e.target.value)}
                              className="bg-slate-950 border border-slate-700 text-xs font-bold text-white rounded-lg px-2 py-1"
                            >
                              {listaFiltriRuolo.map((r) => (
                                <option key={r} value={r}>
                                  Ruolo: {r}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={togglePausaOnline}
                              className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                                statoOnline.inPausa ? "bg-emerald-600 text-white" : "bg-amber-500 text-slate-950"
                              }`}
                            >
                              {statoOnline.inPausa ? "Riprendi" : "Pausa"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(statoOnline.attiva && ordineTurni.length > 0 ? ordineTurni : squadre.map((s) => s.id)).map(
                          (sqId) => {
                            const sq = squadre.find((s) => Number(s.id) === Number(sqId));
                            if (!sq) return null;
                            const isOnline = connessiIds.includes(Number(sq.id));
                            const isTurn = statoOnline.attiva && squadraDiTurno && squadraDiTurno.id === sq.id;

                            return (
                              <div
                                key={sq.id}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
                                  isTurn
                                    ? "bg-amber-500/20 border-amber-400 text-amber-300"
                                    : "bg-slate-950 border-slate-800 text-slate-300"
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-red-500"}`}
                                ></span>
                                <span>{sq.nome}</span>
                                <span className="text-[10px] text-slate-500">({sq.crediti})</span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </section>

                    {!statoOnline.attiva ? (
                      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
                        <h2 className="text-xl font-black text-white">Lobby Asta Online (Turni Poker)</h2>
                        {isAdminLega ? (
                          <div className="max-w-xs mx-auto bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                Secondi Timer Rilancio
                              </label>
                              <input
                                type="number"
                                min="3"
                                max="60"
                                value={timerSetupOnline}
                                onChange={(e) => setTimerSetupOnline(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-amber-400 font-black text-xl"
                              />
                            </div>
                            <button
                              onClick={avviaAstaOnline}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase py-3 rounded-xl text-xs"
                            >
                              Avvia Asta Online Ora
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-amber-400 uppercase">In attesa del via dell&apos;Admin...</div>
                        )}
                      </section>
                    ) : statoOnline.inPausa ? (
                      <section className="bg-amber-950/30 border-2 border-amber-500/50 rounded-2xl p-8 text-center space-y-3">
                        <h2 className="text-xl font-black text-white uppercase">Asta in Pausa</h2>
                      </section>
                    ) : !statoOnline.giocatoreCorrente ? (
                      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                        {chiamataMode === "random" || chiamataMode === "alfabetica" ? (
                          <div className="text-center py-6 space-y-3">
                            <div className="text-xs font-bold uppercase text-blue-400">
                              Chiamata {chiamataMode} ({ruoloAttivo})
                            </div>
                            {isAdminLega ? (
                              <button
                                onClick={() => {
                                  if (giocatoriDisponibili.length === 0) return;
                                  const g =
                                    chiamataMode === "random"
                                      ? giocatoriDisponibili[Math.floor(Math.random() * giocatoriDisponibili.length)]
                                      : giocatoriDisponibili[0];
                                  chiamaGiocatoreOnline(g, null);
                                }}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase px-6 py-3 rounded-xl text-xs"
                              >
                                Lancia Prossimo Calciatore
                              </button>
                            ) : (
                              <p className="text-xs text-slate-400">In attesa che l&apos;Admin lanci il calciatore...</p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex justify-between items-center">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Turno di chiamata:</span>
                                <h2 className="text-lg font-black text-amber-400">{squadraDiTurno?.nome}</h2>
                              </div>
                              {eIlMioTurno && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black uppercase animate-pulse">
                                  Tocca a te!
                                </span>
                              )}
                            </div>

                            {erroreAssegnazione && (
                              <div className="bg-red-950/90 border border-red-700 text-red-200 text-xs font-bold p-3 rounded-xl">
                                {erroreAssegnazione}
                              </div>
                            )}

                            {(eIlMioTurno || isAdminLega) && (
                              <>
                                <input
                                  type="text"
                                  value={ricerca}
                                  onChange={(e) => setRicerca(e.target.value)}
                                  placeholder="Cerca calciatore o squadra..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white"
                                />
                                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
                                  {giocatoriDisponibili.slice(0, 40).map((g) => {
                                    const rVis = getRuoloDisplay(g);
                                    const inWl = Boolean(watchlistMap[`calc_${g.id}`]);
                                    return (
                                      <div
                                        key={g.id}
                                        className="p-3 hover:bg-slate-800 flex items-center justify-between gap-2"
                                      >
                                        <div
                                          onClick={() => chiamaGiocatoreOnline(g, squadraDiTurno || miaSquadra)}
                                          className="flex items-center gap-2.5 flex-1 cursor-pointer"
                                        >
                                          <span
                                            className={`px-2 py-1 rounded font-black text-[11px] ${badgeRuolo(rVis)}`}
                                          >
                                            {rVis}
                                          </span>
                                          <div>
                                            <div className="font-bold text-white text-sm">{g.nome}</div>
                                            <div className="text-[10px] text-slate-400 uppercase">{g.squadra}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => apriEditorWatchlist(g)}
                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                              inWl ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-amber-400"
                                            }`}
                                            title="Aggiungi/Modifica nella tua Watchlist Privata"
                                          >
                                            ★
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => chiamaGiocatoreOnline(g, squadraDiTurno || miaSquadra)}
                                            className="bg-amber-500 text-slate-950 px-3 py-1 rounded-lg text-xs font-black"
                                          >
                                            Chiama
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </section>
                    ) : (
                      <section className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-5 space-y-5 shadow-2xl">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-2 rounded-xl font-black text-base ${badgeRuolo(
                                getRuoloDisplay(statoOnline.giocatoreCorrente)
                              )}`}
                            >
                              {getRuoloDisplay(statoOnline.giocatoreCorrente)}
                            </span>
                            <div>
                              <h2 className="text-2xl font-black text-white">{statoOnline.giocatoreCorrente.nome}</h2>
                              <div className="text-xs text-slate-400">{statoOnline.giocatoreCorrente.squadra}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-[10px] uppercase font-bold text-slate-400">Offerta</div>
                              <div className="text-2xl font-black text-amber-400">{statoOnline.offertaAttuale} cr</div>
                              <div className="text-xs font-bold text-emerald-400">{statoOnline.migliorOfferenteNome}</div>
                            </div>
                            <div
                              className={`w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center font-black ${
                                secondiRimasti <= 3
                                  ? "border-red-500 bg-red-950/60 text-red-400 animate-pulse"
                                  : "border-amber-500/60 bg-slate-900 text-white"
                              }`}
                            >
                              <span className="text-2xl">{secondiRimasti}</span>
                              <span className="text-[8px] uppercase text-slate-400">sec</span>
                            </div>
                          </div>
                        </div>

                        {erroreAssegnazione && (
                          <div className="bg-red-950/90 border border-red-700 text-red-200 text-xs font-bold p-3 rounded-xl text-center">
                            {erroreAssegnazione}
                          </div>
                        )}

                        {miaSquadra && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              {[1, 5, 10].map((inc) => {
                                const target = (statoOnline.offertaAttuale || 0) + inc;
                                return (
                                  <button
                                    key={inc}
                                    type="button"
                                    onClick={() => rilanciaOnline(target)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-base"
                                  >
                                    +{inc} ({target})
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={offertaCustomOnline}
                                onChange={(e) => setOffertaCustomOnline(e.target.value)}
                                placeholder="Offerta libera"
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const v = parseInt(offertaCustomOnline);
                                  if (!isNaN(v)) rilanciaOnline(v);
                                }}
                                className="bg-amber-500 text-slate-950 font-black uppercase px-5 rounded-xl text-xs"
                              >
                                Rilancia
                              </button>
                            </div>
                          </div>
                        )}

                        {isAdminLega && (
                          <div className="pt-3 border-t border-slate-800 flex justify-between gap-2">
                            <button
                              type="button"
                              onClick={annullaGiocatoreOnline}
                              className="bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold uppercase"
                            >
                              ✕ Annulla Chiamata
                            </button>
                            <button
                              type="button"
                              onClick={chiudiEAggiudicaOnline}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase"
                            >
                              Aggiudica Subito
                            </button>
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                );
              })()
            ) : (
              /* MODALITÀ ASTA MANUALE */
              <div className="space-y-4">
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {[
                      { id: "libera", label: "Lista Calciatori" },
                      { id: "random", label: "Random" },
                      { id: "alfabetica", label: "Alfabetica" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTipoChiamata(m.id as any)}
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-bold ${
                          tipoChiamata === m.id ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {listaFiltriRuolo.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFiltroRuolo(r)}
                        className={`px-2.5 py-1.5 rounded text-xs font-black ${
                          filtroRuolo === r ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </section>

                {!giocatoreSelezionato ? (
                  <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Lista Calciatori Disponibili
                      </h2>
                      <span className="text-[11px] text-slate-500">Clicca ★ per segnarti i tuoi obiettivi privati</span>
                    </div>

                    {tipoChiamata === "random" && (
                      <div className="text-center py-6 space-y-3">
                        <button
                          onClick={chiamaRandom}
                          disabled={giocatoriDisponibili.length === 0}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase px-6 py-3.5 rounded-xl text-xs shadow-lg"
                        >
                          Chiama Calciatore Random
                        </button>
                      </div>
                    )}

                    {tipoChiamata === "alfabetica" && (
                      <div className="text-center py-6 space-y-3">
                        {giocatoriDisponibili.length > 0 && (
                          <>
                            <div className="text-xl font-black text-white">
                              {giocatoriDisponibili[0].nome} ({giocatoriDisponibili[0].squadra})
                            </div>
                            <button
                              onClick={chiamaProssimoAlfabetico}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase px-6 py-3.5 rounded-xl text-xs"
                            >
                              Chiama sul Palco
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {tipoChiamata === "libera" && (
                      <>
                        <input
                          type="text"
                          value={ricerca}
                          onChange={(e) => setRicerca(e.target.value)}
                          placeholder="Cerca nella lista calciatori per nome o squadra..."
                          autoFocus
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-amber-400"
                        />

                        <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/70">
                          {giocatoriDisponibili.slice(0, 60).map((g) => {
                            const rVis = getRuoloDisplay(g);
                            const inWl = Boolean(watchlistMap[`calc_${g.id}`]);
                            return (
                              <div
                                key={g.id}
                                className="p-3 hover:bg-slate-800 flex items-center justify-between transition gap-2"
                              >
                                <div onClick={() => portaSulPalco(g)} className="flex items-center gap-3 flex-1 cursor-pointer">
                                  <span
                                    className={`px-2 py-1 rounded font-black text-[11px] ${badgeRuolo(rVis)}`}
                                  >
                                    {rVis}
                                  </span>
                                  <div>
                                    <div className="font-bold text-white text-sm">{g.nome}</div>
                                    <div className="text-[11px] text-slate-400 uppercase">{g.squadra}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                                    Quot: <strong className="text-amber-400">{g.quotazioneBase}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => apriEditorWatchlist(g)}
                                    className={`px-2 py-1 rounded text-xs font-bold ${
                                      inWl ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 hover:text-amber-400"
                                    }`}
                                    title="Aggiungi/Modifica nella tua Watchlist Privata"
                                  >
                                    ★
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => portaSulPalco(g)}
                                    className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-xs font-bold"
                                  >
                                    Chiama
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </section>
                ) : (
                  <section className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-5 space-y-5 shadow-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-2 rounded-xl font-black text-base ${badgeRuolo(
                            getRuoloDisplay(giocatoreSelezionato)
                          )}`}
                        >
                          {getRuoloDisplay(giocatoreSelezionato)}
                        </span>
                        <div>
                          <h2 className="text-2xl font-black text-white">{giocatoreSelezionato.nome}</h2>
                          <div className="text-xs text-slate-400">
                            {giocatoreSelezionato.squadra} • Quot: {giocatoreSelezionato.quotazioneBase}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={annullaChiamataSulPalco}
                        className="bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/60 px-3.5 py-2 rounded-xl text-xs font-bold uppercase"
                      >
                        ✕ Annulla Chiamata
                      </button>
                    </div>

                    <div className="max-w-xs mx-auto text-center space-y-1">
                      <label className="block text-xs font-black text-slate-300 uppercase">
                        1. Inserisci Prezzo Pagato
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={prezzoAcquisto}
                        onChange={(e) => {
                          setPrezzoAcquisto(e.target.value);
                          setErroreAssegnazione("");
                        }}
                        placeholder="0"
                        autoFocus
                        className="w-full bg-slate-950 border-2 border-amber-500/70 rounded-xl py-3 px-4 text-center text-amber-400 font-black text-3xl focus:outline-none"
                      />
                    </div>

                    {erroreAssegnazione && (
                      <div className="bg-red-950/90 border border-red-700 text-red-200 text-xs font-bold p-3 rounded-xl text-center">
                        {erroreAssegnazione}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-center text-xs font-black text-slate-400 uppercase">
                        2. Clicca sulla Squadra Aggiudicataria
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {squadre.map((sq) => {
                          const chiaveRep = getChiaveReparto(giocatoreSelezionato);
                          const occupatiRuolo = (sq.rosa?.[chiaveRep] || []).length;
                          const maxRuolo = getMaxSlotChiave(chiaveRep);
                          const maxOff = getOffertaMassima(sq);
                          const bloccoEx = verificaDivietoExGiocatore(sq, giocatoreSelezionato.id);
                          const pieno = occupatiRuolo >= maxRuolo || maxOff < 1;

                          return (
                            <button
                              key={sq.id}
                              type="button"
                              disabled={pieno || salvando}
                              onClick={() => assegnaASquadra(sq)}
                              className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                                pieno
                                  ? "bg-slate-950/40 border-slate-800/50 opacity-40 cursor-not-allowed"
                                  : bloccoEx
                                  ? "bg-rose-950/30 border-rose-800/60 hover:border-rose-500 cursor-pointer"
                                  : "bg-slate-800 hover:bg-emerald-900/40 border-slate-700 hover:border-emerald-500 cursor-pointer"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                                  <span>{sq.nome}</span>
                                  {bloccoEx && (
                                    <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black uppercase">
                                      Ex Svincolato
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {chiaveRep}: {occupatiRuolo}/{maxRuolo} • Tot: {sq.giocatoriOccupati}/{sq.slotTotali}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-black text-amber-400">{sq.crediti} cr</div>
                                <div className="text-[10px] text-slate-400">Max {maxOff}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          {/* COLONNA DESTRA: STORICO ASSEGNAZIONI + WATCHLIST PRIVATA */}
          <aside className="lg:col-span-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl sticky top-4 space-y-3">
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRightSidebarTab("storico")}
                  className={`py-2 rounded-lg text-[11px] font-black uppercase transition ${
                    rightSidebarTab === "storico" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Assegnati ({storicoAssegnazioni.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRightSidebarTab("watchlist")}
                  className={`py-2 rounded-lg text-[11px] font-black uppercase transition ${
                    rightSidebarTab === "watchlist" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⭐ Miei Obiettivi ({watchlistArray.length})
                </button>
              </div>

              {rightSidebarTab === "storico" ? (
                <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-800/70 pr-1">
                  {storicoAssegnazioni.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-8 text-center">
                      Nessun calciatore assegnato finora.
                    </p>
                  ) : (
                    storicoAssegnazioni.map((item, idx) => (
                      <div key={`${item.id}_${idx}`} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 rounded font-black text-[9px] shrink-0 ${badgeRuolo(item.ruolo)}`}
                          >
                            {item.ruolo}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{item.nome}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              → <strong className="text-slate-200">{item.squadraNome}</strong> •{" "}
                              <span className="text-amber-400 font-bold">{item.prezzoPagato} cr</span>
                            </div>
                          </div>
                        </div>

                        {isAdminLega && (
                          <button
                            type="button"
                            onClick={() => annullaAssegnazioneSpecifica(item)}
                            className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0"
                          >
                            Annulla
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[10px] text-slate-400">
                    🔒 Lista privata visibile <strong>solo a te</strong> (sincronizzata sul tuo profilo).
                  </p>
                  <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
                    {watchlistArray.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-8 text-center">
                        Clicca sulla stella ★ accanto a un giocatore nel listone per aggiungerlo ai tuoi obiettivi!
                      </p>
                    ) : (
                      watchlistArray.map((w) => {
                        const giaPreso = idGiocatoriAcquistati.has(String(w.giocatoreId));
                        return (
                          <div
                            key={w.giocatoreId}
                            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                              giaPreso
                                ? "bg-slate-950/40 border-slate-800 opacity-50"
                                : "bg-slate-950 border-slate-800"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${badgeRuolo(w.ruolo)}`}>
                                  {w.ruolo}
                                </span>
                                <span className={`font-bold text-white truncate ${giaPreso ? "line-through" : ""}`}>
                                  {w.nome}
                                </span>
                              </div>
                              <span className="font-mono font-black text-amber-400 shrink-0">Max {w.budgetMax} cr</span>
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <span className="uppercase font-bold text-indigo-300">
                                {w.priorita === "top"
                                  ? "🔥 Top Obiettivo"
                                  : w.priorita === "titolare"
                                  ? "✅ Titolare"
                                  : "💎 Scommessa"}
                              </span>
                              <button
                                type="button"
                                onClick={() => rimuoviDaWatchlist(w.giocatoreId)}
                                className="text-red-400 hover:underline"
                              >
                                Rimuovi
                              </button>
                            </div>

                            {w.nota && <p className="text-[11px] text-slate-400 italic">{w.nota}</p>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* MODALE EDITOR OBIETTIVO WATCHLIST PRIVATA */}
      {showWatchlistModal && wlTargetPlayer && (
        <div
          onClick={() => setShowWatchlistModal(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 text-xs"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 uppercase">
                ⭐ Obiettivo Privato: {wlTargetPlayer.nome}
              </h3>
              <button onClick={() => setShowWatchlistModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={salvaInWatchlist} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Livello di Priorità</label>
                <select
                  value={wlPriorita}
                  onChange={(e) => setWlPriorita(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
                >
                  <option value="top">🔥 Top Obiettivo</option>
                  <option value="titolare">✅ Titolare Sicuro</option>
                  <option value="scommessa">💎 Scommessa / Low Cost</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Budget Massimo Personale (Crediti)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={wlBudgetMax}
                  onChange={(e) => setWlBudgetMax(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-400 font-black text-base"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nota Privata (es. coppia portieri)</label>
                <input
                  type="text"
                  placeholder="Visibile solo a te..."
                  value={wlNota}
                  onChange={(e) => setWlNota(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase py-3 rounded-xl"
              >
                Salva nei Miei Obiettivi
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}