import { Checkbox } from "@/components/ui/checkbox";

export type MenuGroupDef = {
  label: string;
  max_select: number;
  options: { label: string; description?: string }[];
};

export function MenuSelectionPicker({
  groups,
  totalMax,
  value,
  onChange,
  readOnly = false,
}: {
  groups: MenuGroupDef[];
  totalMax?: number | null;
  value: Record<string, string[]>;
  onChange?: (groupLabel: string, next: string[]) => void;
  readOnly?: boolean;
}) {
  if (!groups || groups.length === 0) return null;

  const totalPicked = groups.reduce((n, gg) => n + (value[gg.label]?.length ?? 0), 0);
  const totalAtMax = !!(totalMax && totalMax > 0 && totalPicked >= totalMax);

  if (readOnly) {
    return (
      <div className="space-y-2">
        {totalMax && totalMax > 0 && (
          <div className="text-xs text-muted-foreground">
            Menu items: {totalPicked}/{totalMax}
          </div>
        )}
        {groups.map((g) => {
          const picked = value[g.label] ?? [];
          return (
            <div key={g.label} className="text-xs">
              <div className="font-medium">{g.label}</div>
              {picked.length === 0 ? (
                <div className="text-muted-foreground">— none selected —</div>
              ) : (
                <ul className="ml-4 list-disc text-muted-foreground">
                  {picked.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {totalMax && totalMax > 0 && (
        <div className="text-xs text-muted-foreground">
          Total menu items: {totalPicked}/{totalMax}
        </div>
      )}
      {groups.map((g) => {
        const picked = value[g.label] ?? [];
        const atMax = picked.length >= g.max_select;
        return (
          <div key={g.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{g.label}</span>
              <span className="text-muted-foreground">
                Select up to {g.max_select} · {picked.length}/{g.max_select} selected
              </span>
            </div>
            <div className="space-y-1.5">
              {g.options.map((o) => {
                const isPicked = picked.includes(o.label);
                const disabled = !isPicked && (atMax || totalAtMax);
                return (
                  <label
                    key={o.label}
                    className={
                      "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs " +
                      (disabled ? "opacity-50" : "hover:bg-muted/40")
                    }
                  >
                    <Checkbox
                      checked={isPicked}
                      disabled={disabled}
                      onCheckedChange={(v) => {
                        const next = v
                          ? Array.from(new Set([...picked, o.label]))
                          : picked.filter((x) => x !== o.label);
                        onChange?.(g.label, next);
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{o.label}</div>
                      {o.description && (
                        <div className="text-muted-foreground">{o.description}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
