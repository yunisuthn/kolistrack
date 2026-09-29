import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { StatutBadge, StatutTotalBadge } from "@/components/statut-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Decimal from "decimal.js";
import { calculerCommande } from "@/lib/calculs";
import { formatCNY, formatDate, formatMGA } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { STATUTS_ORDONNES, TOUS_STATUTS } from "@/lib/statuts";
import { getTauxActuels } from "@/lib/taux";
import { FiltresCommandes } from "./filtres";
import { TRIS, type Tri } from "./tris";

export const metadata: Metadata = { title: "Commandes" };

function param(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CommandesPage({ searchParams }: PageProps<"/commandes">) {
  const sp = await searchParams;
  const statut = param(sp.statut);
  const applicationId = param(sp.application);
  const transitaireId = param(sp.transitaire);
  const du = param(sp.du);
  const au = param(sp.au);
  const q = param(sp.q);
  const triParam = param(sp.tri);
  const tri: Tri = triParam && triParam in TRIS ? (triParam as Tri) : "date_desc";

  const where: Prisma.CommandeWhereInput = {};
  if (statut === "EN_COURS") where.statut = { notIn: ["RECUPEREE", "ANNULEE"] };
  else if (statut && (TOUS_STATUTS as readonly string[]).includes(statut))
    where.statut = statut as (typeof TOUS_STATUTS)[number];
  if (applicationId) where.applicationId = applicationId;
  if (transitaireId) where.transitaireId = transitaireId === "aucun" ? null : transitaireId;
  if ((du && DATE_RE.test(du)) || (au && DATE_RE.test(au))) {
    where.dateCommande = {
      ...(du && DATE_RE.test(du) ? { gte: new Date(`${du}T00:00:00+03:00`) } : {}),
      ...(au && DATE_RE.test(au) ? { lte: new Date(`${au}T23:59:59.999+03:00`) } : {}),
    };
  }
  if (q) {
    where.OR = [
      { codeSuivi: { contains: q, mode: "insensitive" } },
      { articles: { some: { nom: { contains: q, mode: "insensitive" } } } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const [commandes, applications, transitaires, taux] = await Promise.all([
    prisma.commande.findMany({
      where,
      include: {
        application: { select: { nom: true } },
        transitaire: { select: { nom: true } },
        articles: { select: { nom: true, quantite: true }, orderBy: { id: "asc" } },
      },
      orderBy: { dateCommande: "desc" },
    }),
    prisma.application.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.transitaire.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    getTauxActuels(),
  ]);

  const lignes = commandes.map((c) => ({
    c,
    calcul: calculerCommande({ ...c, articles: undefined }, taux ?? undefined),
  }));
  const ordreStatut = (s: string) => [...STATUTS_ORDONNES, "ANNULEE"].indexOf(s);
  lignes.sort((a, b) => {
    switch (tri) {
      case "date_asc":
        return a.c.dateCommande.getTime() - b.c.dateCommande.getTime();
      case "total_desc":
        return b.calcul.coutTotalMga.cmp(a.calcul.coutTotalMga);
      case "total_asc":
        return a.calcul.coutTotalMga.cmp(b.calcul.coutTotalMga);
      case "statut":
        return ordreStatut(a.c.statut) - ordreStatut(b.c.statut);
      default:
        return b.c.dateCommande.getTime() - a.c.dateCommande.getTime();
    }
  });

  const totalMga = lignes.reduce((acc, l) => acc.add(l.calcul.coutTotalMga), new Decimal(0));

  const resumeArticles = (articles: { nom: string; quantite: number }[]) =>
    articles.length === 0
      ? "—"
      : articles
          .slice(0, 2)
          .map((a) => (a.quantite > 1 ? `${a.nom} ×${a.quantite}` : a.nom))
          .join(", ") + (articles.length > 2 ? ` +${articles.length - 2}` : "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Commandes</h1>
        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link href="/commandes/nouvelle">
            <Plus /> Nouvelle commande
          </Link>
        </Button>
      </div>

      <FiltresCommandes applications={applications} transitaires={transitaires} />

      <p className="text-sm text-muted-foreground">
        {lignes.length} commande(s){lignes.length > 0 && <> · total {formatMGA(totalMga)}</>}
      </p>

      {lignes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune commande ne correspond.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile : cartes */}
          <div className="space-y-3 md:hidden">
            {lignes.map(({ c, calcul }) => (
              <Link key={c.id} href={`/commandes/${c.id}`} className="block">
                <Card className="py-4 transition-colors active:bg-muted">
                  <CardContent className="space-y-2 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.application.nom}</span>
                      <StatutBadge statut={c.statut} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{resumeArticles(c.articles)}</p>
                    <div className="flex items-end justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        <p className="font-mono">{c.codeSuivi ?? "sans code"}</p>
                        <p>{formatDate(c.dateCommande)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatMGA(calcul.coutTotalMga)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatCNY(calcul.sousTotalCny)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop : tableau */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Code de suivi</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Sous-total</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map(({ c, calcul }) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/commandes/${c.id}`} className="after:absolute after:inset-0">
                        {formatDate(c.dateCommande)}
                      </Link>
                    </TableCell>
                    <TableCell>{c.application.nom}</TableCell>
                    <TableCell className="font-mono text-xs">{c.codeSuivi ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate">{resumeArticles(c.articles)}</TableCell>
                    <TableCell>
                      <StatutBadge statut={c.statut} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCNY(calcul.sousTotalCny)}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium tabular-nums">{formatMGA(calcul.coutTotalMga)}</div>
                      {calcul.statutTotal !== "DEFINITIF" && <StatutTotalBadge statut={calcul.statutTotal} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
