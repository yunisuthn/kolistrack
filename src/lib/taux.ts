import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

const API_URL = "https://open.er-api.com/v6/latest/CNY";
const DUREE_CACHE_MS = 24 * 60 * 60 * 1000;

export type TauxActuels = {
  /** 1 CNY = x MGA */
  CNY: string;
  /** 1 USD = x MGA */
  USD: string;
  date: string;
  /** true si les taux datent de plus de 24 h (API injoignable) */
  perime: boolean;
};

type ApiReponse = { result: string; rates?: Record<string, number> };

async function recupererDepuisApi(): Promise<{ CNY: Prisma.Decimal; USD: Prisma.Decimal } | null> {
  try {
    const res = await fetch(API_URL, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as ApiReponse;
    const mga = data.rates?.MGA;
    const usd = data.rates?.USD;
    if (data.result !== "success" || !mga || !usd) return null;
    const cnyMga = new Prisma.Decimal(String(mga));
    // L'API est basée sur le CNY : USD→MGA = (CNY→MGA) / (CNY→USD)
    const usdMga = cnyMga.div(new Prisma.Decimal(String(usd))).toDecimalPlaces(6);
    return { CNY: cnyMga.toDecimalPlaces(6), USD: usdMga };
  } catch {
    return null;
  }
}

/**
 * Taux du jour CNY→MGA et USD→MGA, avec cache en base (appel API au plus une fois par 24 h).
 * Retourne null si aucun taux n'est disponible (API injoignable et cache vide).
 */
export async function getTauxActuels(): Promise<TauxActuels | null> {
  const [cny, usd] = await Promise.all([
    prisma.tauxChange.findFirst({ where: { devise: "CNY" }, orderBy: { date: "desc" } }),
    prisma.tauxChange.findFirst({ where: { devise: "USD" }, orderBy: { date: "desc" } }),
  ]);

  const plusAncien = cny && usd ? Math.min(cny.date.getTime(), usd.date.getTime()) : 0;
  if (cny && usd && Date.now() - plusAncien < DUREE_CACHE_MS) {
    return {
      CNY: cny.tauxVersMga.toString(),
      USD: usd.tauxVersMga.toString(),
      date: cny.date.toISOString(),
      perime: false,
    };
  }

  const frais = await recupererDepuisApi();
  if (frais) {
    const now = new Date();
    await prisma.tauxChange.createMany({
      data: [
        { devise: "CNY", tauxVersMga: frais.CNY, date: now },
        { devise: "USD", tauxVersMga: frais.USD, date: now },
      ],
    });
    return { CNY: frais.CNY.toString(), USD: frais.USD.toString(), date: now.toISOString(), perime: false };
  }

  if (cny && usd) {
    return {
      CNY: cny.tauxVersMga.toString(),
      USD: usd.tauxVersMga.toString(),
      date: cny.date.toISOString(),
      perime: true,
    };
  }
  return null;
}
