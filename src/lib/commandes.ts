import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Devise, StatutCommande } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { toInputDate } from "./format";

export const commandeAvecRelations = {
  application: true,
  transitaire: true,
  articles: { orderBy: { id: "asc" } },
  historique: { orderBy: [{ date: "desc" }, { id: "desc" }] },
} satisfies Prisma.CommandeInclude;

export type CommandeComplete = Prisma.CommandeGetPayload<{ include: typeof commandeAvecRelations }>;

export function getCommande(id: string) {
  return prisma.commande.findUnique({ where: { id }, include: commandeAvecRelations });
}

/** Valeurs sérialisables (chaînes) pour pré-remplir le formulaire côté client. */
export type CommandeFormValues = {
  id?: string;
  applicationId: string;
  transitaireId: string;
  dateCommande: string;
  montantArticlesCny: string;
  fraisAppCny: string;
  fraisLivraisonCny: string;
  tauxCnyMga: string;
  poidsKg: string;
  volumeM3: string;
  fraisTransitaireEstime: string;
  fraisTransitaireReel: string;
  deviseTransitaire: Devise;
  tauxDeviseTransitaireMga: string;
  dateRecuperation: string;
  notes: string;
  articles: {
    cle: string;
    nom: string;
    lienProduit: string;
    quantite: string;
    prixUnitaireCny: string;
    image: string;
    codeSuivi: string;
    statut: StatutCommande;
  }[];
};

const s = (v: { toString(): string } | null | undefined) => (v == null ? "" : v.toString());

export function versFormValues(c: CommandeComplete): CommandeFormValues {
  return {
    id: c.id,
    applicationId: c.applicationId,
    transitaireId: c.transitaireId ?? "",
    dateCommande: toInputDate(c.dateCommande),
    montantArticlesCny: s(c.montantArticlesCny),
    fraisAppCny: s(c.fraisAppCny),
    fraisLivraisonCny: s(c.fraisLivraisonCny),
    tauxCnyMga: s(c.tauxCnyMga),
    poidsKg: s(c.poidsKg),
    volumeM3: s(c.volumeM3),
    fraisTransitaireEstime: s(c.fraisTransitaireEstime),
    fraisTransitaireReel: s(c.fraisTransitaireReel),
    deviseTransitaire: c.deviseTransitaire,
    tauxDeviseTransitaireMga: s(c.tauxDeviseTransitaireMga),
    dateRecuperation: toInputDate(c.dateRecuperation),
    notes: c.notes ?? "",
    articles: c.articles.map((a) => ({
      cle: a.id,
      nom: a.nom,
      lienProduit: a.lienProduit ?? "",
      quantite: String(a.quantite),
      prixUnitaireCny: s(a.prixUnitaireCny),
      image: a.image ?? "",
      codeSuivi: a.codeSuivi ?? "",
      statut: a.statut,
    })),
  };
}

export async function getOptionsFormulaire(applicationIdCourant?: string) {
  const [applications, transitaires] = await Promise.all([
    prisma.application.findMany({
      where: applicationIdCourant
        ? { OR: [{ actif: true }, { id: applicationIdCourant }] }
        : { actif: true },
      orderBy: { nom: "asc" },
    }),
    prisma.transitaire.findMany({ orderBy: { nom: "asc" } }),
  ]);
  return {
    applications: applications.map((a) => ({
      id: a.id,
      nom: a.nom,
      fraisType: a.fraisType,
      fraisValeur: a.fraisValeur.toString(),
    })),
    transitaires: transitaires.map((t) => ({
      id: t.id,
      nom: t.nom,
      devise: t.devise,
      tarifParKg: s(t.tarifParKg),
      tarifParM3: s(t.tarifParM3),
    })),
  };
}

export type OptionsFormulaire = Awaited<ReturnType<typeof getOptionsFormulaire>>;
