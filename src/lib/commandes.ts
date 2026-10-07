import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DestinationArticle, Devise, ModeFraisTransitaire, StatutCommande } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { toInputDate } from "./format";

export const commandeAvecRelations = {
  application: true,
  transitaire: true,
  colis: { orderBy: { codeSuivi: "asc" } },
  articles: { orderBy: { id: "asc" }, include: { client: true } },
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
  modeFraisTransitaire: ModeFraisTransitaire;
  /** Frais par code de suivi (mode COLIS) ; un code sans entrée n'a pas encore de frais */
  colis: { codeSuivi: string; poidsKg: string; fraisEstime: string; fraisReel: string }[];
  dateRecuperation: string;
  notes: string;
  articles: {
    cle: string;
    /** Id de l'article enregistré ; absent pour un nouvel article */
    id?: string;
    nom: string;
    quantite: string;
    prixUnitaireCny: string;
    codeSuivi: string;
    statut: StatutCommande;
    destination: DestinationArticle;
    clientId: string;
    tauxVenteCnyMga: string;
    gainMinimumMga: string;
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
    modeFraisTransitaire: c.modeFraisTransitaire,
    colis: c.colis.map((x) => ({
      codeSuivi: x.codeSuivi,
      poidsKg: s(x.poidsKg),
      fraisEstime: s(x.fraisEstime),
      fraisReel: s(x.fraisReel),
    })),
    dateRecuperation: toInputDate(c.dateRecuperation),
    notes: c.notes ?? "",
    articles: c.articles.map((a) => ({
      cle: a.id,
      id: a.id,
      nom: a.nom,
      quantite: String(a.quantite),
      prixUnitaireCny: s(a.prixUnitaireCny),
      codeSuivi: a.codeSuivi ?? "",
      statut: a.statut,
      destination: a.destination,
      clientId: a.clientId ?? "",
      tauxVenteCnyMga: s(a.tauxVenteCnyMga),
      gainMinimumMga: s(a.gainMinimumMga),
    })),
  };
}

export async function getOptionsFormulaire(applicationIdCourant?: string) {
  const [applications, transitaires, clients, parametres] = await Promise.all([
    prisma.application.findMany({
      where: applicationIdCourant
        ? { OR: [{ actif: true }, { id: applicationIdCourant }] }
        : { actif: true },
      orderBy: { nom: "asc" },
    }),
    prisma.transitaire.findMany({ orderBy: { nom: "asc" } }),
    prisma.client.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    getParametres(),
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
      modeFrais: t.modeFrais,
      tarifParKg: s(t.tarifParKg),
      tarifParM3: s(t.tarifParM3),
    })),
    clients,
    tauxVenteDefaut: parametres.tauxVenteCnyMga,
    gainMinimumDefaut: parametres.gainMinimumMga,
  };
}

/** Réglages globaux (ligne unique id = 1, créée par la migration ; à défaut, valeurs par défaut du schéma). */
export async function getParametres() {
  const p = await prisma.parametres.findUnique({ where: { id: 1 } });
  return {
    tauxVenteCnyMga: p?.tauxVenteCnyMga.toString() ?? "900",
    gainMinimumMga: p?.gainMinimumMga.toString() ?? "5000",
  };
}

export type OptionsFormulaire = Awaited<ReturnType<typeof getOptionsFormulaire>>;
