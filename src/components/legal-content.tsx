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
        This website and the associated application are provided and operated by Lovable Labs
        Incorporated, 1 Lincoln St, Boston, MA 02111, USA. Lovable processes personal data on our
        behalf as a processor; the provider's data processing terms under Art. 28 GDPR apply. For
        the database and authentication, Lovable engages Supabase as a sub-processor. As the
        provider is based in the USA, personal data is processed outside the EU or EEA. This takes
        place on the basis of the EU Commission's standard contractual clauses (Art. 46(2)(c) GDPR)
        or an adequacy decision (Art. 45 GDPR). Data is transmitted encrypted end to end (TLS) and
        is also stored encrypted at rest. Access to the database is restricted by access rules
        enforced at database level.
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
        Data is disclosed only to the processor named in section 3 (Lovable Labs Incorporated) and
        its sub-processor (Supabase), acting on our behalf. We do not sell your data or pass it on
        to third parties for advertising purposes.
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
  versionLabel,
  children,
}: {
  titleDe: string;
  titleEn: string;
  versionLabel?: string;
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

/* ------------------------------------ AGB ------------------------------------ */

export const LEGAL_VERSION_LABEL = "Stand: 12. August 2026 · Version 1.0";

export function GermanOnlyNote() {
  return (
    <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Die englische Fassung folgt. Es gilt die deutsche Fassung.
    </p>
  );
}

export function AgbDE() {
  return (
    <>
      <H2>§ 1 Geltungsbereich</H2>
      <P>
        (1) Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge über die Nutzung der
        Software „Eventeer“ zwischen Keren Kaufman, Urbanstraße 71, 10967 Berlin (nachfolgend
        „Anbieterin“) und dem Kunden.
      </P>
      <P>
        (2) Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, juristische
        Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen. Verbraucher im
        Sinne des § 13 BGB sind von der Nutzung ausgeschlossen.
      </P>
      <P>
        (3) Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des Kunden
        werden nicht Vertragsbestandteil, es sei denn, die Anbieterin stimmt ihrer Geltung
        ausdrücklich in Textform zu. Dies gilt auch dann, wenn die Anbieterin in Kenntnis solcher
        Bedingungen die Leistung vorbehaltlos erbringt.
      </P>

      <H2>§ 2 Vertragsgegenstand</H2>
      <P>
        (1) Die Anbieterin stellt dem Kunden die Software „Eventeer“ als webbasierte Anwendung
        (Software as a Service) für die Dauer des Vertrages zur Nutzung über das Internet bereit.
        Eventeer unterstützt die Bearbeitung von Veranstaltungsanfragen, die Erstellung von
        Angeboten, den Vertragsabschluss, die Zahlungsabwicklung sowie die Organisation von
        Veranstaltungen.
      </P>
      <P>
        (2) Der Leistungsumfang ergibt sich aus der jeweils gültigen Leistungsbeschreibung auf der
        Website der Anbieterin sowie dem gewählten Tarif. Eine darüber hinausgehende Beschaffenheit
        schuldet die Anbieterin nicht; insbesondere besteht kein Anspruch auf individuelle
        Anpassungen, bestimmte Funktionen oder die Kompatibilität mit Systemen Dritter.
      </P>
      <P>
        (3) Die Anbieterin ist berechtigt, die Software fortzuentwickeln und anzupassen, insbesondere
        zur Verbesserung, aus Sicherheitsgründen oder aufgrund geänderter rechtlicher Anforderungen.
        Wesentliche Funktionen, die den vertragsgemäßen Gebrauch prägen, bleiben dabei erhalten. Wird
        der vertragsgemäße Gebrauch durch eine Änderung nicht nur unerheblich eingeschränkt, kann der
        Kunde den Vertrag innerhalb von 30 Tagen ab Kenntnis außerordentlich kündigen.
      </P>
      <P>
        (4) Die Anbieterin schuldet keine Beratung in rechtlichen, steuerlichen oder
        betriebswirtschaftlichen Fragen. Von der Software erzeugte Dokumente — insbesondere Angebote,
        Verträge und Rechnungen — sind Arbeitsergebnisse des Kunden. Der Kunde prüft sie
        eigenverantwortlich auf inhaltliche und rechtliche Richtigkeit, bevor er sie gegenüber
        Dritten verwendet.
      </P>

      <H2>§ 3 Vertragsschluss, Testphase</H2>
      <P>
        (1) Die Darstellung der Software stellt kein bindendes Angebot dar. Der Vertrag kommt
        zustande, wenn die Anbieterin die Registrierung des Kunden bestätigt oder den Zugang
        freischaltet.
      </P>
      <P>
        (2) Der Kunde sichert zu, dass die bei der Registrierung angegebenen Daten zutreffend und
        vollständig sind und dass die handelnde Person zur Vertretung des Kunden berechtigt ist.
      </P>
      <P>
        (3) Die Anbieterin kann eine kostenfreie Testphase anbieten. Während der Testphase besteht
        kein Anspruch auf Verfügbarkeit, Support oder Datenerhalt. Die Testphase endet automatisch;
        sie geht nur dann in ein kostenpflichtiges Vertragsverhältnis über, wenn der Kunde dies
        ausdrücklich beauftragt. Nach Ablauf einer nicht fortgeführten Testphase gilt § 11
        entsprechend.
      </P>

      <H2>§ 4 Nutzungsrechte</H2>
      <P>
        (1) Der Kunde erhält für die Vertragslaufzeit ein einfaches, nicht übertragbares, nicht
        unterlizenzierbares Recht, die Software bestimmungsgemäß über das Internet zu nutzen. Ein
        Anspruch auf Herausgabe des Quellcodes oder auf Überlassung der Software besteht nicht.
      </P>
      <P>
        (2) Der Kunde darf die Software nicht vervielfältigen, bearbeiten, zurückentwickeln, an
        Dritte vermieten, weiterverkaufen oder Dritten zugänglich machen. Zugänge sind
        personenbezogen und dürfen nicht von mehreren Personen gemeinsam genutzt werden.
      </P>
      <P>
        (3) Alle Rechte an der Software, ihrer Struktur, ihrem Quellcode, ihrer Gestaltung sowie an
        Marken und Kennzeichen verbleiben bei der Anbieterin.
      </P>
      <P>
        (4) An den vom Kunden eingestellten Inhalten und Daten („Kundendaten“) erwirbt die Anbieterin
        keine Rechte. Der Kunde räumt der Anbieterin das zur Vertragserfüllung erforderliche einfache
        Nutzungsrecht ein, insbesondere zur Speicherung, Verarbeitung und Anzeige der Kundendaten im
        Rahmen der Software.
      </P>
      <P>
        (5) Die Anbieterin darf anonymisierte und aggregierte Nutzungsdaten, die keinen Rückschluss
        auf den Kunden, seine Kunden oder einzelne Personen zulassen, zur Verbesserung und
        Weiterentwicklung der Software auswerten.
      </P>

      <H2>§ 5 Vergütung, Zahlung, Verzug</H2>
      <P>
        (1) Die Vergütung richtet sich nach der bei Vertragsschluss gültigen Preisliste. Alle Preise
        verstehen sich zuzüglich der gesetzlichen Umsatzsteuer.
      </P>
      <P>
        (2) Die Vergütung ist im Voraus für den jeweiligen Abrechnungszeitraum fällig, sofern nichts
        anderes vereinbart ist. Die Rechnungsstellung erfolgt elektronisch.
      </P>
      <P>
        (3) Gerät der Kunde mit der Zahlung in Verzug, ist die Anbieterin berechtigt, nach
        erfolgloser Mahnung mit Fristsetzung von zehn Werktagen den Zugang zur Software zu sperren.
        Die Zahlungspflicht für den vereinbarten Zeitraum bleibt hiervon unberührt. Weitergehende
        gesetzliche Rechte, insbesondere Verzugszinsen nach § 288 Abs. 2 BGB, bleiben vorbehalten.
      </P>
      <P>
        (4) Die Anbieterin kann die Preise mit einer Frist von acht Wochen zum Beginn eines neuen
        Abrechnungszeitraums in Textform anpassen. Erhöht sich der Preis um mehr als 10 %, kann der
        Kunde den Vertrag zum Wirksamwerden der Erhöhung außerordentlich kündigen; hierauf weist die
        Anbieterin in der Mitteilung hin.
      </P>
      <P>
        (5) Der Kunde kann nur mit unbestrittenen oder rechtskräftig festgestellten Forderungen
        aufrechnen. Ein Zurückbehaltungsrecht steht ihm nur wegen Ansprüchen aus demselben
        Vertragsverhältnis zu.
      </P>

      <H2>§ 6 Verfügbarkeit</H2>
      <P>
        (1) Die Anbieterin stellt die Software mit einer Verfügbarkeit von 98 % im Monatsmittel,
        gemessen am Übergabepunkt des Rechenzentrums, bereit.
      </P>
      <P>
        (2) Nicht als Ausfallzeit gelten: angekündigte Wartungsarbeiten, Störungen außerhalb des
        Einflussbereichs der Anbieterin (insbesondere bei Vorleistungsanbietern, Netzbetreibern oder
        durch höhere Gewalt), Störungen aufgrund unsachgemäßer Nutzung durch den Kunden sowie
        Ausfälle der Internetverbindung des Kunden.
      </P>
      <P>
        (3) Wartungsarbeiten werden nach Möglichkeit außerhalb der Zeiten von 9:00 bis 18:00 Uhr
        (MEZ/MESZ) an Werktagen durchgeführt und mit angemessenem Vorlauf angekündigt.
        Sicherheitsrelevante Eingriffe darf die Anbieterin jederzeit und ohne Vorankündigung
        vornehmen.
      </P>
      <P>
        (4) Die Anbieterin unterstützt den Kunden per E-Mail an Werktagen. Ein Anspruch auf bestimmte
        Reaktions- oder Wiederherstellungszeiten besteht nur, soweit ausdrücklich vereinbart.
      </P>

      <H2>§ 7 Pflichten des Kunden</H2>
      <P>
        (1) Der Kunde ist für die von ihm und seinen Nutzern eingestellten Inhalte und Daten allein
        verantwortlich. Er stellt sicher, dass er zur Verarbeitung dieser Daten berechtigt ist und
        die erforderlichen Rechtsgrundlagen und Einwilligungen vorliegen — insbesondere für Daten
        seiner eigenen Kunden und Gäste.
      </P>
      <P>
        (2) Der Kunde darf keine Inhalte einstellen, die gegen geltendes Recht, Rechte Dritter oder
        die guten Sitten verstoßen.
      </P>
      <P>
        (3) Der Kunde stellt keine besonderen Kategorien personenbezogener Daten im Sinne des Art. 9
        DSGVO in die Software ein (insbesondere Gesundheitsdaten, religiöse oder politische
        Überzeugungen, Gewerkschaftszugehörigkeit, biometrische Daten) sowie keine
        Zahlungskartendaten. Die Software ist hierfür nicht ausgelegt.
      </P>
      <P>
        (4) Der Kunde schützt seine Zugangsdaten vor dem Zugriff Dritter, gibt sie nicht weiter und
        informiert die Anbieterin unverzüglich bei Verdacht auf Missbrauch.
      </P>
      <P>
        (5) Der Kunde ist für die Verwaltung der Zugänge seiner Nutzer und die Vergabe von
        Berechtigungen selbst verantwortlich. Handlungen seiner Nutzer sind ihm zuzurechnen.
      </P>
      <P>
        (6) Der Kunde stellt die Anbieterin von Ansprüchen Dritter frei, die auf einer schuldhaften
        Verletzung der Pflichten aus diesem Paragraphen beruhen, einschließlich angemessener Kosten
        der Rechtsverteidigung. Die Anbieterin informiert den Kunden unverzüglich über solche
        Ansprüche und stimmt sich mit ihm über die Verteidigung ab.
      </P>
      <P>
        (7) Der Kunde ist verpflichtet, seine Daten in regelmäßigen Abständen über die von der
        Software bereitgestellten Exportfunktionen zu sichern.
      </P>

      <H2>§ 8 Mängel</H2>
      <P>(1) Es gilt das Mietrecht (§§ 535 ff. BGB), soweit nachfolgend nichts anderes bestimmt ist.</P>
      <P>
        (2) Die verschuldensunabhängige Haftung für anfängliche Mängel nach § 536a Abs. 1 Alt. 1 BGB
        ist ausgeschlossen.
      </P>
      <P>
        (3) Der Kunde zeigt Mängel unverzüglich in Textform an und beschreibt sie so genau, dass eine
        Nachvollziehbarkeit möglich ist. Er unterstützt die Anbieterin in zumutbarem Umfang bei der
        Eingrenzung.
      </P>
      <P>(4) Unerhebliche Beeinträchtigungen der Gebrauchstauglichkeit berechtigen nicht zur Minderung.</P>

      <H2>§ 9 Haftung</H2>
      <P>
        (1) Die Anbieterin haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung
        des Lebens, des Körpers oder der Gesundheit, bei arglistigem Verschweigen eines Mangels, im
        Umfang einer übernommenen Garantie sowie nach dem Produkthaftungsgesetz.
      </P>
      <P>
        (2) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht)
        haftet die Anbieterin der Höhe nach begrenzt auf den bei Vertragsschluss vorhersehbaren,
        vertragstypischen Schaden. Wesentliche Vertragspflichten sind solche, deren Erfüllung die
        ordnungsgemäße Durchführung des Vertrages überhaupt erst ermöglicht und auf deren Einhaltung
        der Kunde regelmäßig vertrauen darf.
      </P>
      <P>
        (3) Die Haftung nach Absatz 2 ist insgesamt begrenzt auf die Höhe der vom Kunden in den zwölf
        Monaten vor dem schädigenden Ereignis gezahlten Vergütung, mindestens jedoch 1.000 EUR.
      </P>
      <P>
        (4) Im Übrigen ist die Haftung ausgeschlossen. Dies gilt insbesondere für entgangenen Gewinn,
        ausgebliebene Einsparungen, Ansprüche Dritter und mittelbare Schäden.
      </P>
      <P>
        (5) Für den Verlust von Daten haftet die Anbieterin nur bis zu dem Aufwand, der bei
        ordnungsgemäßer und regelmäßiger Datensicherung durch den Kunden (§ 7 Abs. 7) zur
        Wiederherstellung erforderlich gewesen wäre.
      </P>
      <P>
        (6) Die vorstehenden Haftungsbeschränkungen gelten auch zugunsten der gesetzlichen Vertreter,
        Mitarbeiter und Erfüllungsgehilfen der Anbieterin.
      </P>
      <P>
        (7) Eine Änderung der Beweislast zum Nachteil des Kunden ist mit den vorstehenden Regelungen
        nicht verbunden.
      </P>

      <H2>§ 10 Laufzeit und Kündigung</H2>
      <P>
        (1) Der Vertrag wird auf unbestimmte Zeit geschlossen und läuft, sofern nichts anderes
        vereinbart ist, monatlich. Er kann von beiden Seiten mit einer Frist von 14 Tagen zum Ende
        des jeweiligen Abrechnungszeitraums in Textform gekündigt werden.
      </P>
      <P>
        (2) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein
        wichtiger Grund für die Anbieterin liegt insbesondere vor bei erheblichem Verstoß gegen § 7,
        bei Zahlungsverzug über zwei Abrechnungszeiträume oder bei Eröffnung eines
        Insolvenzverfahrens über das Vermögen des Kunden.
      </P>
      <P>
        (3) Die Kündigung kann in Textform, insbesondere per E-Mail, oder über die
        Kündigungsfunktion in der Software erklärt werden.
      </P>

      <H2>§ 11 Datenlöschung nach Vertragsende</H2>
      <P>
        (1) Mit Beendigung des Vertrages werden sämtliche Kundendaten unverzüglich und endgültig
        gelöscht. Eine Wiederherstellung ist nicht möglich. Dasselbe gilt, wenn der Kunde seinen
        Workspace über die Software selbst löscht, sowie nach Ablauf einer nicht fortgeführten
        Testphase.
      </P>
      <P>
        (2) Die Löschung erfolgt sofort im Produktivsystem. Etwaige Kopien in technischen
        Sicherungsbeständen (Backups) werden im Rahmen der regulären Backup-Zyklen, spätestens
        innerhalb von 30 Tagen, entfernt. Auf diese Kopien besteht kein Zugriff und kein
        Herausgabeanspruch.
      </P>
      <P>
        (3) Der Kunde ist verpflichtet, seine Daten vor Wirksamwerden der Kündigung bzw. vor Löschung
        des Workspace selbst zu exportieren. Die Anbieterin stellt hierfür Exportfunktionen bereit.
        Ein Anspruch auf Rückgabe, nachträglichen Export oder Wiederherstellung nach Vertragsende
        besteht nicht.
      </P>
      <P>
        (4) Die Anbieterin weist vor der endgültigen Löschung eines Workspace innerhalb der Software
        deutlich auf die Unwiderruflichkeit hin und verlangt eine ausdrückliche Bestätigung.
      </P>
      <P>
        (5) Unberührt bleiben gesetzliche Aufbewahrungspflichten, insbesondere für Rechnungs- und
        Buchhaltungsunterlagen der Anbieterin (§ 147 AO, § 257 HGB). Diese betreffen nicht die
        Inhalte der vom Kunden verarbeiteten Veranstaltungs- und Kundendaten.
      </P>

      <H2>§ 12 Datenschutz</H2>
      <P>
        (1) Verarbeitet die Anbieterin im Rahmen der Leistungserbringung personenbezogene Daten im
        Auftrag des Kunden, gilt ergänzend die Vereinbarung zur Auftragsverarbeitung (abrufbar unter{" "}
        <Link to="/avv" className="underline">/avv</Link>), die Bestandteil dieses Vertrages ist.
      </P>
      <P>(2) Der Kunde ist datenschutzrechtlich Verantwortlicher für die von ihm eingestellten Daten.</P>

      <H2>§ 13 Vertraulichkeit</H2>
      <P>
        (1) Beide Parteien behandeln vertrauliche Informationen der jeweils anderen Partei
        vertraulich und verwenden sie ausschließlich zu Vertragszwecken. Diese Pflicht besteht für
        drei Jahre nach Vertragsende fort.
      </P>
      <P>
        (2) Ausgenommen sind Informationen, die öffentlich bekannt sind, unabhängig entwickelt wurden
        oder aufgrund gesetzlicher Verpflichtung offenzulegen sind.
      </P>

      <H2>§ 14 Referenznennung</H2>
      <P>
        Die Anbieterin darf Namen und Logo des Kunden zu Referenzzwecken nennen. Der Kunde kann dem
        jederzeit in Textform widersprechen.
      </P>

      <H2>§ 15 Änderungen dieser AGB</H2>
      <P>
        (1) Die Anbieterin kann diese AGB mit Wirkung für die Zukunft ändern, soweit dies zur
        Anpassung an geänderte Rechtslage, Rechtsprechung oder technische Gegebenheiten erforderlich
        ist und der Kunde dadurch nicht unangemessen benachteiligt wird.
      </P>
      <P>
        (2) Änderungen werden dem Kunden mindestens sechs Wochen vor Inkrafttreten in Textform
        mitgeteilt. Widerspricht der Kunde nicht innerhalb von vier Wochen nach Zugang, gelten die
        Änderungen als angenommen. Auf diese Wirkung wird in der Mitteilung gesondert hingewiesen.
        Widerspricht der Kunde, kann jede Partei den Vertrag zum Zeitpunkt des Inkrafttretens
        kündigen.
      </P>

      <H2>§ 16 Schlussbestimmungen</H2>
      <P>(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</P>
      <P>
        (2) Ausschließlicher Gerichtsstand für alle Streitigkeiten ist Berlin, sofern der Kunde
        Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
        Sondervermögen ist.
      </P>
      <P>
        (3) Änderungen und Ergänzungen dieses Vertrages bedürfen der Textform. Dies gilt auch für die
        Änderung dieser Klausel.
      </P>
      <P>
        (4) Sollte eine Bestimmung unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen
        Bestimmungen unberührt.
      </P>
    </>
  );
}

/* ------------------------------------ AVV ------------------------------------ */

export function AvvDE() {
  return (
    <>
      <P>
        Diese Vereinbarung gilt zwischen dem Kunden („Verantwortlicher“) und Keren Kaufman,
        Urbanstraße 71, 10967 Berlin („Auftragsverarbeiterin“). Sie ist Bestandteil der Allgemeinen
        Geschäftsbedingungen.
      </P>

      <H2>1. Gegenstand und Dauer</H2>
      <P>
        Gegenstand ist die Verarbeitung personenbezogener Daten durch die Auftragsverarbeiterin im
        Auftrag des Verantwortlichen im Rahmen der Bereitstellung der Software „Eventeer“. Die Dauer
        entspricht der Laufzeit des Hauptvertrages.
      </P>

      <H2>2. Art, Zweck und Umfang der Verarbeitung</H2>
      <P>
        Zweck: Bereitstellung und Betrieb einer Software zur Bearbeitung von Veranstaltungsanfragen,
        Erstellung und Versand von Angeboten und Verträgen, Zahlungsverfolgung,
        Veranstaltungsorganisation und Kommunikation mit den Kunden des Verantwortlichen.
      </P>
      <P>
        Art der Verarbeitung: Erheben, Erfassen, Organisieren, Speichern, Anpassen, Auslesen,
        Abfragen, Verwenden, Übermitteln, Einschränken und Löschen.
      </P>
      <P>
        Kategorien betroffener Personen: Beschäftigte und Nutzer des Verantwortlichen; Kunden,
        Auftraggeber und Ansprechpartner des Verantwortlichen; Gäste und Teilnehmende von
        Veranstaltungen, soweit vom Verantwortlichen erfasst; Dienstleister und Lieferanten des
        Verantwortlichen.
      </P>
      <P>
        Kategorien personenbezogener Daten: Stammdaten (Name, Firma, Funktion); Kontaktdaten
        (E-Mail, Telefon, Anschrift); Vertrags- und Angebotsdaten; Zahlungs- und Rechnungsdaten
        (ohne Zahlungskartendaten); Kommunikationsdaten und Notizen; Nutzungs- und Protokolldaten.
      </P>
      <P>Ausgeschlossen: Besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO.</P>

      <H2>3. Rechte und Pflichten des Verantwortlichen</H2>
      <P>
        Der Verantwortliche ist für die Rechtmäßigkeit der Verarbeitung sowie für die Wahrung der
        Rechte betroffener Personen allein verantwortlich. Weisungen erfolgen grundsätzlich in
        Textform; mündliche Weisungen sind unverzüglich in Textform zu bestätigen. Der
        Verantwortliche informiert die Auftragsverarbeiterin unverzüglich, wenn er Fehler oder
        Unregelmäßigkeiten feststellt.
      </P>

      <H2>4. Pflichten der Auftragsverarbeiterin</H2>
      <P>
        Die Auftragsverarbeiterin verarbeitet personenbezogene Daten ausschließlich nach
        dokumentierten Weisungen des Verantwortlichen; informiert unverzüglich, wenn sie eine
        Weisung für rechtswidrig hält, und darf deren Ausführung aussetzen; verpflichtet die zur
        Verarbeitung befugten Personen zur Vertraulichkeit; ergreift die technischen und
        organisatorischen Maßnahmen gemäß Anlage 1; unterstützt den Verantwortlichen bei der
        Erfüllung der Rechte betroffener Personen (Art. 12–23 DSGVO) und der Pflichten aus Art.
        32–36 DSGVO; leitet Anfragen betroffener Personen unverzüglich an den Verantwortlichen weiter
        und beantwortet sie nicht selbst; informiert den Verantwortlichen unverzüglich, spätestens
        innerhalb von 48 Stunden nach Kenntnis, über Verletzungen des Schutzes personenbezogener
        Daten in ihrem Verantwortungsbereich; stellt auf Anfrage die zum Nachweis erforderlichen
        Informationen bereit.
      </P>

      <H2>5. Unterauftragsverarbeiter</H2>
      <P>
        Der Verantwortliche erteilt die allgemeine Genehmigung zur Beauftragung von
        Unterauftragsverarbeitern. Bei Vertragsschluss sind dies: Lovable Labs Incorporated, 1
        Lincoln St, Boston, MA 02111, USA (Bereitstellung, Betrieb und Hosting der Anwendung) sowie
        Supabase (von Lovable eingesetzt, Datenbank, Authentifizierung und Dateispeicher). Die
        Auftragsverarbeiterin informiert mindestens vier Wochen vor Beauftragung eines neuen oder dem
        Wechsel eines bestehenden Unterauftragsverarbeiters in Textform. Der Verantwortliche kann
        innerhalb von zwei Wochen aus wichtigem datenschutzrechtlichem Grund widersprechen; kann dem
        Widerspruch nicht abgeholfen werden, steht beiden Parteien ein Sonderkündigungsrecht zu.
        Unterauftragsverarbeiter werden auf ein entsprechendes Datenschutzniveau verpflichtet.
      </P>

      <H2>6. Drittlandtransfer</H2>
      <P>
        Der unter Ziffer 5 genannte Anbieter hat seinen Sitz in den Vereinigten Staaten von Amerika;
        damit findet eine Verarbeitung außerhalb der EU bzw. des EWR statt. Grundlage sind die
        Standardvertragsklauseln der EU-Kommission gemäß Durchführungsbeschluss (EU) 2021/914 (Art.
        46 Abs. 2 lit. c DSGVO) beziehungsweise ein Angemessenheitsbeschluss nach Art. 45 DSGVO.
        Ergänzend bestehen die in Anlage 1 beschriebenen technischen Schutzmaßnahmen.
      </P>

      <H2>7. Kontrollrechte</H2>
      <P>
        Der Verantwortliche kann sich von der Einhaltung dieser Vereinbarung überzeugen. Der Nachweis
        erfolgt vorrangig durch Selbstauskunft, vorhandene Zertifizierungen oder Prüfberichte oder
        durch Beantwortung eines schriftlichen Fragenkatalogs. Reicht dies nachweislich nicht aus,
        kann der Verantwortliche nach Ankündigung mit einer Frist von mindestens vier Wochen während
        der üblichen Geschäftszeiten eine Prüfung durchführen, höchstens einmal je Kalenderjahr, ohne
        Störung des Betriebsablaufs und unter Wahrung der Geheimhaltung. Aufwand für darüber
        hinausgehende Prüfungen kann nach vorheriger Ankündigung berechnet werden. Prüfer, die
        Wettbewerber sind, können zurückgewiesen werden.
      </P>

      <H2>8. Vertraulichkeit und Beschäftigte</H2>
      <P>
        Es werden nur Personen eingesetzt, die auf die Vertraulichkeit verpflichtet und mit den
        relevanten Datenschutzvorschriften vertraut gemacht wurden.
      </P>

      <H2>9. Löschung und Rückgabe nach Vertragsende</H2>
      <P>
        Nach Beendigung des Hauptvertrages löscht die Auftragsverarbeiterin sämtliche im Auftrag
        verarbeiteten personenbezogenen Daten unverzüglich und endgültig; eine Wiederherstellung ist
        nicht möglich. Die Löschung erfolgt sofort im Produktivsystem; Kopien in technischen
        Sicherungsbeständen werden im Rahmen der regulären Backup-Zyklen, spätestens innerhalb von 30
        Tagen, entfernt und bis dahin nicht verarbeitet. Der Verantwortliche ist verpflichtet,
        benötigte Daten vor Vertragsende über die Exportfunktionen selbst zu sichern; ein Anspruch
        auf Rückgabe oder nachträglichen Export nach Vertragsende besteht nicht. Eine darüber
        hinausgehende Aufbewahrung erfolgt nur, soweit gesetzliche Aufbewahrungspflichten
        entgegenstehen; die Daten werden dann gesperrt. Die Löschung wird auf Anfrage in Textform
        bestätigt.
      </P>

      <H2>10. Haftung</H2>
      <P>
        Für die Haftung im Verhältnis der Parteien gelten die Regelungen des Hauptvertrages (§ 9
        AGB), soweit gesetzlich zulässig. Art. 82 DSGVO bleibt unberührt. Im Innenverhältnis trägt
        jede Partei den Anteil an einem Schaden oder Bußgeld, der ihrem Anteil an der
        Verantwortlichkeit entspricht.
      </P>

      <H2>11. Schlussbestimmungen</H2>
      <P>
        Bei Widersprüchen zwischen dieser Vereinbarung und dem Hauptvertrag geht diese Vereinbarung
        in datenschutzrechtlichen Fragen vor. Im Übrigen gelten die Schlussbestimmungen des
        Hauptvertrages.
      </P>

      <H2>Anlage 1 — Technische und organisatorische Maßnahmen (Art. 32 DSGVO)</H2>
      <P>
        Vertraulichkeit: Betrieb in zertifizierten Rechenzentren der eingesetzten Anbieter, kein
        eigener Serverbetrieb; individuelle Benutzerkonten mit Passwortauthentifizierung oder
        Google-Anmeldung, keine Sammelkonten, Sperrung von Zugängen bei Ausscheiden; rollenbasiertes
        Berechtigungskonzept (Inhaber, Sales Manager, Event Manager, Buchhaltung) und Durchsetzung
        der Mandantentrennung auf Datenbankebene (Row Level Security); logische Trennung der Daten je
        Kundenunternehmen sowie Trennung von Produktiv- und Entwicklungsumgebung.
      </P>
      <P>
        Integrität: Transportverschlüsselung (TLS) für sämtliche Verbindungen und Verschlüsselung der
        gespeicherten Daten; Protokollierung sicherheits- und berechtigungsrelevanter Vorgänge.
      </P>
      <P>
        Verfügbarkeit und Belastbarkeit: regelmäßige Sicherung durch den Hosting-Anbieter;
        Wiederherstellbarkeit im Rahmen der Sicherungszyklen des Anbieters, mit Ausnahme der nach
        Ziffer 9 endgültig gelöschten Daten.
      </P>
      <P>
        Verfahren zur Überprüfung und Bewertung: schriftliche Vereinbarungen mit
        Unterauftragsverarbeitern; datenschutzfreundliche Voreinstellungen; Überprüfung der Maßnahmen
        anlassbezogen sowie bei wesentlichen Änderungen der Verarbeitung.
      </P>
    </>
  );
}
