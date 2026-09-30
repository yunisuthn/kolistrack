import { z } from "zod";
import { toInputDate } from "./format";
import { TOUS_STATUTS } from "./statuts";

// Les montants circulent en chaînes pour ne jamais passer par un float.
function nombreDecimal(decimales: number, message = "Nombre invalide") {
  const regex = new RegExp(`^\\d{1,12}(\\.\\d{1,${decimales}})?$`);
  return z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/[\s  ]/g, "").replace(",", "."))
    .pipe(z.string().regex(regex, message));
}

function nombreDecimalOptionnel(decimales: number, message?: string) {
  return z.preprocess(
    (v) => (v === null || v === undefined || String(v).trim() === "" ? null : v),
    nombreDecimal(decimales, message).nullable(),
  );
}

const texteOptionnel = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max, `${max} caractères maximum`).nullable().optional(),
  );

const urlOptionnelle = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.url({ error: "URL invalide" }).max(2000).nullable().optional(),
);

/** Codes de suivi stockés en majuscules sans espaces : unicité et recherche insensibles à la casse. */
export function normaliserCodeSuivi(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

const codeSuiviOptionnel = z.preprocess(
  (v) => (typeof v === "string" ? normaliserCodeSuivi(v) || null : v),
  z.string().max(100, "100 caractères maximum").nullable().optional(),
);

const dateJour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const montant = nombreDecimal(2, "Montant invalide (2 décimales max)");
export const montantOptionnel = nombreDecimalOptionnel(2, "Montant invalide (2 décimales max)");
export const taux = nombreDecimal(6, "Taux invalide").refine((v) => Number(v) > 0, "Le taux doit être positif");
export const tauxOptionnel = nombreDecimalOptionnel(6, "Taux invalide");

export const deviseSchema = z.enum(["MGA", "USD", "CNY"]);
export const statutSchema = z.enum(TOUS_STATUTS);

export const articleSchema = z.object({
  id: z.string().optional(),
  nom: z.string().trim().min(1, "Nom de l'article requis").max(300),
  lienProduit: urlOptionnelle,
  quantite: z.coerce.number().int("Quantité entière").min(1, "Quantité ≥ 1").max(100000),
  prixUnitaireCny: montant,
  image: urlOptionnelle,
  codeSuivi: codeSuiviOptionnel,
  statut: statutSchema.optional(),
});

export const commandeSchema = z.object({
  applicationId: z.string().min(1, "Choisissez une application"),
  transitaireId: z.preprocess((v) => (v === "" || v === "aucun" ? null : v), z.string().nullable()),
  dateCommande: dateJour,
  montantArticlesCny: montant,
  fraisAppCny: montant,
  fraisLivraisonCny: montant,
  tauxCnyMga: taux,
  poidsKg: nombreDecimalOptionnel(3, "Poids invalide (3 décimales max)"),
  volumeM3: nombreDecimalOptionnel(4, "Volume invalide (4 décimales max)"),
  fraisTransitaireEstime: montantOptionnel,
  fraisTransitaireReel: montantOptionnel,
  deviseTransitaire: deviseSchema,
  tauxDeviseTransitaireMga: tauxOptionnel,
  dateRecuperation: z.preprocess((v) => (v === "" ? null : v), dateJour.nullable().optional()),
  notes: texteOptionnel(5000),
  articles: z.array(articleSchema).max(200),
});
export type CommandeInput = z.input<typeof commandeSchema>;

export const changementStatutSchema = z.object({
  commandeId: z.string().min(1),
  statut: statutSchema,
  date: dateJour,
  note: texteOptionnel(1000),
});

export const changementStatutArticleSchema = z.object({
  articleId: z.string().min(1),
  statut: statutSchema,
});

export const recuperationSchema = z.object({
  commandeId: z.string().min(1),
  fraisTransitaireReel: montant,
  deviseTransitaire: deviseSchema,
  tauxDeviseTransitaireMga: tauxOptionnel,
  poidsKg: nombreDecimalOptionnel(3, "Poids invalide (3 décimales max)"),
  dateRecuperation: dateJour,
  note: texteOptionnel(1000),
});

export const applicationSchema = z
  .object({
    id: z.string().optional(),
    nom: z.string().trim().min(1, "Nom requis").max(100),
    fraisType: z.enum(["POURCENTAGE", "FIXE"]),
    fraisValeur: montant,
    actif: z.boolean(),
  })
  .refine((a) => a.fraisType !== "POURCENTAGE" || Number(a.fraisValeur) <= 100, {
    message: "Un pourcentage ne peut pas dépasser 100",
    path: ["fraisValeur"],
  });

export const transitaireSchema = z.object({
  id: z.string().optional(),
  nom: z.string().trim().min(1, "Nom requis").max(100),
  contact: texteOptionnel(200),
  tarifParKg: nombreDecimalOptionnel(4, "Tarif invalide"),
  tarifParM3: nombreDecimalOptionnel(4, "Tarif invalide"),
  devise: deviseSchema,
  notes: texteOptionnel(2000),
});

/**
 * "2026-09-29" → Date. Aujourd'hui : l'heure actuelle (ordre chronologique exact) ;
 * autre jour : midi heure de Madagascar (évite les décalages de jour).
 */
export function dateDepuisInput(value: string): Date {
  if (value === toInputDate(new Date())) return new Date();
  return new Date(`${value}T12:00:00+03:00`);
}

export type ErreursChamps = Record<string, string>;

export function erreursDepuisZod(error: z.ZodError): ErreursChamps {
  const erreurs: ErreursChamps = {};
  for (const issue of error.issues) {
    const cle = issue.path.join(".") || "_";
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}
