import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandeForm } from "@/components/commande-form";
import { getCommande, getOptionsFormulaire, versFormValues } from "@/lib/commandes";
import { toInputDate } from "@/lib/format";
import { getTauxActuels } from "@/lib/taux";

export const metadata: Metadata = { title: "Modifier la commande" };

export default async function ModifierCommandePage({ params }: PageProps<"/commandes/[id]/modifier">) {
  const { id } = await params;
  const commande = await getCommande(id);
  if (!commande) notFound();

  const [options, taux] = await Promise.all([
    getOptionsFormulaire(commande.applicationId),
    getTauxActuels(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Modifier la commande</h1>
      <CommandeForm
        options={options}
        tauxActuels={taux ? { CNY: taux.CNY, USD: taux.USD } : null}
        initial={versFormValues(commande)}
        aujourdhui={toInputDate(new Date())}
      />
    </div>
  );
}
