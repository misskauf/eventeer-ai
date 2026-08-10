import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation, applyStoredLanguage } from "@/i18n";
import { APP_NAME } from "@/lib/app-brand";
import { Button } from "@/components/ui/button";

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
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/datenschutz" }],
  }),
});

function DatenschutzPage() {
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
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">{t("landing.legal.datenschutz_title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("landing.legal.datenschutz_body")}</p>
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
