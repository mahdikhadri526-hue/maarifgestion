import { supabase } from "@/lib/db";

export type CleaningStatus = "F" | "C" | "NC" | null;

export interface CleaningZone {
  key: string;
  label: string;
  tasks: string[];
}

export const CLEANING_ZONES: CleaningZone[] = [
  {
    key: "comptoir_salle",
    label: "Comptoir Salle",
    tasks: [
      "Nettoyage du Sol du comptoir de la salle",
      "Nettoyage du Petit évier (pince)",
      "Dépoussiérage des étagères et vitre",
      "Nettoyage du Comptoir (support en inox)",
      "Nettoyage de Machine à café",
      "Nettoyage de Poubelle à café",
      "Nettoyage de Boite à cornet",
      "Nettoyage de Boite mise en place des jus et d'eau",
      "Contrôler la propreté des Petits matériels",
      "Nettoyage de l'armoire (+) (stoufs des cakes)",
      "Contrôler la propreté des Torchons microfibres",
    ],
  },
  {
    key: "comptoir_emporter",
    label: "Comptoir Emporter",
    tasks: [
      "Nettoyage du Sol du comptoir",
      "Nettoyage du Petit évier",
      "Dépoussiérage des étagères et vitre",
      "Nettoyage du Comptoir (support en inox)",
      "Nettoyage de Poubelle",
      "Nettoyage de Boite à cornet",
      "Contrôler la propreté des Petits matériels",
      "Nettoyage de l'armoire (+) (topping)",
      "Contrôler la propreté des Torchons microfibres",
    ],
  },
  {
    key: "production",
    label: "Production",
    tasks: [
      "Lavage des Torchons microfibres",
      "Nettoyage des moules de cornet/tulipe",
      "Boites à cornets",
      "Table de travail en inox",
      "Machines à cornets",
      "Gants de production propres",
      "Sol",
      "Murs",
    ],
  },
  {
    key: "economat",
    label: "Économat",
    tasks: [
      "Nettoyage du sol et égouts (1 fois/jour)",
      "Nettoyage des murs, portes et plafonds (1 fois/semaine)",
      "Nettoyage des étagères (1 fois/semaine)",
      "Nettoyage des palettes (1 fois/semaine)",
      "Nettoyage des chemins de câble (1 fois/semaine)",
      "Organisation des produits (1 fois/jour)",
    ],
  },
  {
    key: "caissiere_salle",
    label: "Caissière Salle",
    tasks: ["Dépoussiérage de la caisse et des tableaux"],
  },
  {
    key: "caissiere_emporter",
    label: "Caissière Emporter",
    tasks: ["Dépoussiérage des tableaux", "Dépoussiérage de la caisse"],
  },
  {
    key: "la_passe",
    label: "La Passe",
    tasks: [
      "Sol de la passe, cuisine et chambre positive",
      "Porte de la cuisine et comptoir de la salle",
      "Chambre froide (+) et (-) : porte, joints, poignées",
      "Les deux plonges, lave-mains",
      "Murs",
      "Poubelles",
      "Refroidisseur crème fraîche",
      "Petits matériels",
      "Siphons",
      "Marmite",
      "Table de travail en inox (passe et cuisine)",
      "Lavage des Torchons microfibres",
    ],
  },
  {
    key: "serveurs",
    label: "Serveurs",
    tasks: [
      "Dépoussiérage des Chaises et Tables",
      "Dépoussiérage du Bois",
      "Dépoussiérage de Garde à chaud Viennoiserie et présentoir macarons",
      "Dépoussiérage du marbre du comptoir",
      "Dépoussiérage de l'emplacement de matériels de la salle",
    ],
  },
  {
    key: "toilettes_client_salle",
    label: "Toilettes client (Salle)",
    tasks: [
      "Nettoyage de Sol, murs, portes et égouts",
      "Nettoyage des toilettes",
      "Nettoyage des lave-mains",
      "Nettoyage des poubelles",
      "Papier, savon et désodorisant disponibles",
    ],
  },
];

export interface CleaningLog {
  id: string;
  zone: string;
  logDate: string;
  collaborateur: string;
  tasks: Record<string, CleaningStatus>;
  visaManager: string | null;
  notes: string | null;
  createdAt: string;
}

// Traductions arabes des tâches (clé = libellé français)
export const CLEANING_TASK_AR: Record<string, string> = {
  "Nettoyage du Sol du comptoir de la salle": "تنظيف أرضية كاونتر القاعة",
  "Nettoyage du Petit évier (pince)": "تنظيف المغسلة الصغيرة (الملقط)",
  "Dépoussiérage des étagères et vitre": "إزالة الغبار عن الرفوف والزجاج",
  "Nettoyage du Comptoir (support en inox)": "تنظيف الكاونتر (السطح الستانلس)",
  "Nettoyage de Machine à café": "تنظيف آلة القهوة",
  "Nettoyage de Poubelle à café": "تنظيف سلة نفايات القهوة",
  "Nettoyage de Boite à cornet": "تنظيف علبة الكورنيه",
  "Nettoyage de Boite mise en place des jus et d'eau": "تنظيف علبة تجهيز العصائر والماء",
  "Contrôler la propreté des Petits matériels": "مراقبة نظافة الأدوات الصغيرة",
  "Nettoyage de l'armoire (+) (stoufs des cakes)": "تنظيف الخزانة الموجبة (رفوف الكيك)",
  "Contrôler la propreté des Torchons microfibres": "مراقبة نظافة مناشف الميكروفايبر",
  "Nettoyage du Sol du comptoir": "تنظيف أرضية الكاونتر",
  "Nettoyage du Petit évier": "تنظيف المغسلة الصغيرة",
  "Nettoyage de Poubelle": "تنظيف سلة النفايات",
  "Nettoyage de l'armoire (+) (topping)": "تنظيف الخزانة الموجبة (التوبينغ)",
  "Lavage des Torchons microfibres": "غسل مناشف الميكروفايبر",
  "Nettoyage des moules de cornet/tulipe": "تنظيف قوالب الكورنيه/التوليب",
  "Boites à cornets": "علب الكورنيه",
  "Table de travail en inox": "طاولة العمل الستانلس",
  "Machines à cornets": "آلات الكورنيه",
  "Gants de production propres": "قفازات إنتاج نظيفة",
  "Sol": "الأرضية",
  "Murs": "الجدران",
  "Nettoyage du sol et égouts (1 fois/jour)": "تنظيف الأرضية والمصارف (مرة في اليوم)",
  "Nettoyage des murs, portes et plafonds (1 fois/semaine)": "تنظيف الجدران والأبواب والأسقف (مرة في الأسبوع)",
  "Nettoyage des étagères (1 fois/semaine)": "تنظيف الرفوف (مرة في الأسبوع)",
  "Nettoyage des palettes (1 fois/semaine)": "تنظيف المنصات (مرة في الأسبوع)",
  "Nettoyage des chemins de câble (1 fois/semaine)": "تنظيف مسارات الكابلات (مرة في الأسبوع)",
  "Organisation des produits (1 fois/jour)": "ترتيب المنتجات (مرة في اليوم)",
  "Dépoussiérage de la caisse et des tableaux": "إزالة الغبار عن الصندوق واللوحات",
  "Dépoussiérage des tableaux": "إزالة الغبار عن اللوحات",
  "Dépoussiérage de la caisse": "إزالة الغبار عن الصندوق",
  "Sol de la passe, cuisine et chambre positive": "أرضية البّاس والمطبخ والغرفة الموجبة",
  "Porte de la cuisine et comptoir de la salle": "باب المطبخ وكاونتر القاعة",
  "Chambre froide (+) et (-) : porte, joints, poignées": "الغرفة الباردة (+) و(−): الباب، الحشوات، المقابض",
  "Les deux plonges, lave-mains": "المغسلتان ومغسلة اليدين",
  "Poubelles": "سلال النفايات",
  "Refroidisseur crème fraîche": "مبرّد الكريمة الطازجة",
  "Petits matériels": "الأدوات الصغيرة",
  "Siphons": "السيفونات",
  "Marmite": "الطنجرة",
  "Table de travail en inox (passe et cuisine)": "طاولة العمل الستانلس (البّاس والمطبخ)",
  "Dépoussiérage des Chaises et Tables": "إزالة الغبار عن الكراسي والطاولات",
  "Dépoussiérage du Bois": "إزالة الغبار عن الخشب",
  "Dépoussiérage de Garde à chaud Viennoiserie et présentoir macarons": "إزالة الغبار عن سخان المخبوزات وعارض الماكرون",
  "Dépoussiérage du marbre du comptoir": "إزالة الغبار عن رخام الكاونتر",
  "Dépoussiérage de l'emplacement de matériels de la salle": "إزالة الغبار عن مكان أدوات القاعة",
  "Nettoyage de Sol, murs, portes et égouts": "تنظيف الأرضية، الجدران، الأبواب والمجاري",
  "Nettoyage des toilettes": "تنظيف المرحاض",
  "Nettoyage des lave-mains": "تنظيف المغاسل",
  "Nettoyage des poubelles": "تنظيف سلة المهملات",
  "Papier, savon et désodorisant disponibles": "يتوفر ورق التواليت والصابون ومعطر الجو",
};

export function arOf(task: string): string {
  return CLEANING_TASK_AR[task] ?? "";
}

const db = () => (supabase as any).from("cleaning_logs");

function mapRow(r: any): CleaningLog {
  return {
    id: r.id,
    zone: r.zone,
    logDate: r.log_date,
    collaborateur: r.collaborateur,
    tasks: (r.tasks ?? {}) as Record<string, CleaningStatus>,
    visaManager: r.visa_manager,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export async function getCleaningLogs(zone?: string): Promise<CleaningLog[]> {
  let q = db().select("*").order("log_date", { ascending: false }).order("created_at", { ascending: false });
  if (zone) q = q.eq("zone", zone);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addCleaningLog(entry: Omit<CleaningLog, "id" | "createdAt">) {
  const { error } = await db().insert({
    zone: entry.zone,
    log_date: entry.logDate,
    collaborateur: entry.collaborateur,
    tasks: entry.tasks,
    visa_manager: entry.visaManager,
    notes: entry.notes,
  });
  if (error) throw error;
}

export async function deleteCleaningLog(id: string) {
  const { error } = await db().delete().eq("id", id);
  if (error) throw error;
}

export async function updateCleaningLog(id: string, patch: Partial<Pick<CleaningLog, "tasks" | "visaManager" | "notes">>) {
  const payload: any = {};
  if (patch.tasks !== undefined) payload.tasks = patch.tasks;
  if (patch.visaManager !== undefined) payload.visa_manager = patch.visaManager;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  const { error } = await db().update(payload).eq("id", id);
  if (error) throw error;
}