import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, CameraOff, UserPlus, Trash2, RefreshCw, ScanFace, Users, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOperators } from "@/lib/roster";
import { computeDescriptor, findBestMatch, loadFaceApi, MATCH_THRESHOLD, type FaceCandidate } from "@/lib/faceRecognition";
import {
  addPunch,
  createAgent,
  deleteAgent,
  deletePunch,
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

export function AttendanceModule() {
  const { pdvId, can } = useAuth();
  const canManage = can("manage_attendance");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant={view === "pointage" ? "default" : "outline"} size="sm" onClick={() => setView("pointage")}>
          <ScanFace className="w-4 h-4 mr-1" /> Pointage
        </Button>
        <Button variant={view === "journal" ? "default" : "outline"} size="sm" onClick={() => setView("journal")}>
          <ListChecks className="w-4 h-4 mr-1" /> Journal du jour
        </Button>
        {canManage && (
          <Button variant={view === "agents" ? "default" : "outline"} size="sm" onClick={() => setView("agents")}>
            <Users className="w-4 h-4 mr-1" /> Agents ({agents.length})
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {view === "pointage" && <PunchView agents={agents} punches={punches} onDone={reload} />}
      {view === "journal" && <JournalView punches={punches} canManage={canManage} onChanged={reload} />}
      {view === "agents" && canManage && <AgentsView agents={agents} onChanged={reload} />}
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
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
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
    setStatus("Présentez votre visage devant la caméra");
  };

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
  }, [on, ready, pdvId, candidates, doneFor, onDone, videoRef]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="relative rounded-lg overflow-hidden bg-muted aspect-[4/3] max-w-md mx-auto">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {!on && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Caméra éteinte
            </div>
          )}
        </div>

        <p className="text-center text-sm font-medium">{status}</p>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex justify-center gap-2">
          {!on ? (
            <Button onClick={() => void handleStart()}>
              <Camera className="w-4 h-4 mr-1" /> Démarrer le pointage
            </Button>
          ) : (
            <Button variant="outline" onClick={stop}>
              <CameraOff className="w-4 h-4 mr-1" /> Arrêter
            </Button>
          )}
        </div>

        {candidates.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Aucun agent enrôlé sur ce point de vente. Ajoutez-les dans l'onglet « Agents ».
          </p>
        )}
      </Card>

      {last && (
        <Card className="p-4 border-primary/40 bg-primary/5 text-center">
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
  canManage,
  onChanged,
}: {
  punches: AttendancePunch[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const byAgent = useMemo(() => {
    const map = new Map<string, AttendancePunch[]>();
    punches.forEach((p) => {
      const k = p.agent_id ?? p.agent_name;
      map.set(k, [...(map.get(k) ?? []), p]);
    });
    return Array.from(map.entries()).map(([, list]) => ({
      name: list[0].agent_name,
      list: [...list].sort((a, b) => a.punched_at.localeCompare(b.punched_at)),
    }));
  }, [punches]);

  if (byAgent.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Aucun pointage aujourd'hui.</Card>;
  }

  return (
    <div className="space-y-3">
      {byAgent.map((row) => (
        <Card key={row.name} className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-semibold">{row.name}</p>
            <Badge variant="secondary">{workedHours(row.list).toFixed(2)} h</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PUNCH_ORDER.map((t) => {
              const p = row.list.find((x) => x.punch_type === t);
              return (
                <div key={t} className="rounded border p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{PUNCH_LABELS[t]}</p>
                  <p className="text-sm font-semibold">{p ? formatTime(p.punched_at) : "—"}</p>
                  {p && canManage && (
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
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Agents */

function AgentsView({ agents, onChanged }: { agents: AttendanceAgent[]; onChanged: () => Promise<void> | void }) {
  const { pdvId } = useAuth();
  const operators = useOperators();
  const { videoRef, on, error, start, stop } = useCamera();
  const [name, setName] = useState("");
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
    if (!pdvId) return;
    setSaving(true);
    try {
      if (targetId) {
        const existing = agents.find((a) => a.id === targetId);
        await updateAgentDescriptors(targetId, [...(existing?.descriptors ?? []), ...shots]);
        toast.success("Visage ajouté à l'agent");
      } else {
        if (!name.trim()) {
          toast.error("Indiquez le nom de l'agent");
          return;
        }
        await createAgent(pdvId, name, shots);
        toast.success("Agent enrôlé");
      }
      setShots([]);
      setName("");
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
        <p className="font-semibold text-sm">
          {targetId ? "Ajouter un visage à un agent existant" : "Enrôler un nouvel agent"}
        </p>

        {!targetId && (
          <>
            <Input
              list="attendance-operators"
              placeholder="Nom de l'agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="attendance-operators">
              {operators.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </>
        )}

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
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm(`Supprimer ${a.full_name} ?`)) return;
                  await deleteAgent(a.id);
                  await onChanged();
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
        {agents.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun agent enrôlé.</Card>
        )}
      </div>
    </div>
  );
}
