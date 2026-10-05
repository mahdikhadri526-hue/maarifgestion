import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Images, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addWelcomePhotos, loadWelcomePhotos, removeWelcomePhoto, swapWelcomePhotos, type WelcomePhoto } from "@/lib/welcomePhotos";

export function WelcomePhotosSettings() {
  const [photos, setPhotos] = useState<WelcomePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const list = await loadWelcomePhotos();
    setPhotos(list);
  };

  useEffect(() => { void refresh().catch(() => toast.error("Photos d’accueil indisponibles")); }, []);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      await addWelcomePhotos(Array.from(files), Math.max(-1, ...photos.map((p) => p.position)) + 1);
      await refresh();
      toast.success("Photos ajoutées à l’accueil");
    } catch (error) {
      await refresh().catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Impossible d’ajouter les photos");
    } finally {
      if (input.current) input.current.value = "";
      setBusy(false);
    }
  };

  const remove = async (photo: WelcomePhoto) => {
    setBusy(true);
    try {
      await removeWelcomePhoto(photo);
      await refresh();
      toast.success("Photo retirée");
    } catch { toast.error("Impossible de retirer la photo"); }
    finally { setBusy(false); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const other = photos[index + direction];
    if (!other) return;
    setBusy(true);
    try {
      await swapWelcomePhotos(photos[index], other);
      await refresh();
    } catch { toast.error("Impossible de modifier l’ordre"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Images className="h-4 w-4 text-primary" /> Photos de bienvenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="Choisir les photos de bienvenue" onChange={(e) => void upload(e.target.files)} />
        <Button type="button" size="sm" disabled={busy} onClick={() => input.current?.click()}><Plus className="h-4 w-4" /> Ajouter des photos</Button>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="overflow-hidden rounded-md border bg-card">
                <img src={photo.url} alt={`Photo d’accueil ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                <div className="flex items-center justify-between gap-1 p-1">
                  <span className="pl-1 text-xs text-muted-foreground">{index + 1}</span>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Déplacer avant" aria-label="Déplacer avant" disabled={busy || index === 0} onClick={() => void move(index, -1)}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Déplacer après" aria-label="Déplacer après" disabled={busy || index === photos.length - 1} onClick={() => void move(index, 1)}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Retirer la photo" aria-label="Retirer la photo" disabled={busy} onClick={() => void remove(photo)}><Trash2 /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}