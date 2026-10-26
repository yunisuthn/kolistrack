"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { StatutCommande } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { estErreurCleEtrangere, exigerSession, type ResultatAction } from "@/lib/auth";
import Decimal from "decimal.js";
import {
  arrondi2,
  dec,
  type DecimalLike,
  montantArticlesCny,
  partDesArticles,
  reglagesVenteArticle,
  repartirFraisColis,
} from "@/lib/calculs";
import { getParametres } from "@/lib/commandes";
import { formatDate, formatDevise } from "@/lib/format";
import { STATUT_LABELS, statutDepuisArticles, statutsAnterieurs } from "@/lib/statuts";
import {
  changementStatutArticleSchema,
  changementStatutSchema,
  commandeSchema,
  deplacementArticlesSchema,
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
 * Un ou plusieurs colis arrivés ensemble (mode COLIS) : le total payé au transitaire est réparti entre
 * eux (voir repartirFraisColis), leurs articles passent « Récupérée » ; le statut de la commande est recalculé.
 */
export async function marquerColisRecupere(
  input: z.input<typeof recuperationColisSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = recuperationColisSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const d = parsed.data;
  const commande = await prisma.commande.findUnique({
    where: { id: d.commandeId },
    select: {
      deviseTransitaire: true,
      colis: {
        where: { id: { in: d.colis.map((x) => x.id) } },
        select: { id: true, codeSuivi: true, poidsKg: true, fraisEstime: true },
      },
    },
  });
  if (!commande || commande.colis.length !== d.colis.length) {
    return { ok: false, erreur: "Un colis n'existe plus. Rechargez la page." };
  }
  if (commande.deviseTransitaire === "USD" && !d.tauxDeviseTransitaireMga) {
    return { ok: false, erreurs: { tauxDeviseTransitaireMga: "Indiquez le taux USD → MGA appliqué" } };
  }

  // Dans l'ordre saisi, avec le poids tel que saisi (pré-rempli) : la répartition est celle de l'aperçu
  const colis = d.colis.map((saisi) => ({
    ...commande.colis.find((c) => c.id === saisi.id)!,
    poidsKg: saisi.poidsKg,
  }));
  const codes = colis.map((x) => x.codeSuivi);

  // Un colis récupéré entre-temps (autre onglet) garde ses frais réels
  const aRecuperer = await prisma.article.findMany({
    where: { commandeId: d.commandeId, codeSuivi: { in: codes }, statut: { notIn: ["RECUPEREE", "ANNULEE"] } },
    select: { codeSuivi: true },
  });
  const dejaRecupere = codes.find((code) => !aRecuperer.some((a) => a.codeSuivi === code));
  if (dejaRecupere) {
    return { ok: false, erreur: `Le colis ${dejaRecupere} est déjà récupéré. Rechargez la page.` };
  }
  const { parts } = repartirFraisColis(d.fraisReel, colis);

  await prisma.$transaction(async (tx) => {
    for (const [i, x] of colis.entries()) {
      await tx.colis.update({
        where: { id: x.id },
        data: { fraisReel: parts[i].toFixed(2), poidsKg: x.poidsKg },
      });
    }
    if (commande.deviseTransitaire !== "MGA" && d.tauxDeviseTransitaireMga) {
      await tx.commande.update({
        where: { id: d.commandeId },
        data: { tauxDeviseTransitaireMga: d.tauxDeviseTransitaireMga },
      });
    }
    await tx.article.updateMany({
      where: { commandeId: d.commandeId, codeSuivi: { in: codes }, statut: { notIn: ["RECUPEREE", "ANNULEE"] } },
      data: { statut: "RECUPEREE" },
    });
    await synchroniserStatutCommande(tx, d.commandeId, {
      date: dateDepuisInput(d.dateRecuperation),
      note:
        codes.length === 1
          ? `Colis ${codes[0]} récupéré — frais réels saisis`
          : `Colis ${codes.join(", ")} récupérés ensemble — ${formatDevise(d.fraisReel, commande.deviseTransitaire)} au total`,
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export type CommandeCibleDto = {
  id: string;
  application: string;
  date: string;
  statut: string;
  nbArticles: number;
  tauxCnyMga: string;
};

/** Commandes vers lesquelles déplacer des articles : les plus récentes, ou celles qui correspondent à la recherche. */
export async function chercherCommandesCibles(commandeId: string, recherche: string): Promise<CommandeCibleDto[]> {
  await exigerSession();
  const q = recherche.trim().slice(0, 100);
  const contient = { contains: q, mode: "insensitive" } as const;
  const commandes = await prisma.commande.findMany({
    where: {
      id: { not: commandeId },
      ...(q
        ? {
            OR: [
              { application: { nom: contient } },
              { articles: { some: { OR: [{ nom: contient }, { codeSuivi: contient }] } } },
            ],
          }
        : {}),
    },
    orderBy: [{ dateCommande: "desc" }, { id: "desc" }],
    take: 30,
    select: {
      id: true,
      dateCommande: true,
      statut: true,
      tauxCnyMga: true,
      application: { select: { nom: true } },
      _count: { select: { articles: true } },
    },
  });
  return commandes.map((c) => ({
    id: c.id,
    application: c.application.nom,
    date: formatDate(c.dateCommande),
    statut: STATUT_LABELS[c.statut],
    nbArticles: c._count.articles,
    tauxCnyMga: c.tauxCnyMga.toString(),
  }));
}

const champsDeplacement = {
  modeFraisTransitaire: true,
  deviseTransitaire: true,
  fraisAppCny: true,
  fraisLivraisonCny: true,
  fraisTransitaireEstime: true,
  fraisTransitaireReel: true,
  articles: { select: { id: true, nom: true, codeSuivi: true, quantite: true, prixUnitaireCny: true } },
  colis: { select: { codeSuivi: true, fraisEstime: true, fraisReel: true } },
} satisfies Prisma.CommandeSelect;

/**
 * Déplace des articles vers une autre commande. La part de chaque frais déjà engagé les suit (retirée
 * de la commande d'origine, ajoutée à la cible), selon la règle de répartition de calculerCommande :
 * le total payé ne change pas. Leur colis (un code de suivi) les suit aussi.
 * Refusé quand la cible ne peut pas accueillir ces frais tels quels : autre devise ou autre mode de
 * frais transitaire, frais réels d'un côté et estimés de l'autre, colis partagé ou code déjà présent.
 * Les articles prennent le taux figé de la cible.
 */
export async function deplacerArticles(
  input: z.input<typeof deplacementArticlesSchema>,
): Promise<ResultatAction> {
  await exigerSession();
  const parsed = deplacementArticlesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreurs: erreursDepuisZod(parsed.error) };
  const { commandeSourceId, commandeCibleId, articleIds } = parsed.data;
  if (commandeSourceId === commandeCibleId) {
    return { ok: false, erreurs: { commandeCibleId: "Choisissez une autre commande" } };
  }

  const erreur = await prisma.$transaction(async (tx) => {
    const source = await tx.commande.findUnique({ where: { id: commandeSourceId }, select: champsDeplacement });
    const cible = await tx.commande.findUnique({ where: { id: commandeCibleId }, select: champsDeplacement });
    if (!source || !cible) return "Une des deux commandes n'existe plus. Rechargez la page.";

    const ids = new Set(articleIds);
    const deplaces = source.articles.filter((a) => ids.has(a.id));
    const restants = source.articles.filter((a) => !ids.has(a.id));
    if (deplaces.length !== ids.size) return "Certains articles ont changé entre-temps. Rechargez la page.";

    const memeDevise = source.deviseTransitaire === cible.deviseTransitaire;
    const autreDevise = `la commande cible paie le transitaire en ${cible.deviseTransitaire} et celle-ci en ${source.deviseTransitaire}. Changez la devise de l'une des deux avant de déplacer.`;

    const codes = [...new Set(deplaces.flatMap((a) => (a.codeSuivi ? [a.codeSuivi] : [])))];
    for (const code of codes) {
      const resteDansColis = restants.find((a) => a.codeSuivi === code);
      if (resteDansColis) return `Le colis ${code} contient aussi « ${resteDansColis.nom} » : sélectionnez-le aussi.`;
      if (cible.articles.some((a) => a.codeSuivi === code) || cible.colis.some((x) => x.codeSuivi === code)) {
        return `Le code de suivi ${code} existe déjà dans la commande cible.`;
      }
      const colis = source.colis.find((x) => x.codeSuivi === code);
      if (colis && (colis.fraisEstime || colis.fraisReel)) {
        if (cible.modeFraisTransitaire !== "COLIS") {
          return `Le colis ${code} a des frais transitaire, mais la commande cible compte ses frais pour toute la commande.`;
        }
        if (!memeDevise) return `Le colis ${code} a des frais transitaire, mais ${autreDevise}`;
      }
    }

    // Part des articles déplacés dans les frais répartis sur toute la commande d'origine
    const part = partDesArticles(source.articles, deplaces);
    const partDe = (montant: DecimalLike) => {
      const v = dec(montant);
      return v ? arrondi2(v.mul(part)) : null;
    };
    const transfert = (vers: DecimalLike, montant: Decimal | null, signe: 1 | -1) =>
      montant ? (dec(vers) ?? new Decimal(0)).add(montant.mul(signe)).toFixed(2) : undefined;

    const partApp = partDe(source.fraisAppCny);
    const partLivraison = partDe(source.fraisLivraisonCny);
    let partEstime: Decimal | null = null;
    let partReel: Decimal | null = null;
    if (source.modeFraisTransitaire === "COMMANDE" && (source.fraisTransitaireEstime || source.fraisTransitaireReel)) {
      if (cible.modeFraisTransitaire !== "COMMANDE") {
        return "Les frais transitaire de cette commande sont comptés pour toute la commande, mais la commande cible les compte par colis.";
      }
      if (!memeDevise) return `Les frais transitaire ne peuvent pas suivre les articles : ${autreDevise}`;
      if (!source.fraisTransitaireReel !== !cible.fraisTransitaireReel) {
        return "Une seule des deux commandes a ses frais transitaire réels : impossible de mélanger frais réels et estimés.";
      }
      partEstime = partDe(source.fraisTransitaireEstime);
      partReel = partDe(source.fraisTransitaireReel);
    }

    await tx.article.updateMany({ where: { id: { in: articleIds } }, data: { commandeId: commandeCibleId } });
    if (codes.length > 0) {
      await tx.colis.updateMany({
        where: { commandeId: commandeSourceId, codeSuivi: { in: codes } },
        data: { commandeId: commandeCibleId },
      });
    }
    const cotes: { commandeId: string; c: typeof source; articles: typeof deplaces; signe: 1 | -1 }[] = [
      { commandeId: commandeSourceId, c: source, articles: restants, signe: -1 },
      { commandeId: commandeCibleId, c: cible, articles: [...cible.articles, ...deplaces], signe: 1 },
    ];
    for (const { commandeId, c, articles, signe } of cotes) {
      await tx.commande.update({
        where: { id: commandeId },
        data: {
          montantArticlesCny: montantArticlesCny(articles).toFixed(2),
          fraisAppCny: transfert(c.fraisAppCny, partApp, signe),
          fraisLivraisonCny: transfert(c.fraisLivraisonCny, partLivraison, signe),
          fraisTransitaireEstime: transfert(c.fraisTransitaireEstime, partEstime, signe),
          fraisTransitaireReel: transfert(c.fraisTransitaireReel, partReel, signe),
        },
      });
      await synchroniserStatutCommande(tx, commandeId);
    }
    return null;
  });
  if (erreur) return { ok: false, erreur };

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
