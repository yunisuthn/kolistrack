import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { StatutBadge, StatutTotalBadge } from "@/components/statut-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { calculerCommande } from "@/lib/calculs";
import { getCommande } from "@/lib/commandes";
import {
  formatCNY,
  formatDate,
  formatDevise,
  formatMGA,
  formatNombre,
  formatTaux,
  joursDepuis,
  toInputDate,
} from "@/lib/format";
import { STATUT_LABELS, statutSuivant } from "@/lib/statuts";
import { getTauxActuels } from "@/lib/taux";
import { ActionsCommande } from "./actions-commande";

export async function generateMetadata({ params }: PageProps<"/commandes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = await getCommande(id);
  return { title: c ? `Commande ${c.codeSuivi ?? c.application.nom}` : "Commande" };
}

export default async function CommandePage({ params }: PageProps<"/commandes/[id]">) {
  const { id } = await params;
  const [c, taux] = await Promise.all([getCommande(id), getTauxActuels()]);
  if (!c) notFound();

  const calcul = calculerCommande({ ...c, articles: c.articles }, taux ?? undefined);
  const enCours = c.statut !== "RECUPEREE" && c.statut !== "ANNULEE";
  const cheminFraisDevise = c.deviseTransitaire !== "MGA";

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{c.application.nom}</h1>
            <StatutBadge statut={c.statut} />
          </div>
          <p className="font-mono text-sm">{c.codeSuivi ?? <span className="text-muted-foreground">Sans code de suivi</span>}</p>
          <p className="text-sm text-muted-foreground">
            Commandée le {formatDate(c.dateCommande)}
            {enCours && ` · il y a ${joursDepuis(c.dateCommande)} j`}
            {c.dateRecuperation && ` · récupérée le ${formatDate(c.dateRecuperation)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/commandes/${c.id}/modifier`}>
            <Pencil /> Modifier
          </Link>
        </Button>
      </div>

      <ActionsCommande
        commandeId={c.id}
        statut={c.statut}
        statutSuivant={statutSuivant(c.statut)}
        aujourdhui={toInputDate(new Date())}
        recuperation={{
          fraisTransitaireReel: (c.fraisTransitaireReel ?? c.fraisTransitaireEstime)?.toString() ?? "",
          deviseTransitaire: c.deviseTransitaire,
          tauxDeviseTransitaireMga:
            c.tauxDeviseTransitaireMga?.toString() ??
            (c.deviseTransitaire === "USD" ? taux?.USD ?? "" : ""),
          poidsKg: c.poidsKg?.toString() ?? "",
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-4">
          {/* Coûts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Coût <StatutTotalBadge statut={calcul.statutTotal} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Ligne label="Articles" valeur={formatCNY(c.montantArticlesCny)} />
              <Ligne label="Frais application" valeur={formatCNY(c.fraisAppCny)} />
              <Ligne label="Livraison Chine" valeur={formatCNY(c.fraisLivraisonCny)} />
              <Separator />
              <Ligne label="Sous-total" valeur={formatCNY(calcul.sousTotalCny)} fort />
              <Ligne
                label={`Sous-total en Ar (taux figé ${formatTaux(c.tauxCnyMga)})`}
                valeur={formatMGA(calcul.sousTotalMga)}
              />
              <Separator />
              <Ligne
                label="Frais transitaire estimés"
                valeur={formatDevise(c.fraisTransitaireEstime, c.deviseTransitaire, "inconnus")}
              />
              <Ligne
                label="Frais transitaire réels"
                valeur={formatDevise(c.fraisTransitaireReel, c.deviseTransitaire, "non saisis")}
              />
              {cheminFraisDevise && calcul.tauxTransitaireUtilise && (
                <Ligne
                  label={`Taux ${c.deviseTransitaire} → Ar`}
                  valeur={formatTaux(calcul.tauxTransitaireUtilise)}
                />
              )}
              <Ligne
                label="Frais transitaire retenus"
                valeur={calcul.fraisTransitaireMga ? formatMGA(calcul.fraisTransitaireMga) : "—"}
              />
              <Separator />
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  Coût total {calcul.statutTotal === "DEFINITIF" ? "définitif" : "estimé"}
                </span>
                <span className="text-xl font-semibold tabular-nums">{formatMGA(calcul.coutTotalMga)}</span>
              </div>
              {calcul.statutTotal === "INCOMPLET" && (
                <p className="text-xs text-muted-foreground">
                  Les frais du transitaire ne sont pas encore connus et ne sont pas inclus.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Articles */}
          <Card>
            <CardHeader>
              <CardTitle>Articles ({c.articles.length})</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {c.articles.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun article détaillé.</p>
              )}
              {c.articles.map((a, i) => {
                const cout = calcul.coutsArticles[i];
                return (
                  <div key={a.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    {a.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.image}
                        alt=""
                        className="size-16 shrink-0 rounded-md border object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">
                          {a.nom}
                          {a.lienProduit && (
                            <a
                              href={a.lienProduit}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
                              aria-label="Voir le produit"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </p>
                        <span className="shrink-0 text-sm tabular-nums">{formatCNY(cout.totalLigneCny)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {a.quantite} × {formatCNY(a.prixUnitaireCny)} = {formatMGA(cout.totalLigneMga)}
                      </p>
                      <p className="text-sm">
                        Coût de revient :{" "}
                        <span className="font-medium tabular-nums">{formatMGA(cout.coutRevientUnitaireMga)}</span>
                        <span className="text-muted-foreground"> / unité</span>
                        {a.quantite > 1 && (
                          <span className="text-muted-foreground"> · {formatMGA(cout.coutRevientLigneMga)} au total</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              {c.articles.length > 0 && (
                <p className="pt-3 text-xs text-muted-foreground">
                  Frais (application, livraison, transitaire) répartis au prorata de la valeur de chaque article.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Infos */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Ligne label="Transitaire" valeur={c.transitaire?.nom ?? "—"} />
              <Ligne label="Poids" valeur={c.poidsKg ? `${formatNombre(c.poidsKg)} kg` : "—"} />
              <Ligne label="Volume" valeur={c.volumeM3 ? `${formatNombre(c.volumeM3, 4)} m³` : "—"} />
              {c.notes && (
                <>
                  <Separator />
                  <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {c.historique.map((h, i) => (
                  <li key={h.id} className="relative">
                    <span
                      className={`absolute top-1 -left-[25px] size-2.5 rounded-full ring-4 ring-background ${
                        i === 0 ? "bg-primary" : "bg-muted-foreground/40"
                      }`}
                    />
                    <p className="text-sm font-medium">{STATUT_LABELS[h.statut]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(h.date)}</p>
                    {h.note && <p className="mt-0.5 text-sm text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Ligne({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right tabular-nums ${fort ? "font-medium" : ""}`}>{valeur}</span>
    </div>
  );
}
