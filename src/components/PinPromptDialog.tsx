import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { toast } from "sonner";

const ACTION_PIN = "1975";

interface PinPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export function PinPromptDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Code requis",
  description = "Entrez le code à 4 chiffres pour confirmer cette action.",
}: PinPromptDialogProps) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!open) setPin("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ACTION_PIN) {
      onOpenChange(false);
      onConfirm();
    } else {
      toast.error("Code incorrect");
      setPin("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="● ● ● ●"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pin.length !== 4}>
              Confirmer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}