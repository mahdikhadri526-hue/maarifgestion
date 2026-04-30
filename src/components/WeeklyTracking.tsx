import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const ARTICLES = [
  "Tarte 6", "Tarte 8", "Tarte 10", "Tte Sp.", "Tte.Sp 8", "Tte Mac.", "Tte Sor.",
  "Tche Sor.", "Tche Mac.", "Tche Nap.", "Bûche", "Bûche Sp.", "N.F", "Demis",
  "M.L", "M B M", "M B F", "M.Loulou", "Chanty.Fruit confits", "Panachés",
  "Sicilienne vanille", "Sicilienne chocolat", "Sicilienne fraise", "Sicilienne mangue",
  "Nougat", "Praliné", "Vanille", "Chocolat", "Pistache", "Caramel", "Moka",
  "Parfait", "Fraise", "Framboise", "Orange", "Mangue", "Citron", "Pêche",
  "CREME FRAICHE",
];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("fr-FR");
}

type Row = Record<string, any>;

export function WeeklyTracking() {
  const [weekStart, setWeekStart] = useState<string>(fmt(getMonday(new Date())));
  const [tab, setTab] = useState<"creme" | "mouvement">("creme");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const ficheType = tab === "creme" ? "Crème fraîche" : "Mouvement glaces & tartes";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("weekly_tracking")
        .select("*")
        .eq("week_start", weekStart)
        .eq("fiche_type", ficheType);
      if (error) {
        toast.error("Erreur de chargement");
        return;
      }
      setRows(data || []);
    })();
  }, [weekStart, ficheType]);

  const getCell = (key: string, fallback: any = "") => {
    const found = rows.find((r) => r._key === key);
    return found?.data ?? fallback;
  };

  // Build a map for quick access: key = day|rowIndex|article
  const cellMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.day_of_week}|${r.row_index}|${r.article ?? ""}`;
      m.set(key, r);
    }
    return m;
  }, [rows]);

  const updateCell = (
    day: string,
    rowIndex: number,
    article: string | null,
    patch: Partial<Row>,
  ) => {
    const key = `${day}|${rowIndex}|${article ?? ""}`;
    setRows((prev) => {
      const idx = prev.findIndex((r) => `${r.day_of_week}|${r.row_index}|${r.article ?? ""}` === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          fiche_type: ficheType,
          week_start: weekStart,
          day_of_week: day,
          row_index: rowIndex,
          article,
          ...patch,
        },
      ];
    });
  };

  const cell = (day: string, rowIndex: number, article: string | null) =>
    cellMap.get(`${day}|${rowIndex}|${article ?? ""}`) ?? {};

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter rows that have at least one meaningful value
      const meaningful = rows.filter((r) => {
        const fields = ["lot_number", "couleur", "odeur", "texture", "visa_operateur", "visa_manager"];
        const nums = ["stock_initial", "entrees", "sorties"];
        return (
          fields.some((f) => (r[f] ?? "").toString().trim().length > 0) ||
          nums.some((f) => r[f] !== null && r[f] !== undefined && r[f] !== "")
        );
      });

      // Delete existing rows for this week+type then re-insert
      const { error: delErr } = await supabase
        .from("weekly_tracking")
        .delete()
        .eq("week_start", weekStart)
        .eq("fiche_type", ficheType);
      if (delErr) throw delErr;

      if (meaningful.length > 0) {
        const payload = meaningful.map((r) => ({
          fiche_type: ficheType,
          week_start: weekStart,
          day_of_week: r.day_of_week,
          row_index: r.row_index ?? 0,
          article: r.article ?? null,
          lot_number: r.lot_number ?? null,
          couleur: r.couleur ?? null,
          odeur: r.odeur ?? null,
          texture: r.texture ?? null,
          stock_initial: r.stock_initial === "" || r.stock_initial == null ? null : Number(r.stock_initial),
          entrees: r.entrees === "" || r.entrees == null ? null : Number(r.entrees),
          sorties: r.sorties === "" || r.sorties == null ? null : Number(r.sorties),
          visa_operateur: r.visa_operateur ?? null,
          visa_manager: r.visa_manager ?? null,
        }));
        const { error } = await supabase.from("weekly_tracking").insert(payload);
        if (error) throw error;
      }
      toast.success("Suivi hebdomadaire enregistré");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const shiftWeek = (n: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + n * 7);
    setWeekStart(fmt(d));
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-medium">
          Semaine du {new Date(weekStart).toLocaleDateString("fr-FR")} au {addDays(weekStart, 6)}
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="creme">Crème fraîche</TabsTrigger>
          <TabsTrigger value="mouvement">Mouvement glaces & tartes</TabsTrigger>
        </TabsList>

        <TabsContent value="creme" className="mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Jour</th>
                  <th className="p-2 text-left">N° lot crème fraîche</th>
                  <th className="p-2 text-left">Couleur</th>
                  <th className="p-2 text-left">Odeur</th>
                  <th className="p-2 text-left">Texture</th>
                  <th className="p-2 text-left">Visa opérateur</th>
                  <th className="p-2 text-left">Visa manager</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) =>
                  [0, 1].map((rowIdx) => {
                    const c = cell(day, rowIdx, null);
                    const isFirst = rowIdx === 0;
                    return (
                      <tr key={`${day}-${rowIdx}`} className="border-t">
                        {isFirst && (
                          <td rowSpan={2} className="p-2 font-medium border-r align-middle">
                            {day}
                          </td>
                        )}
                        <td className="p-1">
                          <Input
                            value={c.lot_number ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { lot_number: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={c.couleur ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { couleur: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={c.odeur ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { odeur: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={c.texture ?? ""}
                            onChange={(e) => updateCell(day, rowIdx, null, { texture: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        {isFirst && (
                          <>
                            <td rowSpan={2} className="p-1 align-middle">
                              <Input
                                value={cell(day, 0, null).visa_operateur ?? ""}
                                onChange={(e) => updateCell(day, 0, null, { visa_operateur: e.target.value })}
                                className="h-8"
                              />
                            </td>
                            <td rowSpan={2} className="p-1 align-middle">
                              <Input
                                value={cell(day, 0, null).visa_manager ?? ""}
                                onChange={(e) => updateCell(day, 0, null, { visa_manager: e.target.value })}
                                className="h-8"
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="mouvement" className="mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-muted z-10 border-r">Article</th>
                  {DAYS.map((day) => (
                    <th key={day} colSpan={4} className="p-2 text-center border-l">
                      {day}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-1 sticky left-0 bg-muted z-10 border-r"></th>
                  {DAYS.map((day) => (
                    <>
                      <th key={`${day}-si`} className="p-1 border-l text-center font-normal">SI</th>
                      <th key={`${day}-e`} className="p-1 text-center font-normal">E</th>
                      <th key={`${day}-s`} className="p-1 text-center font-normal">S</th>
                      <th key={`${day}-l`} className="p-1 text-center font-normal">N° lot</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ARTICLES.map((article) => (
                  <tr key={article} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-card border-r whitespace-nowrap">
                      {article}
                    </td>
                    {DAYS.map((day) => {
                      const c = cell(day, 0, article);
                      return (
                        <>
                          <td key={`${day}-${article}-si`} className="p-0.5 border-l">
                            <Input
                              type="number"
                              value={c.stock_initial ?? ""}
                              onChange={(e) =>
                                updateCell(day, 0, article, { stock_initial: e.target.value })
                              }
                              className="h-7 w-14 text-xs px-1"
                            />
                          </td>
                          <td key={`${day}-${article}-e`} className="p-0.5">
                            <Input
                              type="number"
                              value={c.entrees ?? ""}
                              onChange={(e) => updateCell(day, 0, article, { entrees: e.target.value })}
                              className="h-7 w-14 text-xs px-1"
                            />
                          </td>
                          <td key={`${day}-${article}-s`} className="p-0.5">
                            <Input
                              type="number"
                              value={c.sorties ?? ""}
                              onChange={(e) => updateCell(day, 0, article, { sorties: e.target.value })}
                              className="h-7 w-14 text-xs px-1"
                            />
                          </td>
                          <td key={`${day}-${article}-l`} className="p-0.5">
                            <Input
                              value={c.lot_number ?? ""}
                              onChange={(e) =>
                                updateCell(day, 0, article, { lot_number: e.target.value })
                              }
                              className="h-7 w-20 text-xs px-1"
                            />
                          </td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}