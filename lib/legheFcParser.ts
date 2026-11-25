import * as XLSX from "xlsx";

export interface ImportedPlayer {
  name: string;
  role: "P" | "D" | "C" | "A";
  teamSerieA?: string;
  pricePaid: number;
}

export interface ImportedFantaTeam {
  teamName: string;
  remainingCredits: number;
  totalSpent: number;
  players: ImportedPlayer[];
}

export interface LegheFcParseResult {
  teams: ImportedFantaTeam[];
  totalPlayers: number;
  warnings: string[];
}

function normalizeRole(raw: unknown): "P" | "D" | "C" | "A" | null {
  const val = String(raw || "").trim().toUpperCase();
  if (val === "P" || val.startsWith("POR")) return "P";
  if (val === "D" || val.startsWith("DIF")) return "D";
  if (val === "C" || val.startsWith("CEN")) return "C";
  if (val === "A" || val.startsWith("ATT")) return "A";
  return null;
}

/**
 * Analizza l'export ufficiale delle Rose di Leghe Fantacalcio (.xlsx / .xls / .csv).
 * Supporta sia il layout tabellare (Squadra | Ruolo | Calciatore | Squadra A | Pagato)
 * sia il layout classico a blocchi squadra con riga "Crediti Residui".
 */
export async function parseLegheFcFile(
  file: File,
  defaultBudget = 500
): Promise<LegheFcParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  const teamsMap = new Map<string, ImportedFantaTeam>();
  const warnings: string[] = [];

  // Rileva se il file è in formato tabellare con intestazione esplicita
  let headerRowIdx = -1;
  let colTeam = -1;
  let colRole = -1;
  let colPlayer = -1;
  let colSerieA = -1;
  let colPrice = -1;

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r].map((c) => String(c || "").trim().toLowerCase());
    const idxPlayer = row.findIndex((c) => c.includes("calciatore") || c === "nome");
    const idxRole = row.findIndex((c) => c === "ruolo" || c === "r");
    if (idxPlayer !== -1 && idxRole !== -1) {
      headerRowIdx = r;
      colPlayer = idxPlayer;
      colRole = idxRole;
      colTeam = row.findIndex((c) => c.includes("fantasquadra") || c === "squadra");
      colSerieA = row.findIndex((c) => c.includes("club") || c.includes("serie"));
      colPrice = row.findIndex(
        (c) => c.includes("pagato") || c.includes("costo") || c.includes("prezzo") || c.includes("valore")
      );
      break;
    }
  }

  if (headerRowIdx !== -1 && colTeam !== -1) {
    // Modalità 1: Tabella unica con colonna Fantasquadra
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      const teamName = String(row[colTeam] || "").trim();
      const playerName = String(row[colPlayer] || "").trim();
      const role = normalizeRole(row[colRole]);
      if (!teamName || !playerName || !role) continue;

      const pricePaid = colPrice !== -1 ? Number(row[colPrice]) || 1 : 1;
      const teamSerieA = colSerieA !== -1 ? String(row[colSerieA] || "").trim() : "";

      if (!teamsMap.has(teamName)) {
        teamsMap.set(teamName, {
          teamName,
          remainingCredits: defaultBudget,
          totalSpent: 0,
          players: [],
        });
      }

      const team = teamsMap.get(teamName)!;
      team.players.push({ name: playerName, role, teamSerieA, pricePaid });
      team.totalSpent += pricePaid;
      team.remainingCredits = Math.max(0, defaultBudget - team.totalSpent);
    }
  } else {
    // Modalità 2: Export classico Leghe FC a blocchi affiancati o verticali
    const numCols = rows.reduce((max, r) => Math.max(max, r.length), 0);

    // Scansiona colonne a blocchi cercando intestazioni squadra + righe [Ruolo, Calciatore, Squadra, Costo]
    for (let c = 0; c < numCols; c++) {
      let currentTeam: ImportedFantaTeam | null = null;

      for (let r = 0; r < rows.length; r++) {
        const cell0 = String(rows[r][c] || "").trim();
        const cell1 = String(rows[r][c + 1] || "").trim();
        const cell2 = String(rows[r][c + 2] || "").trim();
        const cell3 = String(rows[r][c + 3] || "").trim();

        if (!cell0 && !cell1) continue;

        // Riga "Crediti Residui"
        if (cell0.toLowerCase().includes("crediti") && currentTeam) {
          const parsedCredits = parseInt(cell1.replace(/\D/g, ""), 10);
          if (!isNaN(parsedCredits)) {
            currentTeam.remainingCredits = parsedCredits;
          }
          continue;
        }

        const role = normalizeRole(cell0);
        if (role && cell1 && cell1.toLowerCase() !== "calciatore") {
          if (!currentTeam) {
            const fallbackName = `Squadra Colonna ${c + 1}`;
            currentTeam = {
              teamName: fallbackName,
              remainingCredits: defaultBudget,
              totalSpent: 0,
              players: [],
            };
            teamsMap.set(fallbackName, currentTeam);
          }

          const pricePaid = parseInt(cell3.replace(/\D/g, ""), 10) || parseInt(cell2.replace(/\D/g, ""), 10) || 1;
          const teamSerieA = isNaN(Number(cell2)) ? cell2 : "";

          currentTeam.players.push({
            name: cell1,
            role,
            teamSerieA,
            pricePaid,
          });
          currentTeam.totalSpent += pricePaid;
        } else if (
          cell0 &&
          !role &&
          !cell0.toLowerCase().includes("ruolo") &&
          !cell0.toLowerCase().includes("totale") &&
          r + 1 < rows.length
        ) {
          // Verifica se la riga successiva o quella dopo contiene un ruolo (indica titolo squadra)
          const nextRole = normalizeRole(rows[r + 1]?.[c]) || normalizeRole(rows[r + 2]?.[c]);
          if (nextRole) {
            if (!teamsMap.has(cell0)) {
              teamsMap.set(cell0, {
                teamName: cell0,
                remainingCredits: defaultBudget,
                totalSpent: 0,
                players: [],
              });
            }
            currentTeam = teamsMap.get(cell0)!;
          }
        }
      }
    }

    // Se "Crediti Residui" non era esplicito nel file, li calcola da defaultBudget - totalSpent
    teamsMap.forEach((team) => {
      if (team.remainingCredits === defaultBudget && team.totalSpent > 0) {
        team.remainingCredits = Math.max(0, defaultBudget - team.totalSpent);
      }
    });
  }

  const teams = Array.from(teamsMap.values()).filter((t) => t.players.length > 0);
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

  if (teams.length === 0) {
    warnings.push(
      "Nessuna rosa riconosciuta automaticamente. Verifica che il file contenga le colonne Ruolo, Calciatore e Costo."
    );
  }

  return { teams, totalPlayers, warnings };
}