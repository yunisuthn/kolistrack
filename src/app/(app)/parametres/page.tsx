import type { Metadata } from "next";
import { getParametres } from "@/lib/commandes";
import { prisma } from "@/lib/prisma";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { ApplicationsManager, type ApplicationDto } from "./applications-manager";
import { ClientsManager, type ClientDto } from "./clients-manager";
import { TauxVenteForm } from "./taux-vente-form";
import { TransitairesManager, type TransitaireDto } from "./transitaires-manager";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const [applications, transitaires, clients, parametres] = await Promise.all([
    prisma.application.findMany({
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      include: { _count: { select: { commandes: true } } },
    }),
    prisma.transitaire.findMany({
      orderBy: { nom: "asc" },
      include: { _count: { select: { commandes: true } } },
    }),
    prisma.client.findMany({
      orderBy: { nom: "asc" },
      include: { _count: { select: { articles: true } } },
    }),
    getParametres(),
  ]);

  const apps: ApplicationDto[] = applications.map((a) => ({
    id: a.id,
    nom: a.nom,
    fraisType: a.fraisType,
    fraisValeur: a.fraisValeur.toString(),
    actif: a.actif,
    nbCommandes: a._count.commandes,
  }));

  const trans: TransitaireDto[] = transitaires.map((t) => ({
    id: t.id,
    nom: t.nom,
    contact: t.contact ?? "",
    tarifParKg: t.tarifParKg?.toString() ?? "",
    tarifParM3: t.tarifParM3?.toString() ?? "",
    devise: t.devise,
    notes: t.notes ?? "",
    nbCommandes: t._count.commandes,
  }));

  const cls: ClientDto[] = clients.map((c) => ({
    id: c.id,
    nom: c.nom,
    telephone: c.telephone ?? "",
    notes: c.notes ?? "",
    nbArticles: c._count.articles,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Paramètres</h1>
      <TauxVenteForm
        tauxVenteCnyMga={parametres.tauxVenteCnyMga}
        gainMinimumMga={parametres.gainMinimumMga}
      />
      <ClientsManager clients={cls} />
      <ApplicationsManager applications={apps} />
      <TransitairesManager transitaires={trans} />
      <form action={logout} className="md:hidden">
        <Button type="submit" variant="outline" className="w-full">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
