"use client";

import React, { useState } from "react";
import {
  parseLegheFcFile,
  LegheFcParseResult,
  ImportedFantaTeam,
} from "@/lib/legheFcParser";

interface ImportLegheFcModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBudget?: number;
  onConfirmImport: (teams: ImportedFantaTeam[]) => Promise<void> | void;
}

export default function ImportLegheFcModal({
  isOpen,
  onClose,
  defaultBudget = 500,
  onConfirmImport,
}: ImportLegheFcModalProps) {
  const [budget, setBudget] = useState(defaultBudget);
  const [result, setResult] = useState<LegheFcParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseLegheFcFile(file, budget);
      setResult(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!result || result.teams.length === 0) return;
    setImporting(true);
    try {
      await onConfirmImport(result.teams);
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-3xl w-full space-y-5 text-slate-100 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white uppercase">
              📥 Importa Rose da Leghe Fantacalcio (Asta di Riparazione)
            </h3>
            <p className="text-xs text-slate-400">
              Carica il file .xlsx o .csv esportato da Leghe FC per importare squadre, giocatori e crediti residui.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Budget Iniziale di Lega (usato se il file non riporta i crediti residui)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) || 500)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="cursor-pointer flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs py-2.5 px-4 rounded-xl transition">
              <span>{loading ? "Analisi file in corso..." : "Seleziona File Leghe FC (.xlsx / .csv)"}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {result && (
          <div className="space-y-3">
            {result.warnings.map((w, i) => (
              <div
                key={i}
                className="bg-amber-950/70 border border-amber-700 text-amber-200 text-xs p-3 rounded-xl"
              >
                ⚠️ {w}
              </div>
            ))}

            {result.teams.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-xl font-bold">
                  <span>✅ Rilevate {result.teams.length} Fantasquadre</span>
                  <span>{result.totalPlayers} Calciatori in rosa</span>
                </div>

                <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
                  {result.teams.map((t, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center font-black">
                        <span className="text-white truncate">{t.teamName}</span>
                        <span className="text-amber-400">Residui: {t.remainingCredits} cr</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        {t.players.length} giocatori • Spesi: {t.totalSpent} cr
                      </p>
                      <p className="text-slate-500 text-[10px] truncate">
                        {t.players.map((p) => `${p.name} (${p.role})`).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={!result || result.teams.length === 0 || importing}
            onClick={handleApply}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black uppercase text-xs px-5 py-2.5 rounded-xl transition"
          >
            {importing ? "Importazione in corso..." : "Conferma e Carica Rose nella Stanza"}
          </button>
        </div>
      </div>
    </div>
  );
}