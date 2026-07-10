import { createFileRoute } from "@tanstack/react-router";
import { PackagesPage } from "@/components/catalog-packages-page";

export const Route = createFileRoute("/_authenticated/catalog/beverages")({
  component: () => <PackagesPage kind="beverage" />,
});
