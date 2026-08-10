import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DELETE_DEAL_WARNING, deleteDeal } from "@/lib/deal-lifecycle";

/** Confirm dialog for permanently deleting a deal and everything attached. */
export function DeleteDealDialog({
  open,
  onOpenChange,
  dealId,
  clientName,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  clientName?: string;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await deleteDeal(dealId);
      toast.success("Deal deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete this deal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {clientName ? `“${clientName}”` : "this deal"} permanently?
          </AlertDialogTitle>
          <AlertDialogDescription>{DELETE_DEAL_WARNING}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
