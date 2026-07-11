import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export type MenuOption = { label: string; description?: string };
export type MenuGroup = { label: string; max_select: number; options: MenuOption[] };

export function MenuSelectionEditor({
  modeName,
  groupsName,
  totalName,
  defaultMode,
  defaultGroups,
  defaultTotalMax,
}: {
  modeName: string;
  groupsName: string;
  totalName?: string;
  defaultMode: "fixed" | "single_group" | "multi_group";
  defaultGroups: MenuGroup[];
  defaultTotalMax?: number | null;
}) {
  const [mode, setMode] = useState<"fixed" | "single_group" | "multi_group">(defaultMode);
  const [groups, setGroups] = useState<MenuGroup[]>(
    defaultGroups.length
      ? defaultGroups
      : [{ label: "Choices", max_select: 1, options: [{ label: "" }] }],
  );
  const [totalMax, setTotalMax] = useState<string>(
    defaultTotalMax != null && defaultTotalMax > 0 ? String(defaultTotalMax) : "",
  );

  const maxGroups = mode === "single_group" ? 1 : 5;
  const visibleGroups = mode === "fixed" ? [] : groups.slice(0, maxGroups);

  function updateGroup(i: number, patch: Partial<MenuGroup>) {
    setGroups((g) => g.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addGroup() {
    if (groups.length >= maxGroups) return;
    setGroups([...groups, { label: `Group ${groups.length + 1}`, max_select: 1, options: [{ label: "" }] }]);
  }
  function removeGroup(i: number) {
    setGroups(groups.filter((_, idx) => idx !== i));
  }
  function addOption(gi: number) {
    updateGroup(gi, { options: [...groups[gi].options, { label: "" }] });
  }
  function updateOption(gi: number, oi: number, patch: Partial<MenuOption>) {
    updateGroup(gi, {
      options: groups[gi].options.map((o, idx) => (idx === oi ? { ...o, ...patch } : o)),
    });
  }
  function removeOption(gi: number, oi: number) {
    updateGroup(gi, { options: groups[gi].options.filter((_, idx) => idx !== oi) });
  }

  // Serialize only what's meaningful for the current mode.
  const serializedGroups =
    mode === "fixed"
      ? []
      : groups
          .slice(0, maxGroups)
          .map((g) => ({
            label: g.label.trim() || "Choices",
            max_select: Math.max(1, Number(g.max_select) || 1),
            options: g.options
              .map((o) => ({ label: o.label.trim(), description: o.description?.trim() || undefined }))
              .filter((o) => o.label),
          }))
          .filter((g) => g.options.length > 0);

  const serializedTotal = mode === "multi_group" && Number(totalMax) > 0 ? String(Math.floor(Number(totalMax))) : "";

  return (
    <div className="space-y-3 rounded-md border p-3">
      <input type="hidden" name={modeName} value={mode} />
      <input type="hidden" name={groupsName} value={JSON.stringify(serializedGroups)} />
      {totalName && <input type="hidden" name={totalName} value={serializedTotal} />}

      <div className="space-y-2">
        <Label>Menu selection</Label>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              { v: "fixed", label: "Fixed menu" },
              { v: "single_group", label: "Menu items (one group)" },
              { v: "multi_group", label: "Menu items (multiple groups)" },
            ] as const
          ).map((o) => {
            const active = mode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => setMode(o.v)}
                className={
                  "rounded-full border px-3 py-1 transition " +
                  (active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "fixed"
            ? "The package is served as-is — no guest choice."
            : mode === "single_group"
              ? "Guests pick from one list of menu items."
              : "Add up to 5 groups (e.g. Starters, Mains, Desserts) — guests pick from each."}
        </p>
      </div>

      {mode === "multi_group" && (
        <div className="flex items-center gap-2 text-xs">
          <Label className="text-xs font-normal text-muted-foreground">Total items across all groups</Label>
          <Input
            type="number"
            min={0}
            value={totalMax}
            onChange={(e) => setTotalMax(e.target.value)}
            placeholder="No limit"
            className="h-8 w-24"
          />
          <span className="text-muted-foreground">Leave blank for no overall cap.</span>
        </div>
      )}

      {mode !== "fixed" && (
        <div className="space-y-3">
          {visibleGroups.map((g, gi) => (
            <div key={gi} className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={g.label}
                  onChange={(e) => updateGroup(gi, { label: e.target.value })}
                  placeholder="Group label (e.g. Starters)"
                  className="flex-1"
                />
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Pick up to</span>
                  <Input
                    type="number"
                    min={1}
                    value={g.max_select}
                    onChange={(e) => updateGroup(gi, { max_select: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-8 w-16"
                  />
                </div>
                {mode === "multi_group" && groups.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeGroup(gi)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {g.options.map((o, oi) => (
                  <div key={oi} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={o.label}
                        onChange={(e) => updateOption(gi, oi, { label: e.target.value })}
                        placeholder="Menu item name"
                      />
                      <Textarea
                        rows={1}
                        value={o.description ?? ""}
                        onChange={(e) => updateOption(gi, oi, { description: e.target.value })}
                        placeholder="Optional description"
                        className="text-xs"
                      />
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(gi, oi)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => addOption(gi)}>
                  <Plus className="mr-1 h-3 w-3" /> Add menu item
                </Button>
              </div>
            </div>
          ))}
          {mode === "multi_group" && groups.length < maxGroups && (
            <Button type="button" size="sm" variant="outline" onClick={addGroup}>
              <Plus className="mr-1 h-3 w-3" /> Add group ({groups.length}/{maxGroups})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
