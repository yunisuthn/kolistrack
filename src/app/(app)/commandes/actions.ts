"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { StatutCommande } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { exigerSession, type ResultatAction } from "@/lib/auth";
import { montantArticlesCny } from "@/lib/calculs";
import { STATUT_LABELS, statutDepuisArticles, statutsAnterieurs } from "@/lib/statuts";
import {
  changementStatutArticleSchema,
  changementStatutSchema,
  commandeSchema,
  dateDepuisInput,
  erreursDepuisZod,
  recuperationSchema,
  type CommandeInput,
} from "@/lib/validations";

const NOTE_STATUT_ARTICLES = "D'après le statut des articles";

/**
 * Applique un statut à la commande : les articles à la traîne (au statut actuel de la commande
 * ou moins avancés que le nouveau) le prennent, les articles déjà plus avancés ne reculent pas.
 * Retourne le statut de la commande qui en résulte.
 */
async function appliquerStatutAuxArticles(
  tx: Prisma.TransactionClient,
  commandeId: string,
  statut: StatutCommande,
): Promise<StatutCommande> {
  const avant = await tx.commande.findUniqueOrThrow({ where: { id: commandeId }, select: { statut: true } });
  await tx.article.updateMany({
    where: {
      commandeId,
      ...(statut === "ANNULEE" ? {} : { statut: { in: [avant.statut, ...statutsAnterieurs(statut)] } }),
    },
    data: { statut },
  });
  const articles = await tx.article.findMany({ where: { commandeId }, select: { statut: true } });
  return statutDepuisArticles(articles.map((a) => a.statut)) ?? statut;
}

export async function enregistrerCommande(
  id: string | null,
  input: CommandeInput,
): Promise<ResultatAction<{ id: string }>> {
  await exigerSession();
  const parsed = commandeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { articles, dateCommande, dateRecuperation, ...champs } = parsed.data;

  // Le montant des articles fait foi dès qu'il y a des articles détaillés
  const montant =
    articles.length > 0 ? montantArticlesCny(articles).toFixed(2) : champs.montantArticlesCny;

  const data = {
    ...champs,
    montantArticlesCny: montant,
    dateCommande: dateDepuisInput(dateCommande),
    dateRecuperation: dateRecuperation ? dateDepuisInput(dateRecuperation) : null,
    notes: champs.notes ?? null,
  };
  const articlesData = articles.map((a) => ({
    nom: a.nom,
    lienProduit: a.lienProduit ?? null,
    quantite: a.quantite,
    prixUnitaireCny: a.prixUnitaireCny,
    image: a.image ?? null,
    codeSuivi: a.codeSuivi ?? null,
    statut: a.statut ?? ("COMMANDEE" as const),
  }));
  // Le statut de la commande suit celui de ses articles
  const statutArticles = statutDepuisArticles(articlesData.map((a) => a.statut));

  let commandeId: string;
  if (id) {
    await prisma.$transaction(async (tx) => {
      const avant = await tx.commande.findUniqueOrThrow({ where: { id }, select: { statut: true } });
      const statut = statutArticles ?? avant.statut;
      const change = statut !== avant.statut;
      await tx.commande.update({
        where: { id },
        data: {
          ...data,
          statut,
          ...(change && statut === "RECUPEREE" && !data.dateRecuperation ? { dateRecuperation: new Date() } : {}),
        },
      });
      await tx.article.deleteMany({ where: { commandeId: id } });
      await tx.article.createMany({ data: articlesData.map((a) => ({ ...a, commandeId: id })) });
      if (change) {
        await tx.historiqueStatut.create({ data: { commandeId: id, statut, note: NOTE_STATUT_ARTICLES } });
      }
    });
    commandeId = id;
  } else {
    const statutInitial = statutArticles ?? "COMMANDEE";
    const creee = await prisma.commande.create({
      data: {
        ...data,
        statut: statutInitial,
        articles: { create: articlesData },
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
    const statutFinal = await appliquerStatutAuxArticles(tx, commandeId, statut);
    await tx.commande.update({
      where: { id: commandeId },
      data: {
        statut: statutFinal,
        ...(statutFinal === "RECUPEREE" ? { dateRecuperation: dateStatut } : {}),
      },
    });
    await tx.historiqueStatut.create({
      data: { commandeId, statut: statutFinal, date: dateStatut, note: note ?? null },
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
  const date = dateDepuisInput(d.dateRecuperation);

  await prisma.$transaction(async (tx) => {
    await appliquerStatutAuxArticles(tx, d.commandeId, "RECUPEREE");
    await tx.commande.update({
      where: { id: d.commandeId },
      data: {
        statut: "RECUPEREE",
        fraisTransitaireReel: d.fraisTransitaireReel,
        deviseTransitaire: d.deviseTransitaire,
        tauxDeviseTransitaireMga: d.tauxDeviseTransitaireMga ?? null,
        ...(d.poidsKg ? { poidsKg: d.poidsKg } : {}),
        dateRecuperation: date,
      },
    });
    await tx.historiqueStatut.create({
      data: {
        commandeId: d.commandeId,
        statut: "RECUPEREE",
        date,
        note: d.note ?? `${STATUT_LABELS.RECUPEREE} — frais réels saisis`,
      },
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
    const { commandeId, commande } = await tx.article.update({
      where: { id: articleId },
      data: { statut },
      select: { commandeId: true, commande: { select: { statut: true, dateRecuperation: true } } },
    });
    const articles = await tx.article.findMany({ where: { commandeId }, select: { statut: true } });
    const statutCommande = statutDepuisArticles(articles.map((a) => a.statut)) ?? commande.statut;
    if (statutCommande === commande.statut) return;
    await tx.commande.update({
      where: { id: commandeId },
      data: {
        statut: statutCommande,
        ...(statutCommande === "RECUPEREE" && !commande.dateRecuperation ? { dateRecuperation: new Date() } : {}),
      },
    });
    await tx.historiqueStatut.create({
      data: { commandeId, statut: statutCommande, note: NOTE_STATUT_ARTICLES },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
