import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvRoster, RosterKind } from "@/lib/roster";

function Section({
  title,
  kind,
  rows,
  add,
  remove,
}: {
  title: string;
  kind: RosterKind;
  rows: { id: string; kind: RosterKind; name: string }[];
  add: (kind: RosterKind, name: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const list = rows.filter((r) => r.kind === kind);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    const ok = await add(kind, value);
    setBusy(false);
    if (ok) {
      setValue("");
      toast.success("Nom ajouté");
    } else {
      toast.error("Ajout impossible (doublon ou permission manquante)");
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex gap-2">
        <Input
          placeholder="Nom et prénom"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button onClick={submit} disabled={busy || !value.trim()} size="sm">
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun nom.</p>
      ) : (
        <div className="space-y-1">
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border px-2 py-1">
              <span className="text-sm">{r.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const ok = await remove(r.id);
                  ok ? toast.success("Nom supprimé") : toast.error("Suppression impossible");
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RosterManagement() {
  const { pdv, pdvId } = useAuth();
  const { rows, add, remove } = usePdvRoster();

  if (!pdvId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Listes de noms {pdv ? `— ${pdv.name}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Section
          title="Collaborateurs / Effectué par"
          kind="operator"
          rows={rows}
          add={add}
          remove={remove}
        />
        <Section title="Visa manager" kind="manager" rows={rows} add={add} remove={remove} />
      </CardContent>
    </Card>
  );
}
