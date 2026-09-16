import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Maximize, Minimize } from "lucide-react";
import { toast } from "sonner";

const KIOSK_PIN = "1975";

export function KioskToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");

  const submit = async () => {
    if (pin !== KIOSK_PIN) {
      toast.error("Code incorrect");
      setPin("");
      return;
    }
    setOpen(false);
    setPin("");
    try {
      if (!active) await document.documentElement.requestFullscreen?.();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* plein écran navigateur non disponible */
    }
    onChange(!active);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={active ? "fixed top-2 right-2 z-50" : ""}
        onClick={() => setOpen(true)}
        aria-label={active ? "Quitter le mode kiosque" : "Mode kiosque"}
      >
        {active ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPin(""); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{active ? "Quitter le mode kiosque" : "Activer le mode kiosque"}</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="Code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            autoFocus
          />
          <Button onClick={() => void submit()}>Valider</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
