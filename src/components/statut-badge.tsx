import type { StatutCommande } from "@/generated/prisma/enums";
import type { DestinationCode, StatutTotal } from "@/lib/calculs";
import { DESTINATION_COULEURS, DESTINATION_LABELS } from "@/lib/destinations";
import { STATUT_COULEURS, STATUT_LABELS } from "@/lib/statuts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function StatutBadge({ statut, className }: { statut: StatutCommande; className?: string }) {
  return <Badge className={cn(STATUT_COULEURS[statut], className)}>{STATUT_LABELS[statut]}</Badge>;
}

const TOTAL: Record<StatutTotal, { label: string; className: string; titre: string }> = {
  DEFINITIF: {
    label: "Définitif",
    className: "bg-green-600 text-white",
    titre: "Frais réels du transitaire saisis",
  },
  ESTIME: {
    label: "Estimé",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    titre: "Basé sur l'estimation des frais du transitaire",
  },
  INCOMPLET: {
    label: "Estimé · frais incomplets",
    className: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
    titre: "Frais du transitaire encore inconnus (en tout ou en partie) : non inclus dans le total",
  },
};

export function StatutTotalBadge({ statut }: { statut: StatutTotal }) {
  const t = TOTAL[statut];
  return (
    <Badge className={t.className} title={t.titre}>
      {t.label}
    </Badge>
  );
}

export function DestinationBadge({ destination }: { destination: DestinationCode }) {
  return <Badge className={DESTINATION_COULEURS[destination]}>{DESTINATION_LABELS[destination]}</Badge>;
}
