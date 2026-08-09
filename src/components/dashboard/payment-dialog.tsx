import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/money";
import { Printer } from "lucide-react";

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shippingFee: number;
  declaredValue: number;
  discount?: number;
  onFinish?: () => void;
};

export function PaymentDialog({
  open,
  onOpenChange,
  shippingFee,
  declaredValue,
  discount = 0,
  onFinish,
}: PaymentDialogProps) {
  const total = shippingFee - discount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Receive payment</DialogTitle>
        </DialogHeader>

        <dl className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping fee</dt>
            <dd className="font-medium">{money(shippingFee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Declared value</dt>
            <dd className="font-medium">{money(declaredValue)}</dd>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-emerald-600">
              <dt>Discount</dt>
              <dd className="font-medium">−{money(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-3 text-base">
            <dt className="font-semibold">Total</dt>
            <dd className="font-display text-xl font-bold">{money(total)}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label>Payment method</Label>
          <Select defaultValue="cash">
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="mobile">Mobile Money</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="h-12 flex-1 rounded-xl">
            <Printer className="mr-2 h-4 w-4" /> Print receipt
          </Button>
          <Button
            className="h-12 flex-1 rounded-xl"
            onClick={() => {
              onFinish?.();
              onOpenChange(false);
            }}
          >
            Finish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
