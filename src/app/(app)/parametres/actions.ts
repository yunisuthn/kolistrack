"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { estErreurUnicite, exigerSession, type ResultatAction } from "@/lib/auth";
import {
  applicationSchema,
  clientSchema,
  erreursDepuisZod,
  parametresSchema,
  transitaireSchema,
} from "@/lib/validations";

export async function enregistrerApplication(
  input: z.input<typeof applicationSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { id, ...data } = parsed.data;
  try {
    if (id) await prisma.application.update({ where: { id }, data });
    else await prisma.application.create({ data });
  } catch (e) {
    if (estErreurUnicite(e)) return { ok: false, erreurs: { nom: "Ce nom existe déjà" } };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function supprimerApplication(id: string): Promise<ResultatAction> {
  await exigerSession();
  const nb = await prisma.commande.count({ where: { applicationId: id } });
  if (nb > 0) {
    return {
      ok: false,
      erreur: `Impossible : ${nb} commande(s) utilisent cette application. Désactivez-la plutôt.`,
    };
  }
  await prisma.application.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function enregistrerTransitaire(
  input: z.input<typeof transitaireSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = transitaireSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { id, ...data } = parsed.data;
  try {
    if (id) await prisma.transitaire.update({ where: { id }, data });
    else await prisma.transitaire.create({ data });
  } catch (e) {
    if (estErreurUnicite(e)) return { ok: false, erreurs: { nom: "Ce nom existe déjà" } };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function supprimerTransitaire(id: string): Promise<ResultatAction> {
  await exigerSession();
  const nb = await prisma.commande.count({ where: { transitaireId: id } });
  if (nb > 0) {
    return { ok: false, erreur: `Impossible : ${nb} commande(s) sont liées à ce transitaire.` };
  }
  await prisma.transitaire.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function enregistrerClient(
  input: z.input<typeof clientSchema>,
): Promise<ResultatAction<{ id: string; nom: string }>> {
  await exigerSession();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { id, ...champs } = parsed.data;
  const data = { ...champs, telephone: champs.telephone ?? null, notes: champs.notes ?? null };
  let client;
  try {
    client = id
      ? await prisma.client.update({ where: { id }, data })
      : await prisma.client.create({ data });
  } catch (e) {
    if (estErreurUnicite(e)) return { ok: false, erreurs: { nom: "Ce client existe déjà" } };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: client.id, nom: client.nom } };
}

export async function supprimerClient(id: string): Promise<ResultatAction> {
  await exigerSession();
  const nb = await prisma.article.count({ where: { clientId: id } });
  if (nb > 0) {
    return { ok: false, erreur: `Impossible : ${nb} article(s) sont liés à ce client.` };
  }
  await prisma.client.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Le nouveau taux ne s'applique qu'aux articles enregistrés ensuite : les anciens gardent leur taux figé. */
export async function enregistrerParametres(
  input: z.input<typeof parametresSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = parametresSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  await prisma.parametres.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
