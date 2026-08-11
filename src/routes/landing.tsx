import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-brand";
import { LandingPage, HERO_TITLE, HERO_SUB } from "@/components/landing-page";

export const Route = createFileRoute("/landing")({
  component: LandingPreview,
  head: () => ({
    meta: [
      { title: `${APP_NAME} — ${HERO_TITLE}` },
      { name: "description", content: HERO_SUB },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `${APP_NAME} — ${HERO_TITLE}` },
      { property: "og:description", content: HERO_SUB },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://eventeer-ai.lovable.app/" }],
  }),
});

function LandingPreview() {
  return <LandingPage />;
}
