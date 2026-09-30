"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { StatutCommande } from "@/generated/prisma/enums";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUT_COULEURS, STATUT_LABELS, TOUS_STATUTS } from "@/lib/statuts";
import { cn } from "@/lib/utils";
import { changerStatutArticle } from "../actions";

export function StatutArticle({ articleId, statut }: { articleId: string; statut: StatutCommande }) {
  const [pending, startTransition] = useTransition();

  function changer(nouveau: StatutCommande) {
    if (nouveau === statut) return;
    startTransition(async () => {
      const res = await changerStatutArticle({ articleId, statut: nouveau });
      if (res.ok) toast.success(`Article : ${STATUT_LABELS[nouveau]}`);
      else toast.error(res.erreur ?? "Le statut n'a pas pu être modifié.");
    });
  }

  return (
    <Select value={statut} onValueChange={(v) => changer(v as StatutCommande)} disabled={pending}>
      <SelectTrigger
        size="sm"
        aria-label="Statut de l'article"
        className={cn("gap-1 border-transparent px-2 text-xs font-medium", STATUT_COULEURS[statut])}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TOUS_STATUTS.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUT_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
