import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-2xl md:text-3xl font-black text-white">
            Privacy, Cookie & Termini di Utilizzo
          </h1>
          <Link
            href="/"
            className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-3.5 py-2 rounded-lg text-xs font-bold uppercase transition"
          >
            ← Torna all&apos;App
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          Ultimo aggiornamento: Versione 1.0 • Titolare del trattamento: <strong>Fantaricccio / FantaAsta Pro</strong> (Email di contatto:{" "}
          <span className="text-amber-400">fantaricccio@gmail.com</span>)
        </p>

        <section className="space-y-2 text-sm leading-relaxed text-slate-300">
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            1. Dati Raccolti e Finalità
          </h2>
          <p>
            L&apos;applicazione <strong>FantaAsta Pro</strong> raccoglie esclusivamente i dati strettamente necessari all&apos;erogazione del servizio di gestione aste e leghe fantacalcistiche:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Nome, nickname o denominazione della squadra di fantacalcio;</li>
            <li>Indirizzo email fornito volontariamente per l&apos;autenticazione, la creazione o l&apos;invito alle leghe e l&apos;assistenza tecnica;</li>
            <li>Dati tecnici di gioco (rose, crediti, offerte d&apos;asta in tempo reale e log delle operazioni di lega).</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-300">
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            2. Base Giuridica e Conservazione
          </h2>
          <p>
            Il trattamento dei dati si basa sull&apos;esecuzione del servizio richiesto dall&apos;utente (Art. 6.1.b GDPR). I dati sono ospitati su infrastrutture cloud sicure (<strong>Google Firebase</strong> e <strong>Vercel</strong>) e conservati per il tempo necessario allo svolgimento delle stagioni fantacalcistiche o fino a richiesta di cancellazione.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-300">
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            3. Cookie e Strumenti Tecnici
          </h2>
          <p>
            Questa applicazione utilizza esclusivamente cookie tecnici e memoria locale del browser (<code>localStorage</code>) indispensabili per mantenere attiva la sessione dell&apos;utente, salvare l&apos;ID della lega attiva e le preferenze grafiche. Non vengono utilizzati cookie di profilazione pubblicitaria di terze parti.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-300">
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            4. Diritti dell&apos;Utente (Artt. 15-22 GDPR)
          </h2>
          <p>
            In conformità al Regolamento UE 2016/679 (GDPR), l&apos;utente può richiedere in qualsiasi momento l&apos;accesso, la rettifica, la portabilità o la cancellazione definitiva dei propri dati scrivendo a{" "}
            <strong className="text-amber-400">fantaricccio@gmail.com</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}