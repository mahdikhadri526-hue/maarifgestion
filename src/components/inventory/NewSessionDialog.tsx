import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSession, listProfiles } from "@/lib/inventoryData";
import { toast } from "sonner";
import { formatDateFR } from "@/lib/utils";

export function NewSessionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [counterA, setCounterA] = useState("");
  const [counterB, setCounterB] = useState("");
  const [users, setUsers] = useState<{ userId: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    listProfiles().then(setUsers).catch(() => setUsers([]));
    setLabel(`Inventaire du ${formatDateFR(new Date().toISOString())}`);
  }, [open]);

  const submit = async () => {
    if (!counterA || !counterB) {
      toast.error("Sélectionnez deux compteurs");
      return;
    }
    if (counterA === counterB) {
      toast.error("Les deux compteurs doivent être différents");
      return;
    }
    setLoading(true);
    try {
      const s = await createSession({
        label,
        sessionDate: date,
        counterAUserId: counterA,
        counterBUserId: counterB,
      });
      toast.success("Session créée");
      onCreated(s.id);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle session d'inventaire</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Libellé</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Compteur A</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={counterA}
              onChange={(e) => setCounterA(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Compteur B</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={counterB}
              onChange={(e) => setCounterB(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            La liste des articles à compter (toutes catégories confondues) sera figée à la création.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Création…" : "Créer la session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}