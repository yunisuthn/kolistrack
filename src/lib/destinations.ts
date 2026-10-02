import type { DestinationCode } from "./calculs";

export const TOUTES_DESTINATIONS: DestinationCode[] = ["CLIENT", "STOCK", "PERSONNEL"];

export const DESTINATION_LABELS: Record<DestinationCode, string> = {
  CLIENT: "Pour un client",
  STOCK: "À vendre",
  PERSONNEL: "Pour moi",
};

export const DESTINATION_COULEURS: Record<DestinationCode, string> = {
  CLIENT: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  STOCK: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  PERSONNEL: "bg-muted text-muted-foreground",
};
