import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money } from "@/lib/pricing";
import { formatEventDate } from "@/lib/date-format";
import { stageLabel, stageToneClass, STAGE_ORDER } from "@/lib/deal-stages";
import { PIPELINE_COLUMNS, columnById, columnForStage } from "@/lib/pipeline-columns";
import { useTranslation } from "@/i18n";

export type BoardDeal = {
  id: string;
  client_name: string;
  client_company: string | null;
  event_date: string | null;
  estimated_value: number;
  stage: string;
  owner_id: string | null;
};

type Props = {
  deals: BoardDeal[];
  currency: string;
  canEdit: boolean;
  ownerLabel: (id: string | null) => string;
  onOpen: (dealId: string) => void;
  onMove: (dealId: string, stage: string) => void;
};

export function DealsBoard({ deals, currency, canEdit, ownerLabel, onOpen, onMove }: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byColumn = useMemo(() => {
    const map: Record<string, BoardDeal[]> = {};
    for (const c of PIPELINE_COLUMNS) map[c.id] = [];
    for (const d of deals) (map[columnForStage(d.stage)] ??= []).push(d);
    return map;
  }, [deals]);

  const activeDeal = deals.find((d) => d.id === activeId) ?? null;

  function handleStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const deal = deals.find((d) => d.id === String(e.active.id));
    if (!deal) return;
    if (columnForStage(deal.stage) === overId) return;
    const col = columnById(overId);
    if (!col) return;
    onMove(deal.id, col.primaryStage);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((col) => {
          const items = byColumn[col.id] ?? [];
          const total = items.reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
          return (
            <Column
              key={col.id}
              id={col.id}
              label={t(col.labelKey, { defaultValue: col.fallbackLabel }) as string}
              count={items.length}
              total={money(total, currency)}
            >
              {items.map((d) => (
                <DealCard
                  key={d.id}
                  deal={d}
                  currency={currency}
                  canEdit={canEdit}
                  ownerLabel={ownerLabel}
                  onOpen={onOpen}
                  onMove={onMove}
                />
              ))}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("deals.board_empty_column", { defaultValue: "No deals" })}
                </div>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <div className="w-[260px] rotate-1">
            <CardBody deal={activeDeal} currency={currency} ownerLabel={ownerLabel} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  label,
  count,
  total,
  children,
}: {
  id: string;
  label: string;
  count: number;
  total: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[272px] shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition",
        isOver && "border-foreground bg-muted",
      )}
    >
      <div className="px-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="rounded-full border bg-background px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {count}
          </span>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">{total}</div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CardBody({
  deal,
  currency,
  ownerLabel,
}: {
  deal: BoardDeal;
  currency: string;
  ownerLabel: (id: string | null) => string;
}) {
  return (
    <div className="rounded-md border bg-background p-3 shadow-sm">
      <div className="truncate text-sm font-medium">{deal.client_name}</div>
      {deal.client_company && (
        <div className="truncate text-xs text-muted-foreground">{deal.client_company}</div>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        <span className="whitespace-nowrap">
          {deal.event_date ? formatEventDate(deal.event_date) : "—"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">
          {money(Number(deal.estimated_value || 0), currency)}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
            stageToneClass(deal.stage),
          )}
        >
          {stageLabel(deal.stage)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span className="truncate">{ownerLabel(deal.owner_id)}</span>
      </div>
    </div>
  );
}

function DealCard({
  deal,
  currency,
  canEdit,
  ownerLabel,
  onOpen,
  onMove,
}: {
  deal: BoardDeal;
  currency: string;
  canEdit: boolean;
  ownerLabel: (id: string | null) => string;
  onOpen: (id: string) => void;
  onMove: (id: string, stage: string) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    disabled: !canEdit,
  });

  return (
    <div className={cn("relative", isDragging && "opacity-40")}>
      <div
        ref={setNodeRef}
        {...(canEdit ? listeners : {})}
        {...attributes}
        role="button"
        tabIndex={0}
        className={cn("cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md", canEdit && "cursor-grab active:cursor-grabbing")}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-card-menu]")) return;
          onOpen(deal.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen(deal.id);
          }
        }}
      >
        <CardBody deal={deal} currency={currency} ownerLabel={ownerLabel} />
      </div>
      {canEdit && (
        <div className="absolute bottom-1.5 right-1.5" data-card-menu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-muted-foreground"
              >
                {t("deals.move_to_stage")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>{t("deals.move_to_stage")}</DropdownMenuLabel>
              {STAGE_ORDER.map((s) => (
                <DropdownMenuItem
                  key={s}
                  disabled={s === deal.stage}
                  onSelect={() => onMove(deal.id, s)}
                >
                  {stageLabel(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
