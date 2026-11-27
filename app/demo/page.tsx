"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DemoPlayer {
  id: string;
  nome: string;
  ruolo: "P" | "D" | "C" | "A";
  squadra: string;
  quotazione: number;
}

interface DemoTeam {
  id: number;
  nome: string;
  crediti: number;
  acquisti: { nome: string; ruolo: string; prezzo: number }[];
}

const SAMPLE_PLAYERS: DemoPlayer[] = [
  { id: "1", nome: "Lautaro Martinez", ruolo: "A", squadra: "Inter", quotazione: 36 },
  { id: "2", nome: "Dusan Vlahovic", ruolo: "A", squadra: "Juventus", quotazione: 32 },
  { id: "3", nome: "Marcus Thuram", ruolo: "A", squadra: "Inter", quotazione: 31 },
  { id: "4", nome: "Rafael Leao", ruolo: "A", squadra: "Milan", quotazione: 29 },
  { id: "5", nome: "Christian Pulisic", ruolo: "C", squadra: "Milan", quotazione: 26 },
  { id: "6", nome: "Hakan Calhanoglu", ruolo: "C", squadra: "Inter", quotazione: 25 },
  { id: "7", nome: "Teun Koopmeiners", ruolo: "C", squadra: "Juventus", quotazione: 24 },
  { id: "8", nome: "Nicolò Barella", ruolo: "C", squadra: "Inter", quotazione: 22 },
  { id: "9", nome: "Federico Dimarco", ruolo: "D", squadra: "Inter", quotazione: 20 },
  { id: "10", nome: "Theo Hernandez", ruolo: "D", squadra: "Milan", quotazione: 19 },
  { id: "11", nome: "Alessandro Buongiorno", ruolo: "D", squadra: "Napoli", quotazione: 15 },
  { id: "12", nome: "Gleison Bremer", ruolo: "D", squadra: "Juventus", quotazione: 16 },
  { id: "13", nome: "Yann Sommer", ruolo: "P", squadra: "Inter", quotazione: 16 },
  { id: "14", nome: "Mike Maignan", ruolo: "P", squadra: "Milan", quotazione: 16 },
  { id: "15", nome: "Michele Di Gregorio", ruolo: "P", squadra: "Juventus", quotazione: 15 },
];

const INITIAL_TEAMS: DemoTeam[] = [
  { id: 0, nome: "Atletico Ma Non Troppo", crediti: 500, acquisti: [] },
  { id: 1, nome: "Real Madrink", crediti: 500, acquisti: [] },
  { id: 2, nome: "Bayer Leverbusen", crediti: 500, acquisti: [] },
  { id: 3, nome: "Dinamo Losca", crediti: 500, acquisti: [] },
  { id: 4, nome: "Scarsenal FC", crediti: 500, acquisti: [] },
  { id: 5, nome: "Paris San Gennaro", crediti: 500, acquisti: [] },
  { id: 6, nome: "Inter Net", crediti: 500, acquisti: [] },
  { id: 7, nome: "Aston Birra", crediti: 500, acquisti: [] },
];

export default function DemoSalaAstaPage() {
  const [teams, setTeams] = useState<DemoTeam[]>(INITIAL_TEAMS);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("TUTTI");
  const [currentPlayer, setCurrentPlayer] = useState<DemoPlayer | null>(SAMPLE_PLAYERS[0]);
  const [currentBid, setCurrentBid] = useState<number>(1);
  const [leadingTeamId, setLeadingTeamId] = useState<number>(0);
  const [timer, setTimer] = useState<number>(10);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [lastLog, setLastLog] = useState<string>("Simulazione pronta! Chiama un giocatore o prova un rilancio live.");

  useEffect(() => {
    if (!timerRunning || !currentPlayer) return;
    if (timer <= 0) {
      setTimerRunning(false);
      return;
    }
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timer, currentPlayer]);

  const availablePlayers = SAMPLE_PLAYERS.filter(
    (p) => !assignedIds.includes(p.id) && (roleFilter === "TUTTI" || p.ruolo === roleFilter)
  );

  const selectPlayer = (player: DemoPlayer) => {
    setCurrentPlayer(player);
    setCurrentBid(1);
    setLeadingTeamId(0);
    setTimer(10);
    setTimerRunning(true);
    setLastLog(`📢 Chiamato sul palco: ${player.nome} (${player.ruolo} - ${player.squadra})`);
  };

  const callRandomPlayer = () => {
    if (availablePlayers.length === 0) return;
    const rnd = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    selectPlayer(rnd);
  };

  const placeBid = (teamId: number, increment: number) => {
    if (!currentPlayer) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const nextBid = currentBid + increment;
    if (nextBid > team.crediti) {
      alert(`${team.nome} non ha abbastanza crediti!`);
      return;
    }
    setCurrentBid(nextBid);
    setLeadingTeamId(teamId);
    setTimer(10);
    setTimerRunning(true);
    setLastLog(`⚡ ${team.nome} rilancia a ${nextBid} crediti per ${currentPlayer.nome}!`);
  };

  const assignCurrentPlayer = () => {
    if (!currentPlayer) return;
    const winner = teams.find((t) => t.id === leadingTeamId);
    if (!winner) return;
    if (currentBid > winner.crediti) return;

    setTeams((prev) =>
      prev.map((t) =>
        t.id === winner.id
          ? {
              ...t,
              crediti: t.crediti - currentBid,
              acquisti: [...t.acquisti, { nome: currentPlayer.nome, ruolo: currentPlayer.ruolo, prezzo: currentBid }],
            }
          : t
      )
    );
    setAssignedIds((prev) => [...prev, currentPlayer.id]);
    setLastLog(`🔨 AGGIUDICATO! ${currentPlayer.nome} va a ${winner.nome} per ${currentBid} crediti.`);
    setTimerRunning(false);
    setCurrentPlayer(null);
  };

  const resetDemo = () => {
    setTeams(INITIAL_TEAMS);
    setAssignedIds([]);
    setCurrentPlayer(SAMPLE_PLAYERS[0]);
    setCurrentBid(1);
    setLeadingTeamId(0);
    setTimer(10);
    setTimerRunning(false);
    setLastLog("Demo azzerata! Pronto per una nuova simulazione.");
  };

  const roleColor = (r: string) => {
    if (r === "P") return "bg-yellow-500 text-slate-950";
    if (r === "D") return "bg-emerald-500 text-slate-950";
    if (r === "C") return "bg-blue-500 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Banner Demo */}
        <header className="bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                Modalità Demo Interattiva
              </span>
              <h1 className="text-lg md:text-xl font-black text-white">⚽ FantaAsta Pro • Sala Asta Live</h1>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Prova chiamata random, rilanci multi-squadra, timer automatico e calcolo crediti in tempo reale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetDemo}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl"
            >
              🔄 Azzera Demo
            </button>
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl"
            >
              ← Torna al Login
            </Link>
          </div>
        </header>

        {/* Barra Log Live */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-400 flex items-center justify-between">
          <span>{lastLog}</span>
          <span className="text-slate-500 font-mono">Svincolati rimasti: {SAMPLE_PLAYERS.length - assignedIds.length}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLONNA 1: LISTONE & CHIAMATA */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase text-white">Listone Giocatori</h2>
              <button
                type="button"
                onClick={callRandomPlayer}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase px-3 py-1.5 rounded-lg"
              >
                🎲 Chiama Random
              </button>
            </div>

            <div className="flex gap-1.5">
              {["TUTTI", "P", "D", "C", "A"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black ${
                    roleFilter === r ? "bg-indigo-600 text-white" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {availablePlayers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectPlayer(p)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    currentPlayer?.id === p.id
                      ? "bg-indigo-950/60 border-indigo-500"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${roleColor(p.ruolo)}`}>
                      {p.ruolo}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{p.nome}</p>
                      <p className="text-[10px] text-slate-400">{p.squadra}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">Quot. {p.quotazione}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COLONNA 2: PALCO ASTA LIVE */}
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xl">
            {currentPlayer ? (
              <>
                <div className="text-center space-y-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${roleColor(currentPlayer.ruolo)}`}>
                    Ruolo {currentPlayer.ruolo} • {currentPlayer.squadra}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-white">{currentPlayer.nome}</h2>
                  <p className="text-xs text-slate-400">Quotazione base: {currentPlayer.quotazione} cr</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                  <p className="text-[11px] uppercase text-slate-400 font-bold">Offerta Attuale</p>
                  <p className="text-4xl font-black text-amber-400 font-mono">{currentBid} cr</p>
                  <p className="text-xs text-emerald-400 font-bold">
                    In vantaggio: {teams.find((t) => t.id === leadingTeamId)?.nome}
                  </p>
                  <div className="pt-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full font-mono text-xs font-black ${
                        timer <= 3 ? "bg-red-600 text-white animate-pulse" : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      ⏱ Timer: {timer}s
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Simula Rilancio Rapido (+1 / +5):</p>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {teams.map((t) => (
                      <div key={t.id} className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-white truncate">{t.nome}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => placeBid(t.id, 1)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-2 py-1 rounded"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => placeBid(t.id, 5)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={assignCurrentPlayer}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-sm py-3.5 rounded-xl shadow-lg"
                >
                  🔨 Aggiudica Giocatore ({currentBid} cr)
                </button>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12">
                <p className="text-sm font-bold text-slate-300">Nessun calciatore sul palco</p>
                <p className="text-xs text-slate-400">Seleziona un nome dal listone a sinistra o clicca su Chiama Random.</p>
                <button
                  type="button"
                  onClick={callRandomPlayer}
                  className="bg-amber-500 text-slate-950 font-black uppercase text-xs px-4 py-2.5 rounded-xl"
                >
                  🎲 Chiama Prossimo Giocatore
                </button>
              </div>
            )}
          </div>

          {/* COLONNA 3: CREDITI & ROSE SQUADRE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-black uppercase text-white">Crediti &amp; Rose Live</h2>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {teams.map((t) => (
                <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-white">{t.nome}</span>
                    <span className="text-xs font-mono font-black text-emerald-400">{t.crediti} cr</span>
                  </div>
                  {t.acquisti.length === 0 ? (
                    <p className="text-[10px] text-slate-500">Nessun acquisto ancora</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {t.acquisti.map((a, idx) => (
                        <span key={idx} className="bg-slate-900 border border-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-200">
                          {a.nome} ({a.prezzo})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}