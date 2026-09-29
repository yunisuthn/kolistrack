import type { StatutCommande } from "@/generated/prisma/enums";

export const STATUTS_ORDONNES = [
  "COMMANDEE",
  "EXPEDIEE_VERS_TRANSITAIRE",
  "CHEZ_TRANSITAIRE",
  "EN_TRANSIT",
  "ARRIVEE",
  "RECUPEREE",
] as const satisfies readonly StatutCommande[];

export const TOUS_STATUTS = [...STATUTS_ORDONNES, "ANNULEE"] as const satisfies readonly StatutCommande[];

/** Statuts considérés comme « en cours » (ni récupérés, ni annulés) */
export const STATUTS_EN_ATTENTE = STATUTS_ORDONNES.filter((s) => s !== "RECUPEREE");

export const STATUT_LABELS: Record<StatutCommande, string> = {
  COMMANDEE: "Commandée",
  EXPEDIEE_VERS_TRANSITAIRE: "Expédiée vers transitaire",
  CHEZ_TRANSITAIRE: "Chez le transitaire",
  EN_TRANSIT: "En transit",
  ARRIVEE: "Arrivée",
  RECUPEREE: "Récupérée",
  ANNULEE: "Annulée",
};

export const STATUT_COULEURS: Record<StatutCommande, string> = {
  COMMANDEE: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  EXPEDIEE_VERS_TRANSITAIRE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  CHEZ_TRANSITAIRE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  EN_TRANSIT: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ARRIVEE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  RECUPEREE: "bg-green-600 text-white dark:bg-green-700",
  ANNULEE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function statutSuivant(statut: StatutCommande): StatutCommande | null {
  const index = STATUTS_ORDONNES.indexOf(statut as (typeof STATUTS_ORDONNES)[number]);
  if (index === -1 || index === STATUTS_ORDONNES.length - 1) return null;
  return STATUTS_ORDONNES[index + 1];
}
