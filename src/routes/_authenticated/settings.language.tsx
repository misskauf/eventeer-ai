import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation, setAppLanguage, readStoredLang, type AppLang } from "@/i18n";

export const Route = createFileRoute("/_authenticated/settings/language")({
  component: LanguageSettings,
});

function LanguageSettings() {
  const { t } = useTranslation();
  const [uiLang, setUiLang] = useState<AppLang>("en");
  useEffect(() => {
    setUiLang(readStoredLang());
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle>{t("settings.interface_language")}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
          {(["en", "de"] as AppLang[]).map((l) => (
            <Button
              key={l}
              type="button"
              variant={uiLang === l ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAppLanguage(l);
                setUiLang(l);
                toast.success(t("settings.language_saved"));
              }}
            >
              {l === "en" ? t("common.english") : t("common.german")}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.interface_language_hint")}</p>
      </CardContent>
    </Card>
  );
}
