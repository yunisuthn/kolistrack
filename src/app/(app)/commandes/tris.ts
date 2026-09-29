export const TRIS = {
  date_desc: "Plus récentes",
  date_asc: "Plus anciennes",
  total_desc: "Total décroissant",
  total_asc: "Total croissant",
  statut: "Statut",
} as const;
export type Tri = keyof typeof TRIS;
