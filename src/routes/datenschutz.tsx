import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-brand";
import { LegalPage, DatenschutzDE, DatenschutzEN } from "@/components/legal-content";

export const Route = createFileRoute("/datenschutz")({
  component: DatenschutzPage,
  head: () => ({
    meta: [
      { title: `Privacy / Datenschutz — ${APP_NAME}` },
      { name: "description", content: "Privacy notice for Eventeer." },
      { property: "og:title", content: `Privacy / Datenschutz — ${APP_NAME}` },
      { property: "og:description", content: "Privacy notice for Eventeer." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://eventeer-ai.lovable.app/datenschutz" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/datenschutz" }],
  }),
});

function DatenschutzPage() {
  return (
    <LegalPage titleDe="Datenschutzerklärung" titleEn="Privacy Policy">
      {(lang) => (lang === "de" ? <DatenschutzDE /> : <DatenschutzEN />)}
    </LegalPage>
  );
}
