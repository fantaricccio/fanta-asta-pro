"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ack = localStorage.getItem("fantaricccio_privacy_ack");
    if (!ack) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("fantaricccio_privacy_ack", new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs text-slate-300 space-y-3">
      <p className="leading-relaxed">
        Utilizziamo esclusivamente <strong>cookie tecnici e archiviazione locale</strong> necessari per l&apos;autenticazione e il funzionamento dell&apos;asta live, privi di profilazione pubblicitaria.{" "}
        <Link href="/privacy" className="text-amber-400 underline font-bold">
          Informativa Privacy & Cookie
        </Link>
        .
      </p>
      <div className="flex justify-end">
        <button
          onClick={handleAccept}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-[11px] px-4 py-2 rounded-xl transition"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}