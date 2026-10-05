import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Vérification défensive dans chaque Server Action (en plus de proxy.ts). */
export async function exigerSession() {
  const cookieStore = await cookies();
  if (!(await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value))) {
    throw new Error("Non authentifié");
  }
}

export type ResultatAction<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; erreur?: string; erreurs?: Record<string, string> };

export function estErreurUnicite(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

/** Clé étrangère invalide : l'élément référencé a été supprimé entre-temps. */
export function estErreurCleEtrangere(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2003";
}
