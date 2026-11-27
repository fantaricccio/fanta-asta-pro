"use client";

import React, { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowIosHelp(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs px-3.5 py-2 rounded-lg shadow transition flex items-center gap-1.5"
      >
        <span>📲</span>
        <span>Installa App</span>
      </button>

      {showIosHelp && (
        <div
          onClick={() => setShowIosHelp(false)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4 text-xs text-slate-200"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 uppercase">
                📲 Installa FantaAsta Pro su {isIos ? "iPhone / iPad" : "PC / Cellulare"}
              </h3>
              <button onClick={() => setShowIosHelp(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {isIos ? (
              <ol className="list-decimal pl-4 space-y-2 text-slate-300 leading-relaxed">
                <li>
                  Tocca l&apos;icona <strong>Condividi</strong> (il quadrato con la freccia verso l&apos;alto) nella barra in basso di Safari.
                </li>
                <li>
                  Scorri verso il basso e seleziona <strong>&ldquo;Aggiungi alla schermata Home&rdquo;</strong>.
                </li>
                <li>
                  Premi <strong>Aggiungi</strong> in alto a destra: avrai l&apos;icona <strong>FantaAsta Pro</strong> a schermo intero!
                </li>
              </ol>
            ) : (
              <ol className="list-decimal pl-4 space-y-2 text-slate-300 leading-relaxed">
                <li>
                  Clicca sull&apos;icona <strong>Installa App (monitor con freccia)</strong> nella barra dell&apos;indirizzo in alto a destra di Chrome/Edge.
                </li>
                <li>
                  Oppure apri il menu <strong>⋮ (3 puntini) → Salva e condividi → Installa FantaAsta Pro</strong>.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="w-full bg-amber-500 text-slate-950 font-black uppercase py-2.5 rounded-xl"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
}