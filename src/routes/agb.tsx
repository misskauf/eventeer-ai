import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-brand";
import { LegalPage, AgbDE, GermanOnlyNote, LEGAL_VERSION_LABEL } from "@/components/legal-content";

export const Route = createFileRoute("/agb")({
  component: AgbPage,
  head: () => ({
    meta: [
      { title: `AGB — ${APP_NAME}` },
      {
        name: "description",
        content: "Allgemeine Geschäftsbedingungen für die Nutzung der Eventeer Software.",
      },
      { property: "og:title", content: `AGB — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Allgemeine Geschäftsbedingungen für die Nutzung der Eventeer Software.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://eventeer-ai.lovable.app/agb" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/agb" }],
  }),
});

function AgbPage() {
  return (
    <LegalPage
      titleDe="Allgemeine Geschäftsbedingungen"
      titleEn="Allgemeine Geschäftsbedingungen"
      versionLabel={LEGAL_VERSION_LABEL}
    >
      {(lang) => (
        <>
          {lang === "en" ? <GermanOnlyNote /> : null}
          <AgbDE />
        </>
      )}
    </LegalPage>
  );
}
