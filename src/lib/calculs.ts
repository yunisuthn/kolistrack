// Calculs financiers d'une commande. Module pur (sans accès base), utilisé
// côté serveur et côté client (calcul en direct dans le formulaire).
// Toutes les opérations passent par decimal.js : jamais de float.

import Decimal from "decimal.js";

export type DecimalLike = Decimal.Value | { toString(): string } | null | undefined;
export type DeviseCode = "MGA" | "USD" | "CNY";
export type FraisTypeCode = "POURCENTAGE" | "FIXE";
export type DestinationCode = "CLIENT" | "STOCK" | "PERSONNEL";

/** Convertit une valeur (string, number, Prisma.Decimal…) en Decimal, ou null si vide. */
export function dec(value: DecimalLike): Decimal | null {
  if (value === null || value === undefined) return null;
  const str = typeof value === "object" ? value.toString() : String(value);
  if (str.trim() === "") return null;
  try {
    const d = new Decimal(str.replace(/[\s  ]/g, "").replace(",", "."));
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function dec0(value: DecimalLike): Decimal {
  return dec(value) ?? new Decimal(0);
}

export function arrondi2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export type ArticleCalcul = { quantite: DecimalLike; prixUnitaireCny: DecimalLike };

export function totalLigneCny(article: ArticleCalcul): Decimal {
  return dec0(article.quantite).mul(dec0(article.prixUnitaireCny));
}

export function montantArticlesCny(articles: ArticleCalcul[]): Decimal {
  return articles.reduce((acc, a) => acc.add(totalLigneCny(a)), new Decimal(0));
}

/** Frais d'application calculés à partir de la configuration de l'application. */
export function calculerFraisApp(
  fraisType: FraisTypeCode,
  fraisValeur: DecimalLike,
  montantCny: DecimalLike,
): Decimal {
  const valeur = dec0(fraisValeur);
  if (fraisType === "FIXE") return arrondi2(valeur);
  return arrondi2(dec0(montantCny).mul(valeur).div(100));
}

/** Estimation des frais transitaire depuis ses tarifs (au kg et/ou au m³ : on retient le plus élevé). */
export function estimerFraisTransitaire(
  tarifs: { tarifParKg: DecimalLike; tarifParM3: DecimalLike },
  poidsKg: DecimalLike,
  volumeM3: DecimalLike,
): Decimal | null {
  const candidats: Decimal[] = [];
  const tarifKg = dec(tarifs.tarifParKg);
  const tarifM3 = dec(tarifs.tarifParM3);
  const poids = dec(poidsKg);
  const volume = dec(volumeM3);
  if (tarifKg && poids) candidats.push(tarifKg.mul(poids));
  if (tarifM3 && volume) candidats.push(tarifM3.mul(volume));
  if (candidats.length === 0) return null;
  return arrondi2(Decimal.max(...candidats));
}

/**
 * Taux de vente et gain minimum d'un article : un champ vide prend la valeur par défaut des
 * paramètres ; un article personnel n'en a pas. Partagé par l'aperçu du formulaire et l'enregistrement.
 */
export function reglagesVenteArticle(
  a: { destination: DestinationCode; tauxVenteCnyMga?: string | null; gainMinimumMga?: string | null },
  defauts: { tauxVenteDefaut: string; gainMinimumDefaut: string },
): { tauxVenteCnyMga: string | null; gainMinimumMga: string | null } {
  if (a.destination === "PERSONNEL") return { tauxVenteCnyMga: null, gainMinimumMga: null };
  return {
    tauxVenteCnyMga: a.tauxVenteCnyMga?.trim() || defauts.tauxVenteDefaut,
    gainMinimumMga: a.gainMinimumMga?.trim() || defauts.gainMinimumDefaut,
  };
}

export type StatutTotal = "DEFINITIF" | "ESTIME" | "INCOMPLET";

export type CommandeCalculInput = {
  montantArticlesCny: DecimalLike;
  fraisAppCny: DecimalLike;
  fraisLivraisonCny: DecimalLike;
  tauxCnyMga: DecimalLike;
  fraisTransitaireEstime: DecimalLike;
  fraisTransitaireReel: DecimalLike;
  deviseTransitaire: DeviseCode;
  tauxDeviseTransitaireMga: DecimalLike;
  articles?: (ArticleCalcul & {
    id?: string;
    nom?: string;
    destination?: DestinationCode;
    tauxVenteCnyMga?: DecimalLike;
    gainMinimumMga?: DecimalLike;
  })[];
};

export type CoutArticle = {
  id?: string;
  nom?: string;
  quantite: Decimal;
  totalLigneCny: Decimal;
  totalLigneMga: Decimal;
  fraisRepartisMga: Decimal;
  coutRevientLigneMga: Decimal;
  coutRevientUnitaireMga: Decimal;
  /**
   * Prix demandé : total 元 × taux de vente + frais répartis (au prix coûtant),
   * relevé à coût de revient + gain minimum × quantité si besoin. Null si personnel.
   */
  prixVenteLigneMga: Decimal | null;
  prixVenteUnitaireMga: Decimal | null;
  /** Gain : total 元 × (taux de vente − taux réel), ou le gain minimum. Null si personnel. */
  margeLigneMga: Decimal | null;
  /** Vrai si le prix a été relevé pour atteindre le gain minimum */
  gainMinimumApplique: boolean;
};

export type TotauxVente = {
  /** À encaisser auprès des clients (articles CLIENT) */
  clientsMga: Decimal;
  /** Valeur de vente des articles en stock (articles STOCK) */
  stockMga: Decimal;
  /** Gain prévu sur les articles CLIENT et STOCK */
  margeMga: Decimal;
  /** Coût de revient des articles personnels */
  personnelMga: Decimal;
};

export type CommandeCalcul = {
  sousTotalCny: Decimal;
  sousTotalMga: Decimal;
  /** Montant transitaire retenu (réel sinon estimé), dans sa devise d'origine */
  fraisTransitaireDevise: Decimal | null;
  fraisTransitaireMga: Decimal | null;
  /** Taux utilisé pour convertir les frais transitaire vers MGA */
  tauxTransitaireUtilise: Decimal | null;
  coutTotalMga: Decimal;
  statutTotal: StatutTotal;
  coutsArticles: CoutArticle[];
  ventes: TotauxVente;
};

/**
 * Calcule sous-totaux, frais transitaire convertis, total et coût de revient par article.
 * @param tauxActuels taux du jour, utilisés en secours si la commande n'a pas de taux transitaire enregistré
 */
export function calculerCommande(
  c: CommandeCalculInput,
  tauxActuels?: Partial<Record<DeviseCode, DecimalLike>>,
): CommandeCalcul {
  const tauxCny = dec0(c.tauxCnyMga);
  const montantArticles = dec0(c.montantArticlesCny);
  const fraisApp = dec0(c.fraisAppCny);
  const fraisLivraison = dec0(c.fraisLivraisonCny);

  const sousTotalCny = montantArticles.add(fraisApp).add(fraisLivraison);
  const sousTotalMga = sousTotalCny.mul(tauxCny);

  const reel = dec(c.fraisTransitaireReel);
  const estime = dec(c.fraisTransitaireEstime);
  const fraisTransitaireDevise = reel ?? estime;
  const statutTotal: StatutTotal = reel ? "DEFINITIF" : estime ? "ESTIME" : "INCOMPLET";

  let tauxTransitaireUtilise: Decimal | null = null;
  if (c.deviseTransitaire === "MGA") tauxTransitaireUtilise = new Decimal(1);
  else
    tauxTransitaireUtilise =
      dec(c.tauxDeviseTransitaireMga) ??
      (c.deviseTransitaire === "CNY" ? tauxCny : null) ??
      dec(tauxActuels?.[c.deviseTransitaire]);

  const fraisTransitaireMga =
    fraisTransitaireDevise && tauxTransitaireUtilise
      ? fraisTransitaireDevise.mul(tauxTransitaireUtilise)
      : null;

  const coutTotalMga = sousTotalMga.add(fraisTransitaireMga ?? 0);

  // Répartition proportionnelle à la valeur de chaque ligne (ou à la quantité si valeur nulle)
  const articles = c.articles ?? [];
  const fraisTotalMga = fraisApp.add(fraisLivraison).mul(tauxCny).add(fraisTransitaireMga ?? 0);
  const baseValeur = montantArticlesCny(articles);
  const baseQuantite = articles.reduce((acc, a) => acc.add(dec0(a.quantite)), new Decimal(0));

  const coutsArticles: CoutArticle[] = articles.map((a) => {
    const quantite = dec0(a.quantite);
    const ligneCny = totalLigneCny(a);
    const ligneMga = ligneCny.mul(tauxCny);
    let part = new Decimal(0);
    if (baseValeur.gt(0)) part = ligneCny.div(baseValeur);
    else if (baseQuantite.gt(0)) part = quantite.div(baseQuantite);
    const fraisRepartis = fraisTotalMga.mul(part);
    const coutLigne = ligneMga.add(fraisRepartis);
    const tauxVente = a.destination === "PERSONNEL" ? null : dec(a.tauxVenteCnyMga);
    let prixVente = tauxVente ? ligneCny.mul(tauxVente).add(fraisRepartis) : null;
    const prixPlancher = coutLigne.add(dec0(a.gainMinimumMga).mul(quantite));
    const gainMinimumApplique = !!prixVente && prixVente.lt(prixPlancher);
    if (gainMinimumApplique) prixVente = prixPlancher;
    return {
      id: a.id,
      nom: a.nom,
      quantite,
      totalLigneCny: ligneCny,
      totalLigneMga: ligneMga,
      fraisRepartisMga: fraisRepartis,
      coutRevientLigneMga: coutLigne,
      coutRevientUnitaireMga: quantite.gt(0) ? coutLigne.div(quantite) : new Decimal(0),
      prixVenteLigneMga: prixVente,
      prixVenteUnitaireMga: prixVente && quantite.gt(0) ? prixVente.div(quantite) : null,
      margeLigneMga: prixVente ? prixVente.sub(coutLigne) : null,
      gainMinimumApplique,
    };
  });

  const ventes: TotauxVente = {
    clientsMga: new Decimal(0),
    stockMga: new Decimal(0),
    margeMga: new Decimal(0),
    personnelMga: new Decimal(0),
  };
  articles.forEach((a, i) => {
    const cout = coutsArticles[i];
    if (a.destination === "PERSONNEL") ventes.personnelMga = ventes.personnelMga.add(cout.coutRevientLigneMga);
    if (!cout.prixVenteLigneMga) return;
    if (a.destination === "CLIENT") ventes.clientsMga = ventes.clientsMga.add(cout.prixVenteLigneMga);
    else ventes.stockMga = ventes.stockMga.add(cout.prixVenteLigneMga);
    ventes.margeMga = ventes.margeMga.add(cout.margeLigneMga ?? 0);
  });

  return {
    sousTotalCny,
    sousTotalMga,
    fraisTransitaireDevise,
    fraisTransitaireMga,
    tauxTransitaireUtilise,
    coutTotalMga,
    statutTotal,
    coutsArticles,
    ventes,
  };
}
