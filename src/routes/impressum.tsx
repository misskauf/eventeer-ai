import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation, applyStoredLanguage } from "@/i18n";
import { APP_NAME } from "@/lib/app-brand";
import { Button } from "@/components/ui/button";

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
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/impressum" }],
  }),
});

function ImpressumPage() {
  const { t } = useTranslation();
  useEffect(() => {
    applyStoredLanguage();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <Link to="/">
          <img src="/eventeer-logo.svg" alt={`${APP_NAME} logo`} className="h-8 w-auto" width={376} height={96} />
        </Link>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">{t("landing.legal.impressum_title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("landing.legal.impressum_body")}</p>
        <div className="mt-8 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("landing.legal.todo")}
        </div>
        <Link to="/" className="mt-10 inline-block">
          <Button variant="outline" size="sm">← {APP_NAME}</Button>
        </Link>
      </div>
    </div>
  );
}
