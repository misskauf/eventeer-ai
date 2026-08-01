import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EDITABLE_ROLES,
  LEVELS,
  LEVEL_LABELS,
  MODULES,
  MODULE_LABELS,
  roleLabel,
  type PermissionLevel,
  type PermissionModule,
  type PermissionScope,
} from "@/lib/permissions";
import {
  getPermissionMatrix,
  listPermissionAudit,
  savePermissionMatrix,
} from "@/lib/permissions.functions";

/** Record modules that support an Own / All scope toggle. */
const SCOPE_MODULES: PermissionModule[] = ["deals", "proposals", "contracts", "event_briefs"];

type Cell = { level: PermissionLevel; scope: PermissionScope | null };
type Matrix = Record<string, Record<string, Cell>>;

function key(role: string, module: string) {
  return `${role}:${module}`;
}

export function PermissionMatrixCard() {
  const load = useServerFn(getPermissionMatrix);
  const save = useServerFn(savePermissionMatrix);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [initial, setInitial] = useState<Matrix | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [auditNonce, setAuditNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await load({} as never);
        if (!alive) return;
        const m: Matrix = {};
        for (const r of EDITABLE_ROLES) {
          m[r.value] = {};
          for (const mod of MODULES) m[r.value]![mod] = { level: "none", scope: null };
        }
        for (const row of res.rows as any[]) {
          if (!m[row.role]) continue;
          m[row.role]![row.module] = {
            level: (row.level ?? "none") as PermissionLevel,
            scope: (row.scope ?? null) as PermissionScope | null,
          };
        }
        setMatrix(m);
        setInitial(JSON.parse(JSON.stringify(m)));
        setCanEdit(res.canEdit);
        setAllowed(true);
      } catch {
        if (alive) setAllowed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const dirty = useMemo(() => {
    if (!matrix || !initial) return [] as Array<{ role: string; module: string } & Cell>;
    const out: Array<{ role: string; module: string } & Cell> = [];
    for (const r of EDITABLE_ROLES) {
      for (const mod of MODULES) {
        const a = matrix[r.value]![mod]!;
        const b = initial[r.value]![mod]!;
        if (a.level !== b.level || (a.scope ?? null) !== (b.scope ?? null)) {
          out.push({ role: r.value, module: mod, level: a.level, scope: a.scope ?? null });
        }
      }
    }
    return out;
  }, [matrix, initial]);

  function update(role: string, module: string, patch: Partial<Cell>) {
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [role]: { ...prev[role]! } };
      next[role]![module] = { ...next[role]![module]!, ...patch };
      return next;
    });
  }

  async function onSave() {
    if (!dirty.length) return;
    setSaving(true);
    try {
      const res = await save({ data: { changes: dirty as never } });
      setInitial(JSON.parse(JSON.stringify(matrix)));
      setAuditNonce((n) => n + 1);
      toast.success(`Saved ${res.changed} permission change${res.changed === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save permissions");
    } finally {
      setSaving(false);
    }
  }

  if (allowed === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Roles & permissions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You need Admin access on the Team module to view or edit permissions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Roles & permissions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set what each role can do. Owner always has full access.
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={onSave} disabled={saving || dirty.length === 0}>
                {saving ? "Saving…" : dirty.length ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}` : "Saved"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!matrix ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[150px] bg-card">Role</TableHead>
                    {MODULES.map((m) => (
                      <TableHead key={m} className="min-w-[150px]">
                        {MODULE_LABELS[m]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="sticky left-0 z-10 bg-card font-medium">
                      Owner <Badge variant="secondary" className="ml-1">Locked</Badge>
                    </TableCell>
                    {MODULES.map((m) => (
                      <TableCell key={m} className="text-sm text-muted-foreground">
                        Admin{SCOPE_MODULES.includes(m) ? " · All" : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                  {EDITABLE_ROLES.map((r) => (
                    <TableRow key={r.value}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{r.label}</TableCell>
                      {MODULES.map((m) => {
                        const cell = matrix[r.value]![m]!;
                        return (
                          <TableCell key={m} className="align-top">
                            <div className="space-y-1.5">
                              <Select
                                value={cell.level}
                                disabled={!canEdit}
                                onValueChange={(v) => update(r.value, m, { level: v as PermissionLevel })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEVELS.map((l) => (
                                    <SelectItem key={l} value={l}>
                                      {LEVEL_LABELS[l]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {SCOPE_MODULES.includes(m) && cell.level !== "none" && (
                                <Select
                                  value={cell.scope ?? "all"}
                                  disabled={!canEdit}
                                  onValueChange={(v) => update(r.value, m, { scope: v as PermissionScope })}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="own">Own records</SelectItem>
                                    <SelectItem value="all">All records</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AuditLogCard nonce={auditNonce} />
    </div>
  );
}

function AuditLogCard({ nonce }: { nonce: number }) {
  const list = useServerFn(listPermissionAudit);
  const [entries, setEntries] = useState<any[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await list({ data: { limit: 50 } });
        if (alive) setEntries(res.entries);
      } catch {
        if (alive) setEntries([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [list, nonce]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <p className="text-sm text-muted-foreground">Recent permission and user changes.</p>
      </CardHeader>
      <CardContent>
        {entries === null ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">No changes recorded yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">When</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead className="w-[220px]">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const d = (e.detail ?? {}) as any;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{String(e.action).replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs">
                        {d.module ? (
                          <>
                            <span className="font-medium">{roleLabel(d.role)}</span> ·{" "}
                            {MODULE_LABELS[d.module as PermissionModule] ?? d.module}:{" "}
                            {LEVEL_LABELS[(d.from_level ?? "none") as PermissionLevel]} →{" "}
                            {LEVEL_LABELS[(d.to_level ?? "none") as PermissionLevel]}
                            {d.to_scope ? ` (${d.to_scope === "own" ? "Own" : "All"})` : ""}
                          </>
                        ) : (
                          (e.target ?? "—")
                        )}
                      </TableCell>
                      <TableCell className="truncate font-mono text-[11px] text-muted-foreground">
                        {e.actor_id ?? "system"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
