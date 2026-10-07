"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { StatutCommande } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { estErreurCleEtrangere, exigerSession, type ResultatAction } from "@/lib/auth";
import { montantArticlesCny, reglagesVenteArticle } from "@/lib/calculs";
import { getParametres } from "@/lib/commandes";
import { STATUT_LABELS, statutDepuisArticles, statutsAnterieurs } from "@/lib/statuts";
import {
  changementStatutArticleSchema,
  changementStatutSchema,
  commandeSchema,
  dateDepuisInput,
  erreursDepuisZod,
  recuperationColisSchema,
  recuperationSchema,
  type CommandeInput,
} from "@/lib/validations";

const NOTE_STATUT_ARTICLES = "D'après le statut des articles";

/**
 * Applique un statut aux articles de la commande : les articles à la traîne (au statut actuel de la
 * commande ou moins avancés que le nouveau) le prennent, les articles déjà plus avancés ne reculent pas.
 */
async function appliquerStatutAuxArticles(
  tx: Prisma.TransactionClient,
  commandeId: string,
  statut: StatutCommande,
) {
  const avant = await tx.commande.findUniqueOrThrow({ where: { id: commandeId }, select: { statut: true } });
  await tx.article.updateMany({
    where: {
      commandeId,
      ...(statut === "ANNULEE" ? {} : { statut: { in: [avant.statut, ...statutsAnterieurs(statut)] } }),
    },
    data: { statut },
  });
}

/**
 * Recalcule le statut de la commande d'après ses articles (sans articles : `statutSansArticles`,
 * sinon inchangé) et trace le changement dans l'historique.
 * `date` : date saisie par l'utilisateur ; elle devient aussi la date de récupération. Sans date
 * (changement automatique), la date de récupération n'est posée que si elle manque.
 */
async function synchroniserStatutCommande(
  tx: Prisma.TransactionClient,
  commandeId: string,
  {
    statutSansArticles,
    date,
    note = NOTE_STATUT_ARTICLES,
    toujoursHistoriser = false,
  }: { statutSansArticles?: StatutCommande; date?: Date; note?: string | null; toujoursHistoriser?: boolean } = {},
) {
  const commande = await tx.commande.findUniqueOrThrow({
    where: { id: commandeId },
    select: { statut: true, dateRecuperation: true, articles: { select: { statut: true } } },
  });
  const statut =
    statutDepuisArticles(commande.articles.map((a) => a.statut)) ?? statutSansArticles ?? commande.statut;
  if (statut === commande.statut && !toujoursHistoriser) return;
  await tx.commande.update({
    where: { id: commandeId },
    data: {
      statut,
      ...(statut === "RECUPEREE" && (date || !commande.dateRecuperation)
        ? { dateRecuperation: date ?? new Date() }
        : {}),
    },
  });
  await tx.historiqueStatut.create({ data: { commandeId, statut, date: date ?? new Date(), note } });
}

const ERREUR_REFERENCE_SUPPRIMEE =
  "Une application, un transitaire ou un client choisi a été supprimé entre-temps. Rechargez la page.";

export async function enregistrerCommande(
  id: string | null,
  input: CommandeInput,
): Promise<ResultatAction<{ id: string }>> {
  await exigerSession();
  const parsed = commandeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { articles, colis, statut, dateCommande, dateRecuperation, ...champs } = parsed.data;

  // Un client supprimé depuis l'ouverture du formulaire : erreur sur le champ plutôt qu'une erreur serveur
  const clientIds = [...new Set(articles.flatMap((a) => (a.destination === "CLIENT" && a.clientId ? [a.clientId] : [])))];
  if (clientIds.length > 0) {
    const existants = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true } });
    const ids = new Set(existants.map((c) => c.id));
    const erreurs: Record<string, string> = {};
    articles.forEach((a, i) => {
      if (a.destination === "CLIENT" && a.clientId && !ids.has(a.clientId)) {
        erreurs[`articles.${i}.clientId`] = "Ce client a été supprimé, choisissez-en un autre";
      }
    });
    if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  }

  // Le montant des articles fait foi dès qu'il y a des articles détaillés
  const montant =
    articles.length > 0 ? montantArticlesCny(articles).toFixed(2) : champs.montantArticlesCny;

  const parametres = await getParametres();
  const defautsVente = { tauxVenteDefaut: parametres.tauxVenteCnyMga, gainMinimumDefaut: parametres.gainMinimumMga };

  const data = {
    ...champs,
    montantArticlesCny: montant,
    dateCommande: dateDepuisInput(dateCommande),
    dateRecuperation: dateRecuperation ? dateDepuisInput(dateRecuperation) : null,
    notes: champs.notes ?? null,
  };
  // Champs saisis dans le formulaire ; lien produit et image n'y figurent pas et ne sont jamais écrasés
  const champsArticle = (a: (typeof articles)[number]) => ({
    nom: a.nom,
    quantite: a.quantite,
    prixUnitaireCny: a.prixUnitaireCny,
    codeSuivi: a.codeSuivi ?? null,
    destination: a.destination,
    clientId: a.destination === "CLIENT" ? a.clientId ?? null : null,
    // Taux de vente et gain minimum figés sur l'article
    ...reglagesVenteArticle(a, defautsVente),
  });

  // Un colis par code de suivi des articles : les frais d'un code qui n'est plus utilisé sont supprimés
  const codes = new Set(articles.flatMap((a) => (a.codeSuivi ? [a.codeSuivi] : [])));
  const colisData = [...new Map(colis.filter((x) => codes.has(x.codeSuivi)).map((x) => [x.codeSuivi, x])).values()];

  let commandeId: string;
  try {
    if (id) {
      await prisma.$transaction(async (tx) => {
        await tx.commande.update({ where: { id }, data });
        // Les articles existants sont mis à jour sur place, les retirés supprimés, les nouveaux créés
        const enBase = await tx.article.findMany({ where: { commandeId: id }, select: { id: true } });
        const idsEnBase = new Set(enBase.map((a) => a.id));
        const gardes = articles.filter((a) => a.id && idsEnBase.has(a.id));
        const nouveaux = articles.filter((a) => !gardes.includes(a));
        await tx.article.deleteMany({ where: { commandeId: id, id: { notIn: gardes.map((a) => a.id!) } } });
        for (const a of gardes) {
          // Statut transmis seulement s'il a été changé dans le formulaire : un changement fait
          // entre-temps (autre onglet, « Marquer comme récupérée »…) n'est pas écrasé
          await tx.article.update({
            where: { id: a.id },
            data: { ...champsArticle(a), ...(a.statut ? { statut: a.statut } : {}) },
          });
        }
        if (nouveaux.length > 0) {
          await tx.article.createMany({
            data: nouveaux.map((a) => ({ ...champsArticle(a), statut: a.statut ?? "COMMANDEE", commandeId: id })),
          });
        }
        await tx.colis.deleteMany({
          where: { commandeId: id, codeSuivi: { notIn: colisData.map((x) => x.codeSuivi) } },
        });
        for (const x of colisData) {
          await tx.colis.upsert({
            where: { commandeId_codeSuivi: { commandeId: id, codeSuivi: x.codeSuivi } },
            create: { ...x, commandeId: id },
            update: x,
          });
        }
        // Le statut de la commande suit celui de ses articles
        await synchroniserStatutCommande(tx, id);
      });
      commandeId = id;
    } else {
      const articlesData = articles.map((a) => ({ ...champsArticle(a), statut: a.statut ?? ("COMMANDEE" as const) }));
      // Le statut de la commande suit celui de ses articles ; sans articles, celui choisi
      const statutInitial = statutDepuisArticles(articlesData.map((a) => a.statut)) ?? statut ?? "COMMANDEE";
      const creee = await prisma.commande.create({
        data: {
          ...data,
          statut: statutInitial,
          articles: { create: articlesData },
          colis: { create: colisData },
          historique: {
            create: {
              statut: statutInitial,
              date: data.dateCommande,
              note: "Commande créée",
            },
          },
        },
      });
      commandeId = creee.id;
    }
  } catch (e) {
    if (estErreurCleEtrangere(e)) return { ok: false, erreur: ERREUR_REFERENCE_SUPPRIMEE };
    throw e;
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: commandeId } };
}

export async function supprimerCommande(id: string) {
  await exigerSession();
  await prisma.commande.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/commandes");
}

export async function changerStatut(
  input: z.input<typeof changementStatutSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = changementStatutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { commandeId, statut, date, note } = parsed.data;
  const dateStatut = dateDepuisInput(date);

  await prisma.$transaction(async (tx) => {
    await appliquerStatutAuxArticles(tx, commandeId, statut);
    await synchroniserStatutCommande(tx, commandeId, {
      statutSansArticles: statut,
      date: dateStatut,
      note: note ?? null,
      toujoursHistoriser: true,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marquerRecuperee(
  input: z.input<typeof recuperationSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = recuperationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const d = parsed.data;
  if (d.deviseTransitaire === "USD" && !d.tauxDeviseTransitaireMga) {
    return { ok: false, erreurs: { tauxDeviseTransitaireMga: "Indiquez le taux USD → MGA appliqué" } };
  }
  const { modeFraisTransitaire } = await prisma.commande.findUniqueOrThrow({
    where: { id: d.commandeId },
    select: { modeFraisTransitaire: true },
  });
  const parColis = modeFraisTransitaire === "COLIS";
  if (!parColis && !d.fraisTransitaireReel) {
    return { ok: false, erreurs: { fraisTransitaireReel: "Indiquez les frais réels" } };
  }
  const date = dateDepuisInput(d.dateRecuperation);

  await prisma.$transaction(async (tx) => {
    await tx.commande.update({
      where: { id: d.commandeId },
      data: {
        deviseTransitaire: d.deviseTransitaire,
        tauxDeviseTransitaireMga: d.tauxDeviseTransitaireMga ?? null,
        ...(parColis
          ? {}
          : { fraisTransitaireReel: d.fraisTransitaireReel, ...(d.poidsKg ? { poidsKg: d.poidsKg } : {}) }),
      },
    });
    if (parColis) {
      for (const x of d.colis) {
        await tx.colis.updateMany({ where: { id: x.id, commandeId: d.commandeId }, data: { fraisReel: x.fraisReel } });
      }
    }
    await appliquerStatutAuxArticles(tx, d.commandeId, "RECUPEREE");
    await synchroniserStatutCommande(tx, d.commandeId, {
      statutSansArticles: "RECUPEREE",
      date,
      note: d.note ?? `${STATUT_LABELS.RECUPEREE} — frais réels saisis`,
      toujoursHistoriser: true,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Un colis arrivé (mode COLIS) : ses frais réels sont saisis et ses articles passent « Récupérée » ;
 * le statut de la commande est recalculé.
 */
export async function marquerColisRecupere(
  input: z.input<typeof recuperationColisSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = recuperationColisSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const d = parsed.data;
  const colis = await prisma.colis.findUnique({
    where: { id: d.colisId },
    select: { commandeId: true, codeSuivi: true, commande: { select: { deviseTransitaire: true } } },
  });
  if (!colis) return { ok: false, erreur: "Ce colis n'existe plus. Rechargez la page." };
  if (colis.commande.deviseTransitaire === "USD" && !d.tauxDeviseTransitaireMga) {
    return { ok: false, erreurs: { tauxDeviseTransitaireMga: "Indiquez le taux USD → MGA appliqué" } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.colis.update({
      where: { id: d.colisId },
      data: { fraisReel: d.fraisReel, ...(d.poidsKg ? { poidsKg: d.poidsKg } : {}) },
    });
    if (colis.commande.deviseTransitaire !== "MGA" && d.tauxDeviseTransitaireMga) {
      await tx.commande.update({
        where: { id: colis.commandeId },
        data: { tauxDeviseTransitaireMga: d.tauxDeviseTransitaireMga },
      });
    }
    await tx.article.updateMany({
      where: { commandeId: colis.commandeId, codeSuivi: colis.codeSuivi, statut: { notIn: ["RECUPEREE", "ANNULEE"] } },
      data: { statut: "RECUPEREE" },
    });
    await synchroniserStatutCommande(tx, colis.commandeId, {
      date: dateDepuisInput(d.dateRecuperation),
      note: `Colis ${colis.codeSuivi} récupéré — frais réels saisis`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Statut d'un seul article (colis partiels) ; le statut de la commande est recalculé. */
export async function changerStatutArticle(
  input: z.input<typeof changementStatutArticleSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = changementStatutArticleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { articleId, statut } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const { commandeId } = await tx.article.update({
      where: { id: articleId },
      data: { statut },
      select: { commandeId: true },
    });
    await synchroniserStatutCommande(tx, commandeId);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
