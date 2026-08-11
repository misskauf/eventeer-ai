import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/app-brand";
import {
  useTranslation,
  setAppLanguage,
  readStoredLang,
  applyStoredLanguage,
  type AppLang,
} from "@/i18n";

export const LEGAL_EMAIL = "keren@dressedforpeace.com";
export const LEGAL_PHONE = "+49 1575 5175818";
export const LAST_UPDATED = { de: "Stand: 11. August 2026", en: "Last updated: 11 August 2026" };

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-lg font-semibold tracking-tight">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

/* ---------------------------------- Impressum --------------------------------- */

export function ImpressumDE() {
  return (
    <>
      <H2>Angaben gemäß § 5 DDG</H2>
      <P>
        Keren Kaufman
        <br />
        Eventeer
        <br />
        Urbanstraße 71
        <br />
        10967 Berlin
        <br />
        Deutschland
      </P>

      <H2>Kontakt</H2>
      <P>
        Telefon: {LEGAL_PHONE}
        <br />
        E-Mail: <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
      </P>

      <H2>Umsatzsteuer-Identifikationsnummer</H2>
      <P>
        Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: DE450749146
      </P>

      <H2>Verbraucherstreitbeilegung</H2>
      <P>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </P>

      <H2>Haftung für Inhalte</H2>
      <P>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach
        den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter
        jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
        oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst
        ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
        entsprechender Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </P>

      <H2>Haftung für Links</H2>
      <P>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
        Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
        Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
        Seiten verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links
        umgehend entfernen.
      </P>

      <H2>Urheberrecht</H2>
      <P>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
        deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
        Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
        des jeweiligen Autors bzw. Erstellers.
      </P>
    </>
  );
}

export function ImpressumEN() {
  return (
    <>
      <H2>Information pursuant to § 5 DDG</H2>
      <P>
        Keren Kaufman
        <br />
        Eventeer
        <br />
        Urbanstraße 71
        <br />
        10967 Berlin
        <br />
        Germany
      </P>

      <H2>Contact</H2>
      <P>
        Phone: {LEGAL_PHONE}
        <br />
        Email: <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
      </P>

      <H2>VAT identification number</H2>
      <P>
        VAT identification number pursuant to § 27 a of the German VAT Act (Umsatzsteuergesetz):
        DE450749146
      </P>

      <H2>Consumer dispute resolution</H2>
      <P>
        We are neither willing nor obliged to take part in dispute resolution proceedings before a
        consumer arbitration board.
      </P>

      <H2>Liability for content</H2>
      <P>
        As a service provider, we are responsible for our own content on these pages under the
        general laws in accordance with § 7 para. 1 DDG. Under §§ 8 to 10 DDG, however, we are not
        obliged as a service provider to monitor third-party information transmitted or stored, or
        to investigate circumstances that indicate unlawful activity. Obligations to remove or block
        the use of information under the general laws remain unaffected. Liability in this respect
        is only possible from the point in time at which we become aware of a specific infringement.
        If we become aware of any such infringements, we will remove the content in question
        immediately.
      </P>

      <H2>Liability for links</H2>
      <P>
        Our website contains links to external third-party websites over whose content we have no
        control. We therefore cannot accept any liability for this third-party content. The
        respective provider or operator of the linked pages is always responsible for their content.
        If we become aware of any legal infringements, we will remove such links immediately.
      </P>

      <H2>Copyright</H2>
      <P>
        The content and works created by the site operators on these pages are subject to German
        copyright law. Reproduction, editing, distribution and any kind of use beyond the limits of
        copyright law require the written consent of the respective author or creator.
      </P>
    </>
  );
}

/* -------------------------------- Datenschutz -------------------------------- */

export function DatenschutzDE() {
  return (
    <>
      <H2>1. Verantwortlicher</H2>
      <P>
        Keren Kaufman, Urbanstraße 71, 10967 Berlin, Deutschland. E-Mail:{" "}
        <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>, Telefon:{" "}
        {LEGAL_PHONE}. Ein Datenschutzbeauftragter ist nicht bestellt; die gesetzlichen
        Voraussetzungen hierfür liegen nicht vor.
      </P>

      <H2>2. Grundsätzliches</H2>
      <P>
        Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung dieser Website
        und unserer Leistungen erforderlich ist oder Sie eingewilligt haben. Rechtsgrundlagen sind
        insbesondere Art. 6 Abs. 1 lit. a, b und f DSGVO.
      </P>

      <H2>3. Hosting, Datenbank und Auftragsverarbeitung</H2>
      <P>
        Diese Website und die zugehörige Anwendung werden von Lovable Labs Incorporated, 1 Lincoln
        St, Boston, MA 02111, USA, bereitgestellt und betrieben. Lovable verarbeitet
        personenbezogene Daten in unserem Auftrag als Auftragsverarbeiter; es gelten die
        Auftragsverarbeitungsbedingungen des Anbieters nach Art. 28 DSGVO. Für die Datenbank und die
        Authentifizierung setzt Lovable Supabase als Unterauftragsverarbeiter ein. Da der Anbieter
        seinen Sitz in den USA hat, findet eine Verarbeitung personenbezogener Daten außerhalb der
        EU bzw. des EWR statt. Grundlage hierfür sind die Standardvertragsklauseln der
        EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO) beziehungsweise ein Angemessenheitsbeschluss
        (Art. 45 DSGVO). Die Übertragung erfolgt durchgängig verschlüsselt (TLS); die Daten werden
        auch im Ruhezustand verschlüsselt gespeichert. Der Zugriff auf die Datenbank ist durch
        Zugriffsregeln auf Datenbankebene beschränkt.
      </P>

      <H2>4. Server-Logfiles</H2>
      <P>
        Beim Aufruf dieser Website werden automatisch Informationen verarbeitet, die Ihr Browser
        übermittelt: IP-Adresse, Datum und Uhrzeit der Anfrage, aufgerufene Seite, Referrer-URL,
        Browsertyp und Betriebssystem. Diese Daten sind technisch erforderlich, um die Website
        stabil und sicher auszuliefern. Rechtsgrundlage ist unser berechtigtes Interesse an einem
        sicheren und funktionsfähigen Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Eine Zusammenführung mit
        anderen Datenquellen erfolgt nicht.
      </P>

      <H2>5. Fehlerprotokolle</H2>
      <P>
        Tritt in der Anwendung ein technischer Fehler auf, werden Fehlerinformationen (u. a.
        Fehlermeldung, aufgerufene Seite, technische Umgebungsdaten) an unseren Betriebsdienstleister
        übermittelt, um den Fehler beheben zu können. Rechtsgrundlage ist unser berechtigtes
        Interesse an einem funktionsfähigen und sicheren Dienst (Art. 6 Abs. 1 lit. f DSGVO).
      </P>

      <H2>6. Demo-Anfrage (Formular)</H2>
      <P>
        Wenn Sie über das Formular auf dieser Website eine Demo anfragen, verarbeiten wir: Name,
        Location bzw. Unternehmen, geschäftliche E-Mail-Adresse, Telefonnummer, Ihre Rolle in der
        Location, Art der Location, Angabe zur aktuell genutzten Software, Ihre optionale Nachricht,
        die gewählte Sprachfassung, Ihre Einwilligung sowie den Zeitpunkt der Absendung.
      </P>
      <P>
        Zweck: Bearbeitung Ihrer Anfrage, Kontaktaufnahme sowie Vorbereitung und Zuschnitt der
        angefragten Demo.
      </P>
      <P>
        Rechtsgrundlage: Durchführung vorvertraglicher Maßnahmen auf Ihre Anfrage hin (Art. 6 Abs. 1
        lit. b DSGVO). Ihre zusätzlich erteilte Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) betrifft
        die Speicherung Ihrer Angaben zur weiteren Kontaktaufnahme über die konkrete Anfrage hinaus.
      </P>
      <P>
        Speicherdauer: bis der Zweck entfällt, spätestens zwölf Monate nach dem letzten Kontakt,
        sofern keine Geschäftsbeziehung zustande kommt und keine gesetzlichen Aufbewahrungsfristen
        entgegenstehen.
      </P>
      <P>
        Widerruf: Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft formlos per
        E-Mail an <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>{" "}
        widerrufen. Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.
      </P>
      <P>
        Zum Schutz vor automatisierten Einsendungen enthält das Formular ein unsichtbares Feld
        (Honeypot). Zusätzliche personenbezogene Daten werden dadurch nicht erhoben.
      </P>

      <H2>7. Speicherung im Browser / Cookies</H2>
      <P>
        Diese Website setzt keine Tracking- oder Marketing-Cookies ein. Ihre gewählte Sprache wird
        lokal in Ihrem Browser gespeichert, damit die Seite beim nächsten Besuch in der richtigen
        Sprache erscheint. Diese Speicherung ist für die von Ihnen ausdrücklich gewünschte Funktion
        erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und bedarf keiner Einwilligung. Sie können sie
        jederzeit über Ihre Browsereinstellungen löschen.
      </P>

      <H2>8. Kontaktaufnahme per E-Mail</H2>
      <P>
        Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre Angaben zur Bearbeitung der
        Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Die Daten werden gelöscht, sobald sie
        nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.
      </P>

      <H2>9. Empfänger der Daten</H2>
      <P>
        Eine Weitergabe erfolgt ausschließlich an den unter Ziffer 3 genannten Auftragsverarbeiter
        (Lovable Labs Incorporated) und dessen Unterauftragsverarbeiter (Supabase) im Rahmen der
        Auftragsverarbeitung. Ein Verkauf Ihrer Daten oder eine Weitergabe zu Werbezwecken an Dritte
        findet nicht statt.
      </P>

      <H2>10. Ihre Rechte</H2>
      <P>
        Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art.
        17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch
        gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21) sowie auf Widerruf
        erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO). Eine formlose
        Nachricht an <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>{" "}
        genügt.
      </P>

      <H2>11. Beschwerderecht bei der Aufsichtsbehörde</H2>
      <P>
        Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig
        ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61,
        10555 Berlin.
      </P>

      <H2>12. Änderungen dieser Datenschutzerklärung</H2>
      <P>
        Wir passen diese Datenschutzerklärung an, sobald sich die Rechtslage oder unsere
        Verarbeitung ändert — etwa wenn wir Analyse-Werkzeuge oder Zahlungsdienstleister einbinden.
      </P>
    </>
  );
}

export function DatenschutzEN() {
  return (
    <>
      <H2>1. Controller</H2>
      <P>
        Keren Kaufman, Urbanstraße 71, 10967 Berlin, Germany. Email:{" "}
        <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>, phone:{" "}
        {LEGAL_PHONE}. No data protection officer has been appointed, as the legal requirements for
        doing so are not met.
      </P>

      <H2>2. General principles</H2>
      <P>
        We process personal data only where this is necessary to provide this website and our
        services, or where you have given your consent. The legal bases are in particular Art. 6(1)
        (a), (b) and (f) GDPR.
      </P>

      <H2>3. Hosting, database and processing on our behalf</H2>
      <P>
        This website and its database are operated by external service providers: Lovable (provision
        and operation of the application) and Supabase (database and authentication). These
        providers process data solely on our documented instructions on the basis of data processing
        agreements under Art. 28 GDPR. Where personal data is transferred to a country outside the
        EU or EEA, this takes place on the basis of the EU Commission's standard contractual clauses
        (Art. 46(2)(c) GDPR) or an adequacy decision (Art. 45 GDPR). Data is transmitted encrypted
        end to end (TLS) and is also stored encrypted at rest. Access to the database is restricted
        by access rules enforced at database level.
      </P>

      <H2>4. Server log files</H2>
      <P>
        When you visit this website, information transmitted by your browser is processed
        automatically: IP address, date and time of the request, the page requested, referrer URL,
        browser type and operating system. This data is technically necessary to deliver the website
        reliably and securely. The legal basis is our legitimate interest in secure and functional
        operation (Art. 6(1)(f) GDPR). This data is not combined with other data sources.
      </P>

      <H2>5. Error logs</H2>
      <P>
        If a technical error occurs in the application, error information (including the error
        message, the page in use and technical environment data) is transmitted to our operations
        provider so the issue can be fixed. The legal basis is our legitimate interest in a
        functional and secure service (Art. 6(1)(f) GDPR).
      </P>

      <H2>6. Demo request (form)</H2>
      <P>
        If you request a demo via the form on this website, we process: your name, venue or company,
        business email address, phone number, your role at the venue, the type of venue, details of
        the software you currently use, your optional message, the language version you selected,
        your consent, and the time of submission.
      </P>
      <P>
        Purpose: handling your enquiry, contacting you, and preparing and tailoring the requested
        demo.
      </P>
      <P>
        Legal basis: steps taken at your request prior to entering into a contract (Art. 6(1)(b)
        GDPR). The consent you additionally give (Art. 6(1)(a) GDPR) covers storing your details for
        further contact beyond the specific enquiry.
      </P>
      <P>
        Retention: until the purpose no longer applies, and at the latest twelve months after the
        last contact, provided no business relationship comes about and no statutory retention
        periods apply.
      </P>
      <P>
        Withdrawal: you may withdraw your consent at any time with effect for the future, informally
        by email to <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. The
        lawfulness of processing carried out up to that point remains unaffected.
      </P>
      <P>
        To protect against automated submissions, the form contains an invisible field (honeypot).
        No additional personal data is collected as a result.
      </P>

      <H2>7. Browser storage / cookies</H2>
      <P>
        This website does not use tracking or marketing cookies. Your chosen language is stored
        locally in your browser so the site appears in the right language on your next visit. This
        storage is strictly necessary for a function you explicitly requested (§ 25(2) no. 2 TDDDG)
        and does not require consent. You can delete it at any time via your browser settings.
      </P>

      <H2>8. Contact by email</H2>
      <P>
        If you contact us by email, we process the details you provide in order to handle your
        enquiry (Art. 6(1)(b) or (f) GDPR). The data is deleted once it is no longer required and no
        statutory retention obligations apply.
      </P>

      <H2>9. Recipients of the data</H2>
      <P>
        Data is disclosed only to the service providers named in section 3, acting as processors on
        our behalf. We do not sell your data or pass it on to third parties for advertising
        purposes.
      </P>

      <H2>10. Your rights</H2>
      <P>
        You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17),
        restriction of processing (Art. 18), data portability (Art. 20), objection to processing
        based on legitimate interests (Art. 21), and to withdraw consent with effect for the future
        (Art. 7(3) GDPR). An informal message to{" "}
        <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> is sufficient.
      </P>

      <H2>11. Right to lodge a complaint with a supervisory authority</H2>
      <P>
        You have the right to lodge a complaint with a data protection supervisory authority. The
        competent authority is the Berlin Commissioner for Data Protection and Freedom of
        Information (Berliner Beauftragte für Datenschutz und Informationsfreiheit), Alt-Moabit
        59–61, 10555 Berlin, Germany.
      </P>

      <H2>12. Changes to this privacy policy</H2>
      <P>
        We will update this privacy policy whenever the legal situation or our processing changes —
        for example if we integrate analytics tools or payment providers.
      </P>
      <P>In case of discrepancies, the German version prevails.</P>
    </>
  );
}

/* --------------------------------- Page shell -------------------------------- */

export function LegalPage({
  titleDe,
  titleEn,
  children,
}: {
  titleDe: string;
  titleEn: string;
  children: (lang: AppLang) => ReactNode;
}) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<AppLang>("en");

  useEffect(() => {
    applyStoredLanguage();
    setLang(readStoredLang());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const pickLang = (l: AppLang) => {
    setAppLanguage(l);
    setLang(l);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Link to="/">
            <img
              src="/eventeer-logo.svg"
              alt={`${APP_NAME} logo`}
              className="h-7 w-auto sm:h-8"
              width={376}
              height={96}
            />
          </Link>
          <div
            role="group"
            aria-label={t("common.language")}
            className="flex overflow-hidden rounded-md border"
          >
            {(["en", "de"] as AppLang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => pickLang(l)}
                aria-pressed={lang === l}
                className={
                  "px-2 py-1 text-xs font-medium uppercase transition-colors " +
                  (lang === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent")
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          {lang === "de" ? titleDe : titleEn}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">{LAST_UPDATED[lang]}</p>
        <div className="mt-2">{children(lang)}</div>
        <Link to="/" className="mt-12 inline-block">
          <Button variant="outline" size="sm">
            ← {APP_NAME}
          </Button>
        </Link>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. {t("landing.footer.rights")}
          </p>
          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/impressum" className="hover:text-foreground">
              {t("landing.footer.impressum")}
            </Link>
            <Link to="/datenschutz" className="hover:text-foreground">
              {t("landing.footer.datenschutz")}
            </Link>
            <a href={`mailto:${LEGAL_EMAIL}`} className="hover:text-foreground">
              {t("landing.footer.contact")}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center gap-2 text-xs text-muted-foreground ${className}`}>
      <Link to="/impressum" className="hover:text-foreground">
        Impressum
      </Link>
      <span aria-hidden>·</span>
      <Link to="/datenschutz" className="hover:text-foreground">
        Datenschutz
      </Link>
    </div>
  );
}
