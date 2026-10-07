import Link from "next/link";
import Decimal from "decimal.js";
import { AlertTriangle, Plus } from "lucide-react";
import { StatutBadge } from "@/components/statut-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculerCommande } from "@/lib/calculs";
import { formatDate, formatMGA, formatMois, joursDepuis } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { STATUT_LABELS, STATUTS_EN_ATTENTE, TOUS_STATUTS } from "@/lib/statuts";
import { cn } from "@/lib/utils";
import { getTauxActuels } from "@/lib/taux";
import { GraphiqueMensuel, type PointMensuel } from "./graphique-mensuel";

const SEUIL_RETARD_JOURS = 30;
const NB_MOIS = 12;

function cleMois(date: Date) {
  // Mois dans le fuseau de Madagascar (AAAA-MM)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export default async function TableauDeBord() {
  const [commandes, taux] = await Promise.all([
    prisma.commande.findMany({
      include: {
        application: { select: { nom: true } },
        articles: {
          select: { quantite: true, prixUnitaireCny: true, codeSuivi: true, statut: true },
          orderBy: { id: "asc" },
        },
        colis: { select: { codeSuivi: true, fraisEstime: true, fraisReel: true } },
      },
      orderBy: { dateCommande: "asc" },
    }),
    getTauxActuels(),
  ]);

  const parStatut = Object.fromEntries(TOUS_STATUTS.map((s) => [s, 0])) as Record<
    (typeof TOUS_STATUTS)[number],
    number
  >;
  let enAttenteMga = new Decimal(0);
  let enAttenteEstime = false;
  const parMois = new Map<string, Decimal>();
  const enRetard: { id: string; app: string; code: string | null; date: Date; statut: (typeof TOUS_STATUTS)[number]; jours: number }[] = [];

  for (const c of commandes) {
    parStatut[c.statut]++;
    if (c.statut === "ANNULEE") continue;
    // Articles transmis pour les frais par colis (articles sans code de suivi = total incomplet)
    const calcul = calculerCommande(c, taux ?? undefined);

    const cle = cleMois(c.dateCommande);
    parMois.set(cle, (parMois.get(cle) ?? new Decimal(0)).add(calcul.coutTotalMga));

    if ((STATUTS_EN_ATTENTE as readonly string[]).includes(c.statut)) {
      enAttenteMga = enAttenteMga.add(calcul.coutTotalMga);
      if (calcul.statutTotal !== "DEFINITIF") enAttenteEstime = true;
      const jours = joursDepuis(c.dateCommande);
      if (jours > SEUIL_RETARD_JOURS) {
        enRetard.push({ id: c.id, app: c.application.nom, code: c.articles.find((a) => a.codeSuivi)?.codeSuivi ?? c.codeSuivi, date: c.dateCommande, statut: c.statut, jours });
      }
    }
  }
  enRetard.sort((a, b) => b.jours - a.jours);

  // 12 derniers mois, y compris les mois sans dépense
  const points: PointMensuel[] = [];
  const maintenant = new Date();
  for (let i = NB_MOIS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - i, 15));
    const cle = cleMois(d);
    const libelle = formatMois(d);
    points.push({
      cle,
      libelle,
      court: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(d).replace(".", ""),
      valeur: (parMois.get(cle) ?? new Decimal(0)).toDecimalPlaces(0).toNumber(),
      valeurTexte: formatMGA(parMois.get(cle) ?? 0),
    });
  }
  const total12Mois = points.reduce((acc, p) => acc.add(parMois.get(p.cle) ?? 0), new Decimal(0));
  const nbEnCours = STATUTS_EN_ATTENTE.reduce((acc, s) => acc + parStatut[s], 0);

  if (commandes.length === 0) {
    return (
      <div className="space-y-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Bienvenue sur KolisTrack</h1>
        <p className="text-muted-foreground">Aucune commande pour l&apos;instant.</p>
        <Button asChild>
          <Link href="/commandes/nouvelle">
            <Plus /> Créer ma première commande
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tableau de bord</h1>

      {/* Chiffres clés */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Montant en attente</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">{formatMGA(enAttenteMga)}</p>
            <p className="text-xs text-muted-foreground">
              {nbEnCours} commande(s) en cours{enAttenteEstime && " · inclut des estimations"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>Dépensé sur 12 mois</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">{formatMGA(total12Mois)}</p>
            <p className="text-xs text-muted-foreground">Hors commandes annulées</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription>En attente depuis + de {SEUIL_RETARD_JOURS} jours</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <p className={cn("text-2xl font-semibold tabular-nums", enRetard.length > 0 && "text-amber-600 dark:text-amber-400")}>
              {enRetard.length}
            </p>
            <p className="text-xs text-muted-foreground">commande(s) à surveiller</p>
          </CardContent>
        </Card>
      </div>

      {/* Commandes par statut */}
      <Card>
        <CardHeader>
          <CardTitle>Commandes par statut</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {TOUS_STATUTS.map((s) => (
            <Link
              key={s}
              href={`/commandes?statut=${s}`}
              className="flex flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-muted"
            >
              <span className="text-2xl font-semibold tabular-nums">{parStatut[s]}</span>
              <StatutBadge statut={s} className="h-auto max-w-full whitespace-normal" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Dépenses mensuelles */}
        <Card>
          <CardHeader>
            <CardTitle>Total dépensé par mois (Ar)</CardTitle>
            <CardDescription>Coût total des commandes, selon leur date de commande</CardDescription>
          </CardHeader>
          <CardContent>
            <GraphiqueMensuel points={points} />
          </CardContent>
        </Card>

        {/* Retards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              En attente depuis longtemps
            </CardTitle>
            <CardDescription>Non récupérées après {SEUIL_RETARD_JOURS} jours</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {enRetard.length === 0 && <p className="text-sm text-muted-foreground">Rien à signaler 👍</p>}
            {enRetard.slice(0, 10).map((c) => (
              <Link
                key={c.id}
                href={`/commandes/${c.id}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.app} <span className="font-mono text-xs text-muted-foreground">{c.code ?? ""}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(c.date)} · {STATUT_LABELS[c.statut]}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {c.jours} j
                </span>
              </Link>
            ))}
            {enRetard.length > 10 && (
              <Link href="/commandes?statut=EN_COURS&tri=date_asc" className="block pt-2.5 text-sm underline">
                Voir les {enRetard.length} commandes
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
