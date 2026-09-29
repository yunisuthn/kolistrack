import type { Metadata } from "next";
import Link from "next/link";
import { CommandeForm } from "@/components/commande-form";
import { Button } from "@/components/ui/button";
import { getOptionsFormulaire } from "@/lib/commandes";
import { toInputDate } from "@/lib/format";
import { getTauxActuels } from "@/lib/taux";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default async function NouvelleCommandePage() {
  const [options, taux] = await Promise.all([getOptionsFormulaire(), getTauxActuels()]);

  if (options.applications.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Nouvelle commande</h1>
        <p className="text-muted-foreground">Ajoutez d&apos;abord une application d&apos;achat dans les paramètres.</p>
        <Button asChild>
          <Link href="/parametres">Aller aux paramètres</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nouvelle commande</h1>
      <CommandeForm
        options={options}
        tauxActuels={taux ? { CNY: taux.CNY, USD: taux.USD } : null}
        aujourdhui={toInputDate(new Date())}
      />
    </div>
  );
}
