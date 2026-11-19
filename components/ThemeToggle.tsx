"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("fantaasta_theme");
    if (saved === "light") {
      document.documentElement.classList.add("light-theme");
      setIsLight(true);
    }
  }, []);

  const toggleTheme = () => {
    const nextLight = !isLight;
    setIsLight(nextLight);
    if (nextLight) {
      document.documentElement.classList.add("light-theme");
      localStorage.setItem("fantaasta_theme", "light");
    } else {
      document.documentElement.classList.remove("light-theme");
      localStorage.setItem("fantaasta_theme", "dark");
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shrink-0"
      title={isLight ? "Passa al Tema Scuro (Notte Asta)" : "Passa al Tema Chiaro (Foglio Gara)"}
    >
      <span>{isLight ? "🌙 Scuro" : "☀️ Chiaro"}</span>
    </button>
  );
}