import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-brand";
import { LegalPage, AvvDE, GermanOnlyNote, LEGAL_VERSION_LABEL } from "@/components/legal-content";

export const Route = createFileRoute("/avv")({
  component: AvvPage,
  head: () => ({
    meta: [
      { title: `AVV — Auftragsverarbeitung — ${APP_NAME}` },
      {
        name: "description",
        content: "Vereinbarung zur Auftragsverarbeitung nach Art. 28 DSGVO für Eventeer.",
      },
      { property: "og:title", content: `AVV — Auftragsverarbeitung — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Vereinbarung zur Auftragsverarbeitung nach Art. 28 DSGVO für Eventeer.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://eventeer-ai.lovable.app/avv" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/avv" }],
  }),
});

function AvvPage() {
  return (
    <LegalPage
      titleDe="Vereinbarung zur Auftragsverarbeitung (Art. 28 DSGVO)"
      titleEn="Vereinbarung zur Auftragsverarbeitung (Art. 28 DSGVO)"
      versionLabel={LEGAL_VERSION_LABEL}
    >
      {(lang) => (
        <>
          {lang === "en" ? <GermanOnlyNote /> : null}
          <AvvDE />
        </>
      )}
    </LegalPage>
  );
}
