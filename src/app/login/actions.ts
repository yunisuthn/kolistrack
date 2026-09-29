"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_DURATION_S, createSessionToken } from "@/lib/session";

export type LoginState = { erreur?: string };

const loginSchema = z.object({
  motDePasse: z.string().min(1, "Mot de passe requis"),
  next: z.string().optional(),
});

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeRedirectTarget(next: string | undefined) {
  // Évite les redirections ouvertes : uniquement des chemins internes
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    motDePasse: formData.get("motDePasse"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { erreur: parsed.error.issues[0].message };

  const expected = process.env.APP_PASSWORD;
  if (!expected) return { erreur: "APP_PASSWORD n'est pas configuré sur le serveur." };

  if (!timingSafeEqual(hash(parsed.data.motDePasse), hash(expected))) {
    await new Promise((r) => setTimeout(r, 800)); // ralentit les essais en série
    return { erreur: "Mot de passe incorrect." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_S,
  });

  redirect(safeRedirectTarget(parsed.data.next));
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
