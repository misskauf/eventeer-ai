import { createFileRoute } from "@tanstack/react-router";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/catalog/extras")({
  component: ExtrasPage,
});

function ExtrasPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  return (
    <CrudList
      title="extra"
      table="extras"
      companyId={companyId}
      fields={[
        { name: "name", label: "Name" },
        { name: "description", label: "Description" },
        {
          name: "pricing_type",
          label: "Pricing type",
          type: "select",
          options: [
            { value: "flat", label: "Flat" },
            { value: "per_person", label: "Per person" },
            { value: "per_hour", label: "Per hour" },
          ],
        },
        { name: "price", label: "Price", type: "number", step: "0.01" },
      ]}
      render={(r: any) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {money(Number(r.price), currency)} · {r.pricing_type?.replace("_", " ")}
          </div>
        </div>
      )}
    />
  );
}

