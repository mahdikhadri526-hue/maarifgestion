import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, CameraOff, UserPlus, RefreshCw, ScanFace, Users, ListChecks, Lock, Maximize, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { computeDescriptor, findBestMatch, loadFaceApi, MATCH_THRESHOLD, type FaceCandidate } from "@/lib/faceRecognition";
import {
  addPunch,
  deletePunch,
  saveManualPunch,
  formatTime,
  getAgents,
  getPunches,
  nextPunchType,
  PUNCH_LABELS,
  PUNCH_ORDER,
  setAgentActive,
  todayISO,
  updateAgentDescriptors,
  workedHours,
  type AttendanceAgent,
  type AttendancePunch,
  type PunchType,
} from "@/lib/attendanceData";

type View = "pointage" | "agents" | "journal";

const COOLDOWN_MS = 60_000;
const SHOTS_REQUIRED = 3;

const KIOSK_PIN = "1975";

export function AttendanceModule({ onExit }: { onExit?: () => void }) {
  const { pdvId, can } = useAuth();
  const canManage = can("manage_attendance");
  const [unlocked, setUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinAction, setPinAction] = useState<"unlock" | "fullscreen" | "exit">("unlock");
  const [fullscreen, setFullscreen] = useState(true);
  const [view, setView] = useState<View>("pointage");
  const [agents, setAgents] = useState<AttendanceAgent[]>([]);
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!pdvId) return;
    setLoading(true);
    try {
      const [a, p] = await Promise.all([getAgents(pdvId), getPunches(pdvId, todayISO(), todayISO())]);
      setAgents(a);
      setPunches(p);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [pdvId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Le plein écran navigateur exige un geste de l'utilisateur : il s'enclenche
  // au premier toucher/clic une fois la vue plein écran active.
  useEffect(() => {
    if (!fullscreen) return;
    const enter = () => {
      if (document.fullscreenElement) return;
      try {
        void document.documentElement.requestFullscreen?.().catch(() => undefined);
      } catch {
        /* indisponible */
      }
    };
    window.addEventListener("pointerdown", enter, { once: true });
    return () => window.removeEventListener("pointerdown", enter);
  }, [fullscreen]);

  // Activation du plein écran sans code (le code n'est exigé que pour quitter/déverrouiller)
  const activateFullscreen = () => {
    setFullscreen(true);
    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      /* plein écran navigateur non disponible */
    }
  };

  // Verrouillage automatique de l'accès réservé après 10 s sans utilisation
  useEffect(() => {
    if (!unlocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setUnlocked(false);
        setView("pointage");
        toast.info("Accès réservé verrouillé (inactivité)");
      }, 10_000);
    };
    reset();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [unlocked]);

  const submitPin = () => {
    if (pin !== KIOSK_PIN) {
      toast.error("Code incorrect");
      setPin("");
      return;
    }
    setPinOpen(false);
    setPin("");
    if (pinAction === "exit") {
      setFullscreen(false);
      try {
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* ignore */
      }
    } else {
      setUnlocked(true);
    }
    setPinAction("unlock");
  };

  const lock = () => {
    setUnlocked(false);
    setView("pointage");
  };

  const openPin = (action: "unlock" | "fullscreen" | "exit") => {
    setPinAction(action);
    setPinOpen(true);
  };

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-4">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 right-3"
          onClick={() => openPin("exit")}
        >
          <X className="w-4 h-4" />
        </Button>
        <div className="w-full flex-1 flex flex-col min-h-0">
          <PunchView agents={agents} punches={punches} onDone={reload} />
        </div>
        <Dialog open={pinOpen} onOpenChange={(o) => { setPinOpen(o); if (!o) setPin(""); }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>Quitter le plein écran</DialogTitle>
            </DialogHeader>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="Code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPin()}
              autoFocus
            />
            <Button onClick={submitPin}>Valider</Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {unlocked ? (
          <>
            <Button variant={view === "pointage" ? "default" : "outline"} size="sm" onClick={() => setView("pointage")}>
              <ScanFace className="w-4 h-4 mr-1" /> Pointage
            </Button>
            <Button variant={view === "journal" ? "default" : "outline"} size="sm" onClick={() => setView("journal")}>
              <ListChecks className="w-4 h-4 mr-1" /> Journal du jour
            </Button>
            {canManage && (
              <Button variant={view === "agents" ? "default" : "outline"} size="sm" onClick={() => setView("agents")}>
                <Users className="w-4 h-4 mr-1" /> Employés ({agents.length})
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={lock}>
              <Lock className="w-4 h-4 mr-1" /> Verrouiller
            </Button>
            {onExit && (
              <Button variant="ghost" size="sm" onClick={onExit}>
                <X className="w-4 h-4 mr-1" /> Quitter
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => openPin("unlock")}>
              <Lock className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={activateFullscreen}>
              <Maximize className="w-4 h-4 mr-1" /> Plein écran
            </Button>
          </>
        )}
      </div>

      {!unlocked && <PunchView agents={agents} punches={punches} onDone={reload} />}
      {unlocked && view === "pointage" && <PunchView agents={agents} punches={punches} onDone={reload} />}
      {unlocked && view === "journal" && <JournalView punches={punches} agents={agents} canManage={canManage} onChanged={reload} />}
      {unlocked && view === "agents" && canManage && <AgentsView agents={agents} onChanged={reload} />}

      <Dialog open={pinOpen} onOpenChange={(o) => { setPinOpen(o); if (!o) setPin(""); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Accès réservé</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="Code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPin()}
            autoFocus
          />
          <Button onClick={submitPin}>Déverrouiller</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* ------------------------------------------------------------------ Caméra */

function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setOn(true);
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Accès à la caméra refusé. Autorisez la caméra dans le navigateur."
          : "Caméra indisponible sur cet appareil.",
      );
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, on, error, start, stop };
}

/* ------------------------------------------------------------------ Pointage */

function PunchView({
  agents,
  punches,
  onDone,
}: {
  agents: AttendanceAgent[];
  punches: AttendancePunch[];
  onDone: () => Promise<void> | void;
}) {
  const { pdvId } = useAuth();
  const { videoRef, on, error, start, stop } = useCamera();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Caméra éteinte");
  const [last, setLast] = useState<{ name: string; type: PunchType; time: string } | null>(null);
  const busy = useRef(false);
  const cooldown = useRef<Record<string, number>>({});
  const lastFaceAt = useRef(0);

  const candidates: FaceCandidate[] = useMemo(
    () =>
      agents
        .filter((a) => a.active && a.descriptors.length > 0)
        .map((a) => ({ id: a.id, name: a.full_name, descriptors: a.descriptors })),
    [agents],
  );

  const doneFor = useCallback(
    (agentId: string): PunchType[] =>
      punches.filter((p) => p.agent_id === agentId).map((p) => p.punch_type as PunchType),
    [punches],
  );

  const handleStart = async () => {
    setStatus("Chargement de la reconnaissance…");
    try {
      await loadFaceApi();
      setReady(true);
    } catch {
      setStatus("Impossible de charger la reconnaissance faciale");
      return;
    }
    await start();
    lastFaceAt.current = Date.now();
    setStatus("Présentez votre visage devant la caméra");
  };

  // Si aucun visage n'est détecté pendant 10 secondes, on coupe la caméra.
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      if (Date.now() - lastFaceAt.current > 10_000) {
        stop();
        setStatus("Aucun visage détecté — caméra arrêtée");
      }
    }, 500);
    return () => clearInterval(id);
  }, [on, stop]);

  useEffect(() => {
    if (!on || !ready || !pdvId) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || busy.current || !videoRef.current || videoRef.current.readyState < 2) return;
      busy.current = true;
      try {
        const desc = await computeDescriptor(videoRef.current);
        if (!desc) {
          setStatus("Aucun visage détecté");
          return;
        }
        lastFaceAt.current = Date.now();
        const match = findBestMatch(desc, candidates);
        if (!match || match.distance > MATCH_THRESHOLD) {
          setStatus("Visage non reconnu — contactez le manager");
          return;
        }
        const now = Date.now();
        if ((cooldown.current[match.id] ?? 0) > now) {
          setStatus(`${match.name} — pointage déjà enregistré, patientez`);
          return;
        }
        const next = nextPunchType(doneFor(match.id));
        if (!next) {
          setStatus(`${match.name} — journée déjà complète`);
          cooldown.current[match.id] = now + COOLDOWN_MS;
          stop();
          return;
        }
        cooldown.current[match.id] = now + COOLDOWN_MS;
        await addPunch({
          pdvId,
          agentId: match.id,
          agentName: match.name,
          punchType: next,
          matchScore: Number((1 - match.distance).toFixed(3)),
        });
        setLast({ name: match.name, type: next, time: formatTime(new Date().toISOString()) });
        setStatus(`${PUNCH_LABELS[next]} enregistrée pour ${match.name}`);
        await onDone();
        // Visage reconnu et pointage enregistré : on coupe la caméra.
        stop();
      } catch (e: any) {
        setStatus(e?.message ?? "Erreur de pointage");
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(() => void tick(), 900);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [on, ready, pdvId, candidates, doneFor, onDone, videoRef, stop]);

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-2rem)]">
      {!on && (
        <Button onClick={() => void handleStart()} className="w-full text-base py-5 shrink-0">
          <Camera className="w-5 h-5 mr-1" /> Démarrer le pointage
        </Button>
      )}

      <Card className="p-3 flex-1 flex flex-col min-h-[60vh]">
        <div className="relative rounded-lg overflow-hidden bg-muted flex-1 min-h-0">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
          {!on && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Caméra éteinte
            </div>
          )}
        </div>
        <p className="text-center text-sm font-medium mt-2 shrink-0">{status}</p>
        {error && <p className="text-center text-sm text-destructive shrink-0">{error}</p>}
        {candidates.length === 0 && (
          <p className="text-center text-xs text-muted-foreground shrink-0">
            Aucun agent enrôlé sur ce point de vente. Ajoutez-les dans l'onglet « Agents ».
          </p>
        )}
      </Card>

      {last && (
        <Card className="p-4 border-primary/40 bg-primary/5 text-center shrink-0">
          <p className="text-lg font-bold">{last.name}</p>
          <p className="text-sm">
            {PUNCH_LABELS[last.type]} à <span className="font-semibold">{last.time}</span>
          </p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Journal */

function JournalView({
  punches,
  agents,
  canManage,
  onChanged,
}: {
  punches: AttendancePunch[];
  agents: AttendanceAgent[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const { pdvId, user } = useAuth();
  const [edit, setEdit] = useState<{
    agentId: string | null;
    agentName: string;
    type: PunchType;
    existing: AttendancePunch | null;
  } | null>(null);
  const [time, setTime] = useState("");
  const [managerName, setManagerName] = useState("");
  const [motif, setMotif] = useState("");
  const [addAgent, setAddAgent] = useState("");
  const [saving, setSaving] = useState(false);
  const managers = useMemo(
    () => agents.filter((a) => a.staff_level === "manager").map((a) => a.full_name).sort((x, y) => x.localeCompare(y, "fr")),
    [agents]
  );


  const byAgent = useMemo(() => {
    const map = new Map<string, AttendancePunch[]>();
    punches.forEach((p) => {
      const k = p.agent_id ?? p.agent_name;
      map.set(k, [...(map.get(k) ?? []), p]);
    });
    const rows = Array.from(map.entries()).map(([, list]) => ({
      agentId: list[0].agent_id,
      name: list[0].agent_name,
      list: [...list].sort((a, b) => a.punched_at.localeCompare(b.punched_at)),
    }));
    if (addAgent && !rows.some((r) => r.agentId === addAgent)) {
      const a = agents.find((x) => x.id === addAgent);
      if (a) rows.push({ agentId: a.id, name: a.full_name, list: [] });
    }
    return rows;
  }, [punches, addAgent, agents]);

  const openEdit = (agentId: string | null, agentName: string, type: PunchType, existing: AttendancePunch | null) => {
    setEdit({ agentId, agentName, type, existing });
    setTime(existing ? formatTime(existing.punched_at) : formatTime(new Date().toISOString()));
    setManagerName("");
    setMotif("");
  };

  const save = async () => {
    if (!edit || !pdvId || !/^\d{2}:\d{2}$/.test(time)) {
      toast.error("Heure invalide");
      return;
    }
    if (!managerName.trim() || !motif.trim()) {
      toast.error("Nom du manager et motif obligatoires");
      return;
    }
    setSaving(true);
    try {
      await saveManualPunch({
        pdvId,
        existingId: edit.existing?.id ?? null,
        agentId: edit.agentId,
        agentName: edit.agentName,
        punchType: edit.type,
        date: edit.existing?.punch_date ?? todayISO(),
        time,
        by: user?.email ?? "manager",
        managerName: managerName.trim(),
        motif: motif.trim(),
      });
      toast.success("Pointage manuel enregistré");
      setEdit(null);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const activeAgents = agents.filter((a) => a.active && !byAgent.some((r) => r.agentId === a.id));

  return (
    <div className="space-y-3">
      {canManage && (
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Ajouter un pointage manuel pour :</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value=""
            onChange={(e) => setAddAgent(e.target.value)}
          >
            <option value="">Choisir un employé…</option>
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">Les pointages manuels sont signalés « Manuel » dans les rapports.</span>
        </Card>
      )}
      {byAgent.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Aucun pointage aujourd'hui.</Card>
      )}
      {byAgent.map((row) => (
        <Card key={row.agentId ?? row.name} className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-semibold">{row.name}</p>
            <Badge variant="secondary">{workedHours(row.list).toFixed(2)} h</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PUNCH_ORDER.map((t) => {
              const p = row.list.find((x) => x.punch_type === t);
              const manual = p?.method === "manual";
              return (
                <div key={t} className={`rounded border p-2 text-center ${manual ? "border-warning bg-warning/10" : ""}`}>
                  <p className="text-[11px] text-muted-foreground">{PUNCH_LABELS[t]}</p>
                  <p className="text-sm font-semibold">{p ? formatTime(p.punched_at) : "—"}</p>
                  {manual && (
                    <Badge variant="outline" className="text-[9px]" title={p?.device_label ?? ""}>
                      Manuel
                    </Badge>
                  )}
                  {canManage && (
                    <div className="flex justify-center gap-2 mt-1">
                      <button
                        className="text-[11px] text-primary underline"
                        onClick={() => openEdit(row.agentId, row.name, t, p ?? null)}
                      >
                        {p ? "modifier" : "ajouter"}
                      </button>
                      {p && (
                        <button
                          className="text-[11px] text-destructive underline"
                          onClick={async () => {
                            await deletePunch(p.id);
                            await onChanged();
                          }}
                        >
                          supprimer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pointage manuel — {edit?.agentName} ({edit ? PUNCH_LABELS[edit.type] : ""})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <select
              className="border rounded px-2 py-1.5 text-sm bg-background"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            >
              <option value="">Choisir un manager…</option>
              {managers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Input
              placeholder="Motif de la rectification (obligatoire)"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={200}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Ce pointage sera marqué « Manuel » avec le nom du manager et le motif sur le journal et tous les rapports RH.
          </p>
          <Button onClick={save} disabled={saving}>
            Enregistrer
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Agents */

function AgentsView({ agents, onChanged }: { agents: AttendanceAgent[]; onChanged: () => Promise<void> | void }) {
  const { videoRef, on, error, start, stop } = useCamera();
  const [shots, setShots] = useState<number[][]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  const openCamera = async () => {
    setStatus("Chargement de la reconnaissance…");
    await loadFaceApi();
    await start();
    setStatus("Cadrez le visage puis capturez 3 photos");
  };

  const capture = async () => {
    if (!videoRef.current) return;
    setStatus("Analyse…");
    const desc = await computeDescriptor(videoRef.current);
    if (!desc) {
      setStatus("Aucun visage détecté — recadrez et réessayez");
      return;
    }
    setShots((s) => [...s, Array.from(desc)]);
    setStatus(`Photo ${shots.length + 1}/${SHOTS_REQUIRED} enregistrée`);
  };

  const save = async () => {
    if (!targetId) {
      toast.error("Choisissez l'employé (créé dans la table RH)");
      return;
    }
    setSaving(true);
    try {
      const existing = agents.find((a) => a.id === targetId);
      await updateAgentDescriptors(targetId, [...(existing?.descriptors ?? []), ...shots]);
      toast.success("Visage enregistré");
      setShots([]);
      setTargetId(null);
      stop();
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <p className="font-semibold text-sm">Enregistrer le visage d'un employé</p>
        <p className="text-xs text-muted-foreground">
          La création des employés se fait uniquement dans la table RH ; leur nom apparaît ensuite ici.
        </p>

        <select
          className="w-full h-9 rounded-md border bg-background px-2 text-sm"
          value={targetId ?? ""}
          onChange={(e) => {
            setTargetId(e.target.value || null);
            setShots([]);
            setStatus("");
          }}
        >
          <option value="">Employé…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
              {a.descriptors.length > 0 ? ` (${a.descriptors.length} visage(s))` : ""}
            </option>
          ))}
        </select>


        <div className="relative rounded-lg overflow-hidden bg-muted aspect-[4/3] max-w-md mx-auto">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {!on && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Caméra éteinte
            </div>
          )}
        </div>

        <p className="text-center text-sm">{status}</p>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap justify-center gap-2">
          {!on ? (
            <Button size="sm" onClick={() => void openCamera()}>
              <Camera className="w-4 h-4 mr-1" /> Ouvrir la caméra
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => void capture()}>
                <ScanFace className="w-4 h-4 mr-1" /> Capturer ({shots.length}/{SHOTS_REQUIRED})
              </Button>
              <Button size="sm" variant="outline" onClick={stop}>
                <CameraOff className="w-4 h-4 mr-1" /> Fermer
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="default"
            disabled={shots.length < SHOTS_REQUIRED || saving}
            onClick={() => void save()}
          >
            <UserPlus className="w-4 h-4 mr-1" /> Enregistrer
          </Button>
          {targetId && (
            <Button size="sm" variant="ghost" onClick={() => { setTargetId(null); setShots([]); }}>
              Annuler
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        {agents.map((a) => (
          <Card key={a.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {a.descriptors.length} visage(s) enregistré(s){!a.active && " — désactivé"}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => { setTargetId(a.id); setShots([]); setStatus(""); }}>
                + visage
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await setAgentActive(a.id, !a.active);
                  await onChanged();
                }}
              >
                {a.active ? "Désactiver" : "Activer"}
              </Button>
            </div>
          </Card>
        ))}
        {agents.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Aucun employé. Créez-le d'abord dans la table RH.
          </Card>
        )}
      </div>
    </div>
  );
}
