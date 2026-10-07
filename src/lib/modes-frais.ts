import type { ModeFraisCode } from "./calculs";

export const TOUS_MODES_FRAIS: ModeFraisCode[] = ["COLIS", "COMMANDE"];

export const MODE_FRAIS_LABELS: Record<ModeFraisCode, string> = {
  COLIS: "Par colis (code de suivi)",
  COMMANDE: "Un montant pour la commande",
};
