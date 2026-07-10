import { createFileRoute } from "@tanstack/react-router";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";
import { useCompanyCurrency } from "@/hooks/use-company-currency";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/catalog/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const { companyId } = useCurrentCompany();
  const currency = useCompanyCurrency();
  return (
    <CrudList
      title="package"
      table="fb_packages"
      companyId={companyId}
      fields={[
        { name: "name", label: "Name" },
        { name: "description", label: "Description" },
        { name: "price_per_person", label: "Price per person", type: "number", step: "0.01" },
        { name: "min_guests", label: "Minimum guests", type: "number" },
      ]}
      render={(r: any) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {money(Number(r.price_per_person), currency)} / guest · min {r.min_guests ?? 0}
          </div>
        </div>
      )}
    />
  );
}

