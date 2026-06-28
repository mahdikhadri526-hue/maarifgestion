import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, ClipboardCheck, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listSessions,
  InventorySession,
  deleteSession,
} from "@/lib/inventoryData";
import { NewSessionDialog } from "./NewSessionDialog";
import { CountingView } from "./CountingView";
import { ReconciliationView } from "./ReconciliationView";
import { toast } from "sonner";

export function InventoryModule() {
  const { user, can } = useAuth();
  const isManager = can("manage_inventory");
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setSessions(await listSessions());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("inv-sessions-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_sessions" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  if (activeSession) {
    const isCounter =
      user?.id === activeSession.counterAUserId || user?.id === activeSession.counterBUserId;
    const showReconcile =
      isManager && (activeSession.status === "reconciling" || activeSession.status === "closed");
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux sessions
        </Button>
        {showReconcile ? (
          <ReconciliationView session={activeSession} />
        ) : isCounter && activeSession.status === "counting" ? (
          <CountingView session={activeSession} />
        ) : isManager && activeSession.status === "counting" ? (
          <ManagerCountingMonitor session={activeSession} />
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            {activeSession.status === "closed"
              ? "Cette session est clôturée."
              : "Vous n'êtes pas assigné à cette session."}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Inventaire
          </h2>
          <p className="text-sm text-muted-foreground">
            Sessions de comptage à double aveugle (deux compteurs indépendants).
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle session
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Chargement…</Card>
      ) : sessions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Aucune session pour le moment.</Card>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isManager={isManager}
              currentUserId={user?.id ?? null}
              onOpen={() => setActiveId(s.id)}
              onDelete={async () => {
                if (!confirm("Supprimer définitivement cette session ?")) return;
                try {
                  await deleteSession(s.id);
                  toast.success("Session supprimée");
                  refresh();
                } catch (e: any) {
                  toast.error(e.message ?? "Erreur");
                }
              }}
            />
          ))}
        </div>
      )}

      <NewSessionDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={(id) => {
          setOpenNew(false);
          setActiveId(id);
          refresh();
        }}
      />
    </div>
  );
}

function SessionCard({
  session,
  isManager,
  currentUserId,
  onOpen,
  onDelete,
}: {
  session: InventorySession;
  isManager: boolean;
  currentUserId: string | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const statusLabel: Record<string, string> = {
    counting: "Comptage en cours",
    reconciling: "Rapprochement",
    closed: "Clôturée",
  };
  const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
    counting: "default",
    reconciling: "secondary",
    closed: "outline",
  };
  const youAreCounter =
    currentUserId &&
    (currentUserId === session.counterAUserId || currentUserId === session.counterBUserId);
  return (
    <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold">{session.label}</div>
          <Badge variant={statusVariant[session.status]}>{statusLabel[session.status]}</Badge>
          {youAreCounter && <Badge variant="outline">Vous comptez</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Date : {new Date(session.sessionDate).toLocaleDateString("fr-FR")} · A:{" "}
          {session.counterADone ? "✅" : "⏳"} · B: {session.counterBDone ? "✅" : "⏳"}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onOpen}>
          <Search className="h-4 w-4 mr-1" /> Ouvrir
        </Button>
        {isManager && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function ManagerCountingMonitor({ session }: { session: InventorySession }) {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-2">{session.label}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Comptage en cours. Les saisies des compteurs sont masquées jusqu'à la phase de
        rapprochement.
      </p>
      <div className="text-sm space-y-1">
        <div>Compteur A : {session.counterADone ? "Terminé ✅" : "En cours ⏳"}</div>
        <div>Compteur B : {session.counterBDone ? "Terminé ✅" : "En cours ⏳"}</div>
      </div>
      {session.counterADone && session.counterBDone && (
        <div className="mt-4">
          <PassToReconcileButton sessionId={session.id} />
        </div>
      )}
    </Card>
  );
}

function PassToReconcileButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { setSessionStatus } = await import("@/lib/inventoryData");
          await setSessionStatus(sessionId, "reconciling");
          toast.success("Passage au rapprochement");
        } catch (e: any) {
          toast.error(e.message ?? "Erreur");
        } finally {
          setLoading(false);
        }
      }}
    >
      Lancer le rapprochement
    </Button>
  );
}