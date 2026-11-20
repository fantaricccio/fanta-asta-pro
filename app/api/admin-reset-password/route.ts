import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { emailUtente, nomeLega } = await req.json();

    if (!emailUtente) {
      return NextResponse.json({ ok: false, error: "Email mancante" }, { status: 400 });
    }

    // Genera password temporanea sicura (es. Fanta2026!842)
    const numCasuale = Math.floor(100 + Math.random() * 900);
    const tempPassword = `Fanta${new Date().getFullYear()}!${numCasuale}`;

    const resendKey = process.env.RESEND_API_KEY;
    let emailInviata = false;

    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FantaAsta Pro <onboarding@resend.dev>",
          to: [emailUtente],
          subject: `🔐 Password Temporanea - FantaAsta Pro`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-top: 0;">🔐 Reset Password FantaAsta Pro</h2>
              <p>Ciao,</p>
              <p>L'amministratore ha reimpostato le tue credenziali di accesso${nomeLega ? ` per la lega <strong>${nomeLega}</strong>` : ""}.</p>
              <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0; font-family: monospace; font-size: 16px;">
                <strong>Password temporanea:</strong> ${tempPassword}
              </div>
              <p style="font-size: 13px; color: #b45309;"><strong>Importante:</strong> Al primo accesso ti verrà chiesto obbligatoriamente di scegliere una nuova password personale.</p>
            </div>
          `,
        }),
      });
      if (res.ok) emailInviata = true;
    }

    return NextResponse.json({
      ok: true,
      tempPassword,
      emailInviata,
    });
  } catch (error) {
    console.error("Errore API reset password:", error);
    return NextResponse.json({ ok: false, error: "Errore interno" }, { status: 500 });
  }
}