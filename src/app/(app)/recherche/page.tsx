import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { StatutBadge } from "@/components/statut-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { normaliserCodeSuivi } from "@/lib/validations";

export const metadata: Metadata = { title: "Recherche colis" };

export default async function RecherchePage({ searchParams }: PageProps<"/recherche">) {
  const sp = await searchParams;
  const code = normaliserCodeSuivi((Array.isArray(sp.code) ? sp.code[0] : sp.code) ?? "");

  let resultats: Awaited<ReturnType<typeof rechercher>> = [];
  if (code) {
    // Correspondance exacte (insensible à la casse) : on ouvre directement la commande
    const exacte = await prisma.commande.findFirst({
      where: { codeSuivi: { equals: code, mode: "insensitive" } },
      select: { id: true },
    });
    if (exacte) redirect(`/commandes/${exacte.id}`);
    resultats = await rechercher(code);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1 text-center">
        <ScanSearch className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Recherche par code colis</h1>
        <p className="text-sm text-muted-foreground">
          Le transitaire annonce un colis ? Saisissez son code pour retrouver la commande.
        </p>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="code"
          defaultValue={code}
          placeholder="Ex. YT1234567890"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-12 font-mono text-lg"
          aria-label="Code de suivi"
        />
        <Button type="submit" size="lg" className="h-12">
          Chercher
        </Button>
      </form>

      {code && (
        <div className="space-y-3">
          {resultats.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-6 text-center">
                <p>
                  Aucune commande avec le code <span className="font-mono font-medium">{code}</span>.
                </p>
                <p className="text-sm text-muted-foreground">
                  Le code n&apos;a peut-être pas encore été saisi sur la commande.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/commandes?statut=EN_COURS">Voir les commandes en cours</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Pas de correspondance exacte — {resultats.length} code(s) proche(s) :
              </p>
              {resultats.map((c) => (
                <Link key={c.id} href={`/commandes/${c.id}`} className="block">
                  <Card className="py-4 transition-colors hover:bg-muted/50">
                    <CardContent className="flex items-center justify-between gap-3 px-4">
                      <div className="min-w-0">
                        <p className="font-mono font-medium">{c.codeSuivi}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {c.application.nom} · {formatDate(c.dateCommande)}
                          {c.articles[0] && ` · ${c.articles[0].nom}`}
                        </p>
                      </div>
                      <StatutBadge statut={c.statut} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function rechercher(code: string) {
  return prisma.commande.findMany({
    where: { codeSuivi: { contains: code, mode: "insensitive" } },
    include: {
      application: { select: { nom: true } },
      articles: { select: { nom: true }, take: 1, orderBy: { id: "asc" } },
    },
    orderBy: { dateCommande: "desc" },
    take: 20,
  });
}
