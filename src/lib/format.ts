import type Decimal from "decimal.js";
import { dec, type DecimalLike, type DeviseCode } from "./calculs";

const TIMEZONE = "Indian/Antananarivo";

function toNumberForDisplay(value: DecimalLike | Decimal): number | null {
  const d = dec(value as DecimalLike);
  return d ? d.toNumber() : null; // conversion uniquement pour l'affichage
}

const mgaFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const cnyFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tauxFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function formatMGA(value: DecimalLike | Decimal, vide = "—"): string {
  const n = toNumberForDisplay(value);
  return n === null ? vide : `${mgaFormatter.format(n)} Ar`;
}

export function formatCNY(value: DecimalLike | Decimal, vide = "—"): string {
  const n = toNumberForDisplay(value);
  return n === null ? vide : `${cnyFormatter.format(n)} 元`;
}

export function formatUSD(value: DecimalLike | Decimal, vide = "—"): string {
  const n = toNumberForDisplay(value);
  return n === null ? vide : `$ ${usdFormatter.format(n)}`;
}

export function formatDevise(value: DecimalLike | Decimal, devise: DeviseCode, vide = "—"): string {
  if (devise === "MGA") return formatMGA(value, vide);
  if (devise === "CNY") return formatCNY(value, vide);
  return formatUSD(value, vide);
}

export function formatTaux(value: DecimalLike | Decimal): string {
  const n = toNumberForDisplay(value);
  return n === null ? "—" : tauxFormatter.format(n);
}

export function formatNombre(value: DecimalLike | Decimal, decimales = 3): string {
  const n = toNumberForDisplay(value);
  return n === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimales }).format(n);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: TIMEZONE }).format(
    new Date(date),
  );
}

export function formatDateHeure(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

export function formatMois(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: TIMEZONE }).format(date);
}

/** Date au format AAAA-MM-JJ (pour les <input type="date">), dans le fuseau de Madagascar. */
export function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(date));
}

export function joursDepuis(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}
