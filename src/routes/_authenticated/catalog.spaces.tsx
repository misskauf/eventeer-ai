import { createFileRoute } from "@tanstack/react-router";
import { CrudList } from "@/components/crud-list";
import { useCurrentCompany } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/catalog/spaces")({
  component: SpacesPage,
});

function SpacesPage() {
  const { companyId } = useCurrentCompany();
  return (
    <CrudList
      title="space"
      table="spaces"
      companyId={companyId}
      fields={[
        { name: "name", label: "Name" },
        { name: "description", label: "Description" },
        { name: "capacity", label: "Capacity", type: "number" },
        { name: "base_rental_fee", label: "Base rental fee", type: "number", step: "0.01" },
        { name: "min_rental_fee", label: "Minimum rental fee", type: "number", step: "0.01" },
      ]}
      render={(r: any) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            Cap {r.capacity ?? "—"} · Base ${Number(r.base_rental_fee).toLocaleString()} · Min ${Number(r.min_rental_fee).toLocaleString()}
          </div>
        </div>
      )}
    />
  );
}
