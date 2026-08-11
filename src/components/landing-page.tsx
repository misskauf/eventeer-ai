import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarCheck,
  Sparkles,
  Users,
  FileSignature,
  SlidersHorizontal,
  Palette,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { APP_NAME } from "@/lib/app-brand";
import {
  useTranslation,
  setAppLanguage,
  readStoredLang,
  applyStoredLanguage,
  type AppLang,
} from "@/i18n";
import { submitMarketingLead } from "@/lib/marketing-leads.functions";

export const HERO_TITLE = "Turn event inquiries into signed, paid bookings — with minimal admin.";
export const HERO_SUB =
  "Eventeer gives event venues one place to handle every inquiry: personalised proposals, digital signing and payment — all under your own brand. Win back a day of admin every week and spend it where it counts: your clients, and events people never forget.";
// TODO: replace with real contact address
const CONTACT_EMAIL = "hello@eventeer.app";

function scrollToDemo() {
  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LandingPage() {
  const { t } = useTranslation();
  // Render "en" on the server and switch after hydration to avoid a mismatch.
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <img
            src="/eventeer-logo.svg"
            alt={`${APP_NAME} logo`}
            className="h-7 w-auto sm:h-8"
            width={376}
            height={96}
          />
          <div className="flex items-center gap-2">
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
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                {t("landing.nav.signin")}
              </Button>
            </Link>
            <Button size="sm" onClick={scrollToDemo} className="hidden sm:inline-flex">
              {t("landing.nav.demo")}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]"
          />
          <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 sm:py-28">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("landing.hero.h1")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              {t("landing.hero.sub")}
            </p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" onClick={scrollToDemo} className="w-full sm:w-auto">
                {t("landing.hero.cta_secondary")}
              </Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">{t("landing.hero.note")}</p>
          </div>
        </section>

        {/* Pain points */}
        <Section title={t("landing.pains.title")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {["p1", "p2", "p3", "p4"].map((k) => (
              <li
                key={k}
                className="rounded-lg border bg-muted/30 px-4 py-4 text-sm text-muted-foreground"
              >
                {t(`landing.pains.${k}`)}
              </li>
            ))}
          </ul>
        </Section>

        {/* Benefits */}
        <Section title={t("landing.benefits.title")} muted>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { k: "b1", icon: <Sparkles className="h-5 w-5" /> },
              { k: "b2", icon: <SlidersHorizontal className="h-5 w-5" /> },
              { k: "b3", icon: <Users className="h-5 w-5" /> },
              { k: "b4", icon: <FileSignature className="h-5 w-5" /> },
              { k: "b5", icon: <CalendarCheck className="h-5 w-5" /> },
              { k: "b6", icon: <Palette className="h-5 w-5" /> },
            ].map(({ k, icon }) => (
              <div key={k} className="rounded-xl border bg-background p-6">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                  {icon}
                </div>
                <h3 className="mt-4 font-semibold">{t(`landing.benefits.${k}_t`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`landing.benefits.${k}_b`)}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section title={t("landing.how.title")}>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {["s1", "s2", "s3", "s4"].map((k, i) => (
              <li key={k} className="relative rounded-xl border p-6">
                <span className="grid h-8 w-8 place-items-center rounded-full border text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{t(`landing.how.${k}_t`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`landing.how.${k}_b`)}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Who it's for */}
        <Section title={t("landing.who.title")} muted>
          <ul className="flex flex-wrap gap-2">
            {["w1", "w2", "w3", "w4", "w5"].map((k) => (
              <li
                key={k}
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm"
              >
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t(`landing.who.${k}`)}
              </li>
            ))}
          </ul>
        </Section>

        {/* Pricing teaser */}
        <Section title={t("landing.pricing.title")}>
          <div className="rounded-xl border bg-muted/30 p-8 text-center">
            <p className="mx-auto max-w-xl text-muted-foreground">{t("landing.pricing.body")}</p>
            <Button className="mt-6" onClick={scrollToDemo}>
              {t("landing.pricing.cta")}
            </Button>
          </div>
        </Section>

        {/* FAQ */}
        <Section title={t("landing.faq.title")} muted>
          <Accordion type="single" collapsible className="mx-auto max-w-2xl">
            {["q1", "q2", "q3", "q4", "q5"].map((k, i) => (
              <AccordionItem key={k} value={k}>
                <AccordionTrigger className="text-left">{t(`landing.faq.${k}`)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t(`landing.faq.a${i + 1}`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        {/* Demo form */}
        <section id="demo" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-2xl px-5 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">{t("landing.demo.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("landing.demo.lead")}</p>
            <DemoForm lang={lang} />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <img
              src="/eventeer-logo.svg"
              alt={`${APP_NAME} logo`}
              className="h-7 w-auto"
              width={376}
              height={96}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              © {new Date().getFullYear()} {APP_NAME}. {t("landing.footer.rights")}
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/impressum" className="hover:text-foreground">
              {t("landing.footer.impressum")}
            </Link>
            <Link to="/datenschutz" className="hover:text-foreground">
              {t("landing.footer.datenschutz")}
            </Link>
            {/* TODO: replace with real contact address */}
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
              {t("landing.footer.contact")}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
  muted,
}: {
  title: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={"border-b " + (muted ? "bg-muted/20" : "")}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

const ROLE_OPTIONS = [
  "owner",
  "venue_sales_manager",
  "venue_event_manager",
  "event_manager",
  "other",
] as const;
const VENUE_OPTIONS = [
  "restaurant_cafe",
  "bar",
  "gallery_studio",
  "event_venue",
  "catering",
  "none",
] as const;
const SOFTWARE_OPTIONS = ["none", "crm", "event_software", "unknown"] as const;

function DemoForm({ lang }: { lang: AppLang }) {
  const { t } = useTranslation();
  const submit = useServerFn(submitMarketingLead);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [role, setRole] = useState("");
  const [venueType, setVenueType] = useState("");
  const [software, setSoftware] = useState("");

  if (done) {
    return (
      <div className="mt-8 rounded-xl border bg-muted/30 p-8 text-center">
        <h3 className="text-lg font-semibold">{t("landing.demo.success_title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("landing.demo.success_body")}</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const company = String(fd.get("company") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();

    if (!name || !company || !email || !phone) return toast.error(t("landing.demo.required"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return toast.error(t("landing.demo.invalid_email"));
    if (!role || !venueType || !software) return toast.error(t("landing.demo.required"));
    if (!consent) return toast.error(t("landing.demo.consent_required"));

    setSending(true);
    try {
      await submit({
        data: {
          name,
          company,
          email,
          phone,
          role,
          venue_type: venueType,
          current_software: software,
          message: String(fd.get("message") ?? ""),
          consent: true,
          locale: lang,
          website: String(fd.get("website") ?? ""),
        },
      });
      form.reset();
      toast.success(t("landing.demo.success_toast"));
      setDone(true);
    } catch {
      toast.error(t("landing.demo.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ml-name" label={t("landing.demo.name")} required>
          <Input id="ml-name" name="name" required maxLength={120} autoComplete="name" />
        </Field>
        <Field id="ml-company" label={t("landing.demo.company")} required>
          <Input id="ml-company" name="company" required maxLength={160} autoComplete="organization" />
        </Field>
        <Field id="ml-email" label={t("landing.demo.email")} required>
          <Input id="ml-email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </Field>
        <Field id="ml-phone" label={t("landing.demo.phone")} required>
          <Input id="ml-phone" name="phone" type="tel" required maxLength={60} autoComplete="tel" />
        </Field>
      </div>

      <RadioQuestion
        label={t("landing.demo.role")}
        value={role}
        onChange={setRole}
        options={ROLE_OPTIONS.map((k) => ({ value: k, label: t(`landing.demo.role_${k}`) }))}
        name="role"
      />
      <RadioQuestion
        label={t("landing.demo.venue")}
        value={venueType}
        onChange={setVenueType}
        options={VENUE_OPTIONS.map((k) => ({ value: k, label: t(`landing.demo.venue_${k}`) }))}
        name="venue_type"
      />
      <RadioQuestion
        label={t("landing.demo.software")}
        value={software}
        onChange={setSoftware}
        options={SOFTWARE_OPTIONS.map((k) => ({
          value: k,
          label: t(`landing.demo.software_${k}`),
        }))}
        name="current_software"
      />

      <Field id="ml-message" label={t("landing.demo.message")}>
        <Textarea id="ml-message" name="message" rows={4} maxLength={2000} />
      </Field>

      {/* Honeypot — hidden from users, filled by bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="ml-website">Website</label>
        <input id="ml-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="ml-consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          aria-required
        />
        <Label htmlFor="ml-consent" className="text-sm font-normal leading-relaxed text-muted-foreground">
          {t("landing.demo.consent")}{" "}
          <Link to="/datenschutz" className="underline underline-offset-2 hover:text-foreground">
            {t("landing.demo.privacy_link")}
          </Link>
        </Label>
      </div>

      <Button type="submit" size="lg" disabled={sending}>
        {sending ? t("landing.demo.sending") : t("landing.demo.submit")}
      </Button>
    </form>
  );
}

function RadioQuestion({
  label,
  value,
  onChange,
  options,
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  name: string;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">
        {label}
        <span className="text-destructive"> *</span>
      </legend>
      <RadioGroup value={value} onValueChange={onChange} className="gap-2" required>
        {options.map((o) => (
          <div key={o.value} className="flex items-center gap-3">
            <RadioGroupItem value={o.value} id={`ml-${name}-${o.value}`} />
            <Label
              htmlFor={`ml-${name}-${o.value}`}
              className="text-sm font-normal leading-relaxed"
            >
              {o.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
