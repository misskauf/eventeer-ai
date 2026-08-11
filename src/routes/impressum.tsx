import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-brand";
import { LegalPage, ImpressumDE, ImpressumEN } from "@/components/legal-content";

export const Route = createFileRoute("/impressum")({
  component: ImpressumPage,
  head: () => ({
    meta: [
      { title: `Imprint / Impressum — ${APP_NAME}` },
      { name: "description", content: "Imprint and legal operator details for Eventeer." },
      { property: "og:title", content: `Imprint / Impressum — ${APP_NAME}` },
      { property: "og:description", content: "Imprint and legal operator details for Eventeer." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://eventeer-ai.lovable.app/impressum" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/impressum" }],
  }),
});

function ImpressumPage() {
  return (
    <LegalPage titleDe="Impressum" titleEn="Imprint">
      {(lang) => (lang === "de" ? <ImpressumDE /> : <ImpressumEN />)}
    </LegalPage>
  );
}
