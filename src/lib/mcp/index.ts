import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDeals from "./tools/list-deals";
import getDeal from "./tools/get-deal";
import listCatalog from "./tools/list-catalog";
import listContracts from "./tools/list-contracts";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "proposalist-mcp",
  title: "Proposalist",
  version: "0.1.0",
  instructions:
    "Tools for the Proposalist event-management app. Use list_deals / get_deal to inspect deals for the signed-in user's company, list_contracts for contract status, and list_catalog to browse spaces, food packages, beverage packages, and extras.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDeals, getDeal, listCatalog, listContracts],
});
