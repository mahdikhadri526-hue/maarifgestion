import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";

const PIN_CODE = "1950";

interface PinLockProps {
  onUnlock: () => void;
}

export function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN_CODE) {
      onUnlock();
    } else {
      toast.error("Code incorrect");
      setPin("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 rounded-full overflow-hidden shadow-lg">
            <img src={logo} alt="Oliveri Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">K.MAHDI — Gestion de Stock</h1>
          <p className="text-sm text-muted-foreground">Entrez le code PIN pour accéder à l'application</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="● ● ● ●"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="pl-10 text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={pin.length !== 4}>
            Déverrouiller
          </Button>
        </form>
      </div>
    </div>
  );
}
