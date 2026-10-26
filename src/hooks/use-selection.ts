"use client";

import { useState } from "react";

/**
 * Sélection multiple parmi `ids` (cases à cocher + « Tout »). Un id qui n'est plus dans la liste
 * (élément supprimé ou déplacé entre-temps) sort de la sélection.
 */
export function useSelection(ids: string[]) {
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const choisis = ids.filter((id) => coches.has(id));
  const tous = ids.length > 0 && choisis.length === ids.length;

  return {
    choisis,
    estChoisi: (id: string) => coches.has(id) && ids.includes(id),
    basculer(id: string, coche: boolean) {
      const suivant = new Set(choisis);
      if (coche) suivant.add(id);
      else suivant.delete(id);
      setCoches(suivant);
    },
    /** Valeur de la case « Tout » */
    etatTout: tous ? true : choisis.length > 0 ? ("indeterminate" as const) : false,
    basculerTout: () => setCoches(new Set(tous ? [] : ids)),
    vider: () => setCoches(new Set()),
  };
}
