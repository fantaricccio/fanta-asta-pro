import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { emailDestinatario, nomeLega, linkInvito, mittente } = await req.json();

    if (!emailDestinatario || !linkInvito) {
      return NextResponse.json({ ok: false, error: "Dati mancanti" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;

    // Se RESEND_API_KEY è configurata su Vercel, invia email reale dal server
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FantaAsta Pro <onboarding@resend.dev>",
          to: [emailDestinatario],
          subject: `⚽ Invito Lega Fantacalcio: ${nomeLega || "FantaAsta Pro"}`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-top: 0;">⚽ Sei stato invitato su FantaAsta Pro!</h2>
              <p>Ciao!</p>
              <p><strong>${mittente || "L'Admin"}</strong> ti ha invitato a partecipare alla lega <strong>${nomeLega}</strong>.</p>
              <p style="margin: 24px 0;">
                <a href="${linkInvito}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Scegli la tua Squadra ed Entra
                </a>
              </p>
              <p style="font-size: 12px; color: #64748b;">Oppure copia questo link nel browser:<br/>${linkInvito}</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        return NextResponse.json({ ok: false, fallbackMailto: true, error: errData }, { status: 200 });
      }

      return NextResponse.json({ ok: true, sentViaServer: true });
    }

    // Se RESEND_API_KEY non è ancora inserita, segnala al client di aprire mailto:
    return NextResponse.json({ ok: true, fallbackMailto: true });
  } catch (error) {
    console.error("Errore API invito:", error);
    return NextResponse.json({ ok: false, fallbackMailto: true }, { status: 200 });
  }
}