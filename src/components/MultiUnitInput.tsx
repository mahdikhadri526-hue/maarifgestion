import { Input } from "@/components/ui/input";
import { ProductUnitConfig } from "@/lib/stockData";

export interface MultiUnitValues {
  cartons: string;
  paquets: string;
  pieces: string;
}

export const EMPTY_MULTI: MultiUnitValues = { cartons: "", paquets: "", pieces: "" };

export function totalPieces(values: MultiUnitValues, config: ProductUnitConfig): number {
  const c = config.cartonEnabled ? Number(values.cartons || 0) * config.piecesPerCarton : 0;
  const p = config.paquetEnabled ? Number(values.paquets || 0) * config.piecesPerPaquet : 0;
  const u = Number(values.pieces || 0);
  return c + p + u;
}

export function dominantUnit(values: MultiUnitValues, config: ProductUnitConfig): "CARTON" | "PAQUET" | "PIECE" {
  if (config.cartonEnabled && Number(values.cartons || 0) > 0) return "CARTON";
  if (config.paquetEnabled && Number(values.paquets || 0) > 0) return "PAQUET";
  return "PIECE";
}

interface Props {
  config: ProductUnitConfig;
  values: MultiUnitValues;
  onChange: (v: MultiUnitValues) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function MultiUnitInput({ config, values, onChange, size = "md", disabled }: Props) {
  const sizeCls = size === "sm" ? "h-8 text-xs" : "";
  const total = totalPieces(values, config);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2 items-end">
        {config.cartonEnabled && (
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Cartons</label>
            <Input
              type="number" min="0" placeholder="0"
              value={values.cartons}
              disabled={disabled}
              onChange={(e) => onChange({ ...values, cartons: e.target.value })}
              className={`font-mono text-right w-20 ${sizeCls}`}
            />
          </div>
        )}
        {config.paquetEnabled && (
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Paquets</label>
            <Input
              type="number" min="0" placeholder="0"
              value={values.paquets}
              disabled={disabled}
              onChange={(e) => onChange({ ...values, paquets: e.target.value })}
              className={`font-mono text-right w-20 ${sizeCls}`}
            />
          </div>
        )}
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Pièces</label>
          <Input
            type="number" min="0" placeholder="0"
            value={values.pieces}
            disabled={disabled}
            onChange={(e) => onChange({ ...values, pieces: e.target.value })}
            className={`font-mono text-right w-20 ${sizeCls}`}
          />
        </div>
      </div>
      {total > 0 && (config.cartonEnabled || config.paquetEnabled) && (
        <p className="text-xs text-primary font-medium">= {total} pièces</p>
      )}
    </div>
  );
}