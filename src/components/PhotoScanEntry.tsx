import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export interface ScannedEntry {
  article: string;
  quantity: number | "";
  lotNumber: string;
}

interface Props {
  articles: string[];
  onConfirm: (entries: ScannedEntry[]) => Promise<void> | void;
  buttonLabel?: string;
  /** Masque la colonne « N° lot » (scans des stocks finaux emporter/salle). */
  showLotNumber?: boolean;
}

export function PhotoScanEntry({ articles, onConfirm, buttonLabel = "Scanner photo", showLotNumber = true }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ScannedEntry[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEntries([]);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // Les photos de téléphone font plusieurs Mo : on les réduit avant envoi,
      // c'est ce qui rendait l'analyse très lente.
      const compressed = await compressImage(file);
      const buf = await compressed.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const body = { imageBase64: base64, mimeType: compressed.mimeType, articles };
      let { data, error } = await supabase.functions.invoke("scan-stock-entry", { body });
      if (error && (error as any).context?.status === 401) {
        await supabase.auth.refreshSession();
        ({ data, error } = await supabase.functions.invoke("scan-stock-entry", { body }));
      }
      if (error) {
        let msg = error.message;
        try {
          const j = await (error as any).context?.json?.();
          if (j?.error) msg = j.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const detected: ScannedEntry[] = (data?.entries || []).map((e: any) => ({
        article: matchArticle(e.article, articles) || "",
        quantity: typeof e.quantity === "number" ? e.quantity : "",
        lotNumber: e.lotNumber || "",
      }));
      if (detected.length === 0) {
        toast.warning("Aucune donnée détectée. Réessayez avec une photo plus nette.");
      } else {
        toast.success(`${detected.length} entrée(s) détectée(s)`);
      }
      // Plusieurs scans possibles avant validation : on fusionne avec les
      // entrées déjà détectées (même article + même lot => quantités additionnées).
      setEntries((prev) => {
        const merged = [...prev];
        for (const d of detected) {
          const idx = merged.findIndex(
            (m) => m.article === d.article && m.lotNumber === d.lotNumber && d.article !== "",
          );
          if (idx >= 0 && typeof merged[idx].quantity === "number" && typeof d.quantity === "number") {
            merged[idx] = { ...merged[idx], quantity: (merged[idx].quantity as number) + d.quantity };
          } else {
            merged.push(d);
          }
        }
        return merged;
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const valid = entries.filter(
      (e) => e.article && typeof e.quantity === "number" && e.quantity > 0,
    );
    if (valid.length === 0) {
      toast.error("Aucune entrée valide");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(valid);
      toast.success(`${valid.length} entrée(s) enregistrée(s)`);
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Camera className="h-4 w-4" />
        {buttonLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" /> Scanner une entrée stock
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              {loading ? (
                <Button type="button" variant="default" disabled className="w-full">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse en cours...
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => fileRef.current?.click()}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Prendre photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => galleryRef.current?.click()}
                    className="w-full"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Galerie
                  </Button>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="rounded-md border overflow-hidden bg-muted">
                <img src={previewUrl} alt="Aperçu" className="max-h-48 w-full object-contain" />
              </div>
            )}

            {entries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Vérifiez et ajustez les données détectées — vous pouvez ajouter d'autres scans avant de valider :
                  </p>
                  <button
                    type="button"
                    onClick={() => setEntries([])}
                    className="text-xs text-destructive hover:underline whitespace-nowrap"
                  >
                    Tout effacer
                  </button>
                </div>
                <div className="space-y-2">
                  {entries.map((e, i) => (
                    <div
                      key={i}
                      className={`grid gap-2 items-center bg-muted/40 p-2 rounded-md ${showLotNumber ? "grid-cols-12" : "grid-cols-12"}`}
                    >
                      <div className={showLotNumber ? "col-span-5" : "col-span-7"}>
                        <label className="text-[10px] text-muted-foreground">Article</label>
                        <Select
                          value={e.article}
                          onValueChange={(v) =>
                            setEntries((prev) =>
                              prev.map((p, idx) => (idx === i ? { ...p, article: v } : p)),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            {articles.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className={showLotNumber ? "col-span-3" : "col-span-4"}>
                        <label className="text-[10px] text-muted-foreground">Quantité</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={e.quantity}
                          onChange={(ev) =>
                            setEntries((prev) =>
                              prev.map((p, idx) =>
                                idx === i
                                  ? {
                                      ...p,
                                      quantity:
                                        ev.target.value === "" ? "" : Number(ev.target.value),
                                    }
                                  : p,
                              ),
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      {showLotNumber && (
                        <div className="col-span-3">
                          <label className="text-[10px] text-muted-foreground">N° lot</label>
                          <Input
                            value={e.lotNumber}
                            onChange={(ev) =>
                              setEntries((prev) =>
                                prev.map((p, idx) =>
                                  idx === i ? { ...p, lotNumber: ev.target.value } : p,
                                ),
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEntries((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="col-span-1 text-destructive hover:bg-destructive/10 rounded p-1 mt-3 justify-self-center"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={entries.length === 0 || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...
                </>
              ) : (
                "Valider et enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Réduit la photo (max 1280 px, JPEG qualité 0,7) avant l'envoi à l'analyse.
 * Une photo de téléphone de 4 Mo tombe ainsi à ~200 Ko : l'upload et l'analyse
 * sont nettement plus rapides sans perte de lisibilité du texte.
 */
async function compressImage(
  file: File,
  maxSide = 1280,
  quality = 0.7,
): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("no blob");
    return { blob, mimeType: "image/jpeg" };
  } catch {
    return { blob: file, mimeType: file.type || "image/jpeg" };
  }
}

function matchArticle(detected: string | null | undefined, list: string[]): string | null {
  if (!detected) return null;
  const d = detected.toLowerCase().trim();
  const exact = list.find((a) => a.toLowerCase() === d);
  if (exact) return exact;
  const partial = list.find(
    (a) => a.toLowerCase().includes(d) || d.includes(a.toLowerCase()),
  );
  return partial || detected;
}