"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { estErreurUnicite, exigerSession, type ResultatAction } from "@/lib/auth";
import { montantArticlesCny } from "@/lib/calculs";
import { STATUT_LABELS } from "@/lib/statuts";
import {
  changementStatutSchema,
  commandeSchema,
  dateDepuisInput,
  erreursDepuisZod,
  recuperationSchema,
  type CommandeInput,
} from "@/lib/validations";

export async function enregistrerCommande(
  id: string | null,
  input: CommandeInput,
): Promise<ResultatAction<{ id: string }>> {
  await exigerSession();
  const parsed = commandeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { articles, statut, dateCommande, dateRecuperation, ...champs } = parsed.data;

  // Le montant des articles fait foi dès qu'il y a des articles détaillés
  const montant =
    articles.length > 0 ? montantArticlesCny(articles).toFixed(2) : champs.montantArticlesCny;

  const data = {
    ...champs,
    montantArticlesCny: montant,
    dateCommande: dateDepuisInput(dateCommande),
    dateRecuperation: dateRecuperation ? dateDepuisInput(dateRecuperation) : null,
    codeSuivi: champs.codeSuivi ?? null,
    notes: champs.notes ?? null,
  };
  const articlesData = articles.map((a) => ({
    nom: a.nom,
    lienProduit: a.lienProduit ?? null,
    quantite: a.quantite,
    prixUnitaireCny: a.prixUnitaireCny,
    image: a.image ?? null,
  }));

  let commandeId: string;
  try {
    if (id) {
      await prisma.$transaction([
        prisma.commande.update({ where: { id }, data }),
        prisma.article.deleteMany({ where: { commandeId: id } }),
        prisma.article.createMany({ data: articlesData.map((a) => ({ ...a, commandeId: id })) }),
      ]);
      commandeId = id;
    } else {
      const statutInitial = statut ?? "COMMANDEE";
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
  } catch (e) {
    if (estErreurUnicite(e)) {
      return { ok: false, erreurs: { codeSuivi: "Ce code de suivi est déjà utilisé par une autre commande" } };
    }
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

  await prisma.$transaction([
    prisma.commande.update({
      where: { id: commandeId },
      data: {
        statut,
        ...(statut === "RECUPEREE" ? { dateRecuperation: dateStatut } : {}),
      },
    }),
    prisma.historiqueStatut.create({
      data: { commandeId, statut, date: dateStatut, note: note ?? null },
    }),
  ]);

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

  await prisma.$transaction([
    prisma.commande.update({
      where: { id: d.commandeId },
      data: {
        statut: "RECUPEREE",
        fraisTransitaireReel: d.fraisTransitaireReel,
        deviseTransitaire: d.deviseTransitaire,
        tauxDeviseTransitaireMga: d.tauxDeviseTransitaireMga ?? null,
        ...(d.poidsKg ? { poidsKg: d.poidsKg } : {}),
        dateRecuperation: date,
      },
    }),
    prisma.historiqueStatut.create({
      data: {
        commandeId: d.commandeId,
        statut: "RECUPEREE",
        date,
        note: d.note ?? `${STATUT_LABELS.RECUPEREE} — frais réels saisis`,
      },
    }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}
