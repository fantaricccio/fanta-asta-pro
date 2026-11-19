"use client";

import { useState } from "react";
import { ref, push, set } from "firebase/database";
import { db, auth } from "../lib/firebase";
import { sanitizeText } from "../lib/security";

const SUPPORT_EMAIL = "fantaricccio@gmail.com";
const SUPPORT_WHATSAPP_NUMBER = ""; // Inserisci qui il tuo numero con prefisso es. "393331234567" se vuoi link diretto al tuo numero

export default function SupportModal({ nomeLega = "" }: { nomeLega?: string }) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState("Problema Tecnico / Bug");
  const [messaggio, setMessaggio] = useState("");
  const [inviato, setInviato] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState(false);

  const userEmail = auth.currentUser?.email || "Utente non loggato";

  const inviaSegnalazioneInApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messaggio.trim()) return;

    setInvioInCorso(true);
    try {
      const ticketRef = push(ref(db, "impostazioni_globali/ticket_supporto"));
      await set(ticketRef, {
        utenteEmail: userEmail,
        nomeLega: nomeLega || "Generale",
        categoria,
        messaggio: sanitizeText(messaggio, 1000),
        stato: "aperto",
        createdAt: new Date().toISOString(),
      });
      setInviato(true);
      setMessaggio("");
      setTimeout(() => {
        setInviato(false);
        setOpen(false);
      }, 2200);
    } catch {
      alert("Errore durante l'invio della segnalazione.");
    } finally {
      setInvioInCorso(false);
    }
  };

  const apriEmailSupporto = () => {
    const subject = `[Supporto FantaAsta Pro] ${categoria} - ${nomeLega || userEmail}`;
    const body = `Utente: ${userEmail}\nLega: ${nomeLega || "-"}\nCategoria: ${categoria}\n\nDescrizione:\n${messaggio}`;
    window.open(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank"
    );
  };

  const apriWhatsAppSupporto = () => {
    const testo = `Ciao Supporto FantaAsta Pro! (${userEmail}${nomeLega ? ` - Lega: ${nomeLega}` : ""})\nCategoria: ${categoria}\n${messaggio}`;
    const base = SUPPORT_WHATSAPP_NUMBER ? `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}` : `https://wa.me/`;
    window.open(`${base}?text=${encodeURIComponent(testo)}`, "_blank");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition shrink-0"
        title="Assistenza, segnalazioni e supporto"
      >
        🎧 Supporto
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-4 flex justify-between items-center">
              <h3 className="text-lg font-black text-white">Centro Supporto & Segnalazioni</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-black/30 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-6 space-y-4">
              {inviato ? (
                <div className="bg-emerald-950/70 border border-emerald-500 text-emerald-200 p-5 rounded-xl text-center space-y-1">
                  <div className="text-lg font-black">✅ Segnalazione Inviata!</div>
                  <p className="text-xs">Il Super Admin ha ricevuto la tua richiesta e ti risponderà al più presto.</p>
                </div>
              ) : (
                <form onSubmit={inviaSegnalazioneInApp} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Tipo di Richiesta
                    </label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-xs text-white font-bold"
                    >
                      <option value="Problema Tecnico / Bug">Problema Tecnico / Bug</option>
                      <option value="Acquisto / Rinnovo Licenza Admin">Acquisto / Rinnovo Licenza Admin</option>
                      <option value="Recupero / Modifica Lega">Recupero / Modifica Lega</option>
                      <option value="Suggerimento Nuova Funzione">Suggerimento Nuova Funzione</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Descrivi il problema o la richiesta
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={messaggio}
                      onChange={(e) => setMessaggio(e.target.value)}
                      placeholder="Scrivi qui i dettagli..."
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={invioInCorso}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase py-3 rounded-xl text-xs shadow-lg"
                  >
                    {invioInCorso ? "Invio in corso..." : "Invia Segnalazione al Super Admin"}
                  </button>
                </form>
              )}

              <div className="pt-3 border-t border-slate-700 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={apriEmailSupporto}
                  className="bg-slate-900 hover:bg-slate-950 border border-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs"
                >
                  ✉️ Invia via Email
                </button>
                <button
                  type="button"
                  onClick={apriWhatsAppSupporto}
                  className="bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black py-2.5 rounded-xl text-xs"
                >
                  💬 Scrivi su WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}