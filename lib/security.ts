/**
 * Sanitizza un URL immagine/logo accettando esclusivamente protocolli sicuri http:// o https://.
 * Restituisce stringa vuota se l'URL è malevolo o non valido.
 */
export function sanitizeImageUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Pulisce una stringa di testo generica rimuovendo caratteri di controllo HTML/script.
 */
export function sanitizeText(input: string | undefined | null, maxLength = 80): string {
  if (!input) return "";
  return String(input)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}