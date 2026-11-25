"use client";

import React, { useState } from "react";

interface ChatMessage {
  sender: "ai" | "user";
  text: string;
}

const ADMIN_GUIDES = [
  {
    q: "1. Come importare le rose da Leghe Fantacalcio (Asta di Riparazione)?",
    a: "Apri il Pannello Admin di lega, clicca su 'Importa Rose Leghe FC', carica il file .xlsx o .csv scaricato da Fantacalcio.it e verifica i crediti residui. In 10 secondi tutte le squadre saranno pronte con i giocatori già acquistati.",
  },
  {
    q: "2. Come impostare modalità di chiamata e timer?",
    a: "Nelle Impostazioni Stanza puoi scegliere tra chiamata manuale (turno per turno), chiamata casuale per ruolo (P -> D -> C -> A) o random totale. Imposta il timer (es. 15s o 20s): ad ogni rilancio il timer riparte automaticamente.",
  },
  {
    q: "3. Come annullare un'offerta sbagliata o riassegnare un giocatore?",
    a: "Nel registro cronologia aste clicca su 'Annulla ultima offerta' per scalare il rilancio precedente, oppure apri la rosa della squadra e clicca 'Svincola' per riaccreditare i crediti e rimettere il giocatore sul mercato.",
  },
  {
    q: "4. Come esportare le rose a fine asta per Leghe FC?",
    a: "A fine asta clicca su 'Esporta Rose CSV/Excel': otterrai il file formattato pronto per l'importazione rapida nella sezione Admin della tua lega su Fantacalcio.it.",
  },
];

const PLAYER_GUIDES = [
  {
    q: "1. Come fare un'offerta durante l'asta?",
    a: "Quando un giocatore è sul banditore, usa i pulsanti rapidi (+1, +5, +10) oppure digita la cifra esatta e premi 'Offri'. Il sistema blocca automaticamente offerte superiori ai tuoi crediti massimi spendibili.",
  },
  {
    q: "2. Come vengono calcolati i crediti massimi spendibili?",
    a: "Per garantire che tu possa completare tutti gli slot della rosa (es. 3P, 8D, 8C, 6A), il sistema riserva automaticamente 1 credito per ogni slot ancora vuoto.",
  },
  {
    q: "3. Dove vedo le rose e i crediti degli avversari?",
    a: "Nella scheda 'Squadre & Crediti' puoi consultare in tempo reale quanti crediti restano a ciascun presidente e quanti slot mancano per ogni reparto.",
  },
];

function getSmartAssistantReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("riparazione") || q.includes("import") || q.includes("leghe") || q.includes("excel")) {
    return "Per l'Asta di Riparazione: scarica l'export delle rose da Leghe Fantacalcio (.xlsx o .csv), premi 'Importa Rose Leghe FC' nel pannello Admin e inserisci il budget iniziale (es. 500). Il sistema calcolerà automaticamente i crediti residui e caricherà tutti i giocatori già in rosa.";
  }
  if (q.includes("timer") || q.includes("secondi") || q.includes("rilancio")) {
    return "Consiglio un timer tra 15 e 20 secondi per aste online veloci, oppure 30 secondi per aste in presenza. Ad ogni nuovo rilancio il timer si resetta automaticamente sugli ultimi secondi impostati.";
  }
  if (q.includes("sbagli") || q.includes("annull") || q.includes("errore") || q.includes("svincol")) {
    return "Se un presidente ha offerto per errore, usa il tasto 'Annulla Offerta' nella barra di controllo Admin per tornare al rilancio precedente. Se il giocatore è già stato aggiudicato, vai nella sua rosa e usa 'Svincola' per restituire i crediti.";
  }
  if (q.includes("crediti") || q.includes("slot") || q.includes("500") || q.includes("1000")) {
    return "Imposta il budget (es. 500 o 1000) e il numero di slot per reparto (standard: 3 Portieri, 8 Difensori, 8 Centrocampisti, 6 Attaccanti). FantaAsta Pro impedirà automaticamente a chiunque di offrire più del budget disponibile meno 1 credito per ogni slot vuoto.";
  }
  if (q.includes("esport") || q.includes("fine asta")) {
    return "Al termine dell'asta clicca su 'Esporta Rose' nella dashboard Admin per scaricare il riepilogo completo con squadre, calciatori e prezzi d'acquisto da caricare su Fantacalcio.it.";
  }
  return "Posso aiutarti su: Importazione Rose da Leghe FC (Asta di Riparazione), configurazione Timer e Chiamate, gestione Crediti/Slot, annullamento offerte errate ed Export finale. Chiedimi pure il dettaglio che ti serve!";
}

export default function AstaHelpCopilot() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ai" | "admin" | "player">("ai");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: "Ciao! Sono l'Assistente di FantaAsta Pro. Chiedimi qualsiasi dubbio su impostazioni di lega, asta di riparazione, timer o gestione crediti!",
    },
  ]);

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    const reply = getSmartAssistantReply(userMsg);
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userMsg },
      { sender: "ai", text: reply },
    ]);
    setInput("");
  };

  return (
    <>
      {/* Pulsante Flottante ? Guida & AI */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-3 rounded-full shadow-2xl border border-indigo-400/40 flex items-center gap-2 transition"
      >
        <span className="text-sm">🤖</span>
        <span>Manuale & AI Admin</span>
      </button>

      {/* Drawer / Modale Laterale */}
      {open && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-5 text-slate-100 shadow-2xl">
            {/* Header */}
            <div className="space-y-3 border-b border-slate-800 pb-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2">
                  <span>📘</span> Guida Interattiva & Copilota AI
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-white text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-black uppercase">
                <button
                  onClick={() => setTab("ai")}
                  className={`py-1.5 rounded-lg transition ${
                    tab === "ai" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  🤖 Copilota AI
                </button>
                <button
                  onClick={() => setTab("admin")}
                  className={`py-1.5 rounded-lg transition ${
                    tab === "admin" ? "bg-amber-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Guida Admin
                </button>
                <button
                  onClick={() => setTab("player")}
                  className={`py-1.5 rounded-lg transition ${
                    tab === "player" ? "bg-amber-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Guida Player
                </button>
              </div>
            </div>

            {/* Contenuto Centrale */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 text-xs">
              {tab === "ai" && (
                <div className="space-y-3">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl leading-relaxed ${
                        m.sender === "ai"
                          ? "bg-slate-950 border border-indigo-500/30 text-slate-200"
                          : "bg-amber-500 text-slate-950 font-bold ml-8"
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
              )}

              {tab === "admin" &&
                ADMIN_GUIDES.map((g, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5"
                  >
                    <p className="font-black text-amber-400">{g.q}</p>
                    <p className="text-slate-300 leading-relaxed">{g.a}</p>
                  </div>
                ))}

              {tab === "player" &&
                PLAYER_GUIDES.map((g, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5"
                  >
                    <p className="font-black text-amber-400">{g.q}</p>
                    <p className="text-slate-300 leading-relaxed">{g.a}</p>
                  </div>
                ))}
            </div>

            {/* Input Chat AI */}
            {tab === "ai" && (
              <form onSubmit={handleAsk} className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Chiedi come impostare l'asta..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs px-4 rounded-xl"
                >
                  Chiedi
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}