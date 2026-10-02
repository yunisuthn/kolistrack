"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Plus, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { enregistrerCommande } from "@/app/(app)/commandes/actions";
import { Champ } from "@/components/champ";
import { CLIENT_VIDE, ClientDialog } from "@/components/client-dialog";
import { StatutTotalBadge } from "@/components/statut-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  calculerCommande,
  calculerFraisApp,
  estimerFraisTransitaire,
  montantArticlesCny,
  type CoutArticle,
  type DestinationCode,
  type DeviseCode,
} from "@/lib/calculs";
import type { CommandeFormValues, OptionsFormulaire } from "@/lib/commandes";
import { formatCNY, formatDevise, formatMGA, formatTaux } from "@/lib/format";
import { DESTINATION_LABELS, TOUTES_DESTINATIONS } from "@/lib/destinations";
import { STATUT_LABELS, TOUS_STATUTS } from "@/lib/statuts";

type ArticleForm = CommandeFormValues["articles"][number];

let compteurCle = 0;
const NOUVEAU_CLIENT = "__nouveau";

const nouvelArticle = (tauxVente: string): ArticleForm => ({
  cle: `nouveau-${++compteurCle}`,
  nom: "",
  quantite: "1",
  prixUnitaireCny: "",
  codeSuivi: "",
  statut: "COMMANDEE",
  destination: "STOCK",
  clientId: "",
  tauxVenteCnyMga: tauxVente,
});

type Props = {
  options: OptionsFormulaire;
  tauxActuels: { CNY: string; USD: string } | null;
  initial?: CommandeFormValues;
  aujourdhui: string;
};

export function CommandeForm({ options, tauxActuels, initial, aujourdhui }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const [v, setV] = useState<CommandeFormValues>(
    () =>
      initial ?? {
        applicationId: options.applications[0]?.id ?? "",
        transitaireId: "",
        dateCommande: aujourdhui,
        montantArticlesCny: "",
        fraisAppCny: "0",
        fraisLivraisonCny: "0",
        tauxCnyMga: tauxActuels?.CNY ?? "",
        poidsKg: "",
        volumeM3: "",
        fraisTransitaireEstime: "",
        fraisTransitaireReel: "",
        deviseTransitaire: "MGA",
        tauxDeviseTransitaireMga: "",
        dateRecuperation: "",
        notes: "",
        articles: [nouvelArticle(options.tauxVenteDefaut)],
      },
  );

  const [clients, setClients] = useState(options.clients);
  // Index de l'article pour lequel on crée un client (fenêtre ouverte)
  const [clientPourArticle, setClientPourArticle] = useState<number | null>(null);

  const application = options.applications.find((a) => a.id === v.applicationId);
  const transitaire = options.transitaires.find((t) => t.id === v.transitaireId);

  const articlesRemplis = v.articles.filter((a) => a.nom.trim() || a.prixUnitaireCny.trim());
  const montantAuto = articlesRemplis.length > 0;
  const montantArticles = montantAuto ? montantArticlesCny(articlesRemplis).toFixed(2) : v.montantArticlesCny;

  const fraisAppCalcule = application
    ? calculerFraisApp(application.fraisType, application.fraisValeur, montantArticles).toFixed(2)
    : "0";
  // Frais d'application automatiques tant que l'utilisateur ne les a pas modifiés
  const [fraisAppManuel, setFraisAppManuel] = useState(
    () => !!initial && initial.fraisAppCny !== fraisAppCalcule,
  );
  const fraisApp = fraisAppManuel ? v.fraisAppCny : fraisAppCalcule;

  const calcul = calculerCommande(
    {
      montantArticlesCny: montantArticles,
      fraisAppCny: fraisApp,
      fraisLivraisonCny: v.fraisLivraisonCny,
      tauxCnyMga: v.tauxCnyMga,
      fraisTransitaireEstime: v.fraisTransitaireEstime,
      fraisTransitaireReel: v.fraisTransitaireReel,
      deviseTransitaire: v.deviseTransitaire,
      tauxDeviseTransitaireMga: v.tauxDeviseTransitaireMga,
      articles: articlesRemplis.map((a) => ({
        ...a,
        tauxVenteCnyMga: a.tauxVenteCnyMga || options.tauxVenteDefaut,
      })),
    },
    tauxActuels ?? undefined,
  );
  const coutArticle = (a: ArticleForm) => calcul.coutsArticles[articlesRemplis.indexOf(a)];

  const estimationTarif = transitaire
    ? estimerFraisTransitaire(transitaire, v.poidsKg, v.volumeM3)
    : null;

  function maj<K extends keyof CommandeFormValues>(champ: K, valeur: CommandeFormValues[K]) {
    setV((prev) => ({ ...prev, [champ]: valeur }));
  }

  function majArticle<K extends keyof ArticleForm>(index: number, champ: K, valeur: ArticleForm[K]) {
    setV((prev) => ({
      ...prev,
      articles: prev.articles.map((a, i) => (i === index ? { ...a, [champ]: valeur } : a)),
    }));
  }

  function choisirDestination(index: number, destination: DestinationCode) {
    setV((prev) => ({
      ...prev,
      articles: prev.articles.map((a, i) =>
        i === index
          ? {
              ...a,
              destination,
              tauxVenteCnyMga:
                destination !== "PERSONNEL" && !a.tauxVenteCnyMga ? options.tauxVenteDefaut : a.tauxVenteCnyMga,
            }
          : a,
      ),
    }));
  }

  function choisirTransitaire(id: string) {
    const t = options.transitaires.find((x) => x.id === id);
    setV((prev) => ({
      ...prev,
      transitaireId: id === "aucun" ? "" : id,
      deviseTransitaire: t ? t.devise : prev.deviseTransitaire,
      tauxDeviseTransitaireMga:
        t?.devise === "USD" ? (prev.tauxDeviseTransitaireMga || tauxActuels?.USD || "") : prev.tauxDeviseTransitaireMga,
    }));
  }

  function choisirDevise(devise: DeviseCode) {
    setV((prev) => ({
      ...prev,
      deviseTransitaire: devise,
      tauxDeviseTransitaireMga:
        devise === "MGA" ? "" : devise === "USD" ? tauxActuels?.USD ?? "" : prev.tauxCnyMga,
    }));
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const articles = articlesRemplis.map((a) => ({
      nom: a.nom,
      quantite: a.quantite,
      prixUnitaireCny: a.prixUnitaireCny,
      codeSuivi: a.codeSuivi,
      statut: a.statut,
      destination: a.destination,
      clientId: a.clientId,
      tauxVenteCnyMga: a.tauxVenteCnyMga,
    }));
    startTransition(async () => {
      const res = await enregistrerCommande(initial?.id ?? null, {
        ...v,
        montantArticlesCny: montantArticles || "0",
        fraisAppCny: fraisApp || "0",
        fraisLivraisonCny: v.fraisLivraisonCny || "0",
        articles,
      });
      if (res.ok && res.data) {
        toast.success(initial ? "Commande mise à jour" : "Commande créée");
        router.push(`/commandes/${res.data.id}`);
      } else if (!res.ok) {
        // Les erreurs d'articles sont indexées sur la liste filtrée : on les ramène à la liste affichée
        const remap: Record<string, string> = {};
        for (const [cle, msg] of Object.entries(res.erreurs ?? {})) {
          const m = cle.match(/^articles\.(\d+)\.(.+)$/);
          if (m) {
            const indexAffiche = v.articles.indexOf(articlesRemplis[Number(m[1])]);
            remap[`articles.${indexAffiche}.${m[2]}`] = msg;
          } else remap[cle] = msg;
        }
        setErreurs(remap);
        toast.error(res.erreur ?? "Veuillez corriger les champs en erreur.");
      }
    });
  }

  const erreurArticle = (i: number, champ: string) => erreurs[`articles.${i}.${champ}`];

  return (
    <form onSubmit={soumettre} className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-4">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Commande</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ label="Application" erreur={erreurs.applicationId}>
              <Select value={v.applicationId} onValueChange={(x) => maj("applicationId", x)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {options.applications.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Champ>
            <Champ label="Date de commande" htmlFor="dateCommande" erreur={erreurs.dateCommande}>
              <Input
                id="dateCommande"
                type="date"
                value={v.dateCommande}
                onChange={(e) => maj("dateCommande", e.target.value)}
              />
            </Champ>
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader>
            <CardTitle>Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {v.articles.map((a, i) => (
              <div key={a.cle} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <Champ label={`Article ${i + 1}`} htmlFor={`a-nom-${i}`} erreur={erreurArticle(i, "nom")} className="flex-1">
                    <Input
                      id={`a-nom-${i}`}
                      placeholder="Nom de l'article"
                      value={a.nom}
                      onChange={(e) => majArticle(i, "nom", e.target.value)}
                    />
                  </Champ>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6"
                    aria-label="Retirer l'article"
                    onClick={() => maj("articles", v.articles.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Champ label="Qté" htmlFor={`a-qte-${i}`} erreur={erreurArticle(i, "quantite")}>
                    <Input
                      id={`a-qte-${i}`}
                      inputMode="numeric"
                      value={a.quantite}
                      onChange={(e) => majArticle(i, "quantite", e.target.value)}
                    />
                  </Champ>
                  <Champ label="Prix unit. (元)" htmlFor={`a-prix-${i}`} erreur={erreurArticle(i, "prixUnitaireCny")}>
                    <Input
                      id={`a-prix-${i}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={a.prixUnitaireCny}
                      onChange={(e) => majArticle(i, "prixUnitaireCny", e.target.value)}
                    />
                  </Champ>
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium">Total</span>
                    <p className="flex h-9 items-center text-sm tabular-nums">
                      {formatCNY(montantArticlesCny([a]))}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Champ label="Code de suivi" htmlFor={`a-code-${i}`} erreur={erreurArticle(i, "codeSuivi")}>
                    <Input
                      id={`a-code-${i}`}
                      placeholder="Peut être ajouté plus tard"
                      autoCapitalize="characters"
                      className="font-mono"
                      value={a.codeSuivi}
                      onChange={(e) => majArticle(i, "codeSuivi", e.target.value)}
                    />
                  </Champ>
                  <Champ label="Statut" erreur={erreurArticle(i, "statut")}>
                    <Select value={a.statut} onValueChange={(x) => majArticle(i, "statut", x as ArticleForm["statut"])}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOUS_STATUTS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUT_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Champ>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Champ label="Destination" erreur={erreurArticle(i, "destination")}>
                    <Select value={a.destination} onValueChange={(x) => choisirDestination(i, x as DestinationCode)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOUTES_DESTINATIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {DESTINATION_LABELS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Champ>
                  {a.destination === "CLIENT" && (
                    <Champ label="Client" erreur={erreurArticle(i, "clientId")}>
                      <Select
                        value={a.clientId || undefined}
                        onValueChange={(x) =>
                          x === NOUVEAU_CLIENT ? setClientPourArticle(i) : majArticle(i, "clientId", x)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nom}
                            </SelectItem>
                          ))}
                          <SelectItem value={NOUVEAU_CLIENT}>
                            <UserPlus /> Nouveau client…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Champ>
                  )}
                  {a.destination !== "PERSONNEL" && (
                    <Champ
                      label="Taux de vente (Ar/元)"
                      htmlFor={`a-tv-${i}`}
                      erreur={erreurArticle(i, "tauxVenteCnyMga")}
                      aide={
                        a.tauxVenteCnyMga !== options.tauxVenteDefaut
                          ? `Par défaut : ${formatTaux(options.tauxVenteDefaut)}`
                          : undefined
                      }
                    >
                      <Input
                        id={`a-tv-${i}`}
                        inputMode="decimal"
                        value={a.tauxVenteCnyMga}
                        onChange={(e) => majArticle(i, "tauxVenteCnyMga", e.target.value)}
                      />
                    </Champ>
                  )}
                </div>
                <PrixArticle cout={coutArticle(a)} destination={a.destination} />
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={() => maj("articles", [...v.articles, nouvelArticle(options.tauxVenteDefaut)])}>
              <Plus /> Ajouter un article
            </Button>
          </CardContent>
        </Card>

        {/* Montants en CNY */}
        <Card>
          <CardHeader>
            <CardTitle>Montants en yuan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ
              label="Montant des articles (元)"
              htmlFor="montantArticlesCny"
              erreur={erreurs.montantArticlesCny}
              aide={montantAuto ? "Calculé depuis les articles" : "Saisie libre (aucun article détaillé)"}
            >
              <Input
                id="montantArticlesCny"
                inputMode="decimal"
                value={montantArticles}
                readOnly={montantAuto}
                className={montantAuto ? "bg-muted" : undefined}
                onChange={(e) => maj("montantArticlesCny", e.target.value)}
              />
            </Champ>
            <Champ
              label="Frais application (元)"
              htmlFor="fraisAppCny"
              erreur={erreurs.fraisAppCny}
              aide={
                application
                  ? fraisAppManuel
                    ? `Modifié manuellement (calcul auto : ${formatCNY(fraisAppCalcule)})`
                    : `Auto : ${application.fraisType === "POURCENTAGE" ? `${application.fraisValeur} %` : "fixe"}`
                  : undefined
              }
            >
              <div className="flex gap-2">
                <Input
                  id="fraisAppCny"
                  inputMode="decimal"
                  value={fraisApp}
                  onChange={(e) => {
                    setFraisAppManuel(true);
                    maj("fraisAppCny", e.target.value);
                  }}
                />
                {fraisAppManuel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Revenir au calcul automatique"
                    onClick={() => setFraisAppManuel(false)}
                  >
                    <RotateCcw />
                  </Button>
                )}
              </div>
            </Champ>
            <Champ label="Livraison en Chine (元)" htmlFor="fraisLivraisonCny" erreur={erreurs.fraisLivraisonCny}>
              <Input
                id="fraisLivraisonCny"
                inputMode="decimal"
                value={v.fraisLivraisonCny}
                onChange={(e) => maj("fraisLivraisonCny", e.target.value)}
              />
            </Champ>
            <Champ
              label="Taux 1 元 → Ar (figé)"
              htmlFor="tauxCnyMga"
              erreur={erreurs.tauxCnyMga}
              aide={tauxActuels ? `Taux du jour : ${formatTaux(tauxActuels.CNY)}` : "Taux du jour indisponible"}
            >
              <div className="flex gap-2">
                <Input
                  id="tauxCnyMga"
                  inputMode="decimal"
                  value={v.tauxCnyMga}
                  onChange={(e) => maj("tauxCnyMga", e.target.value)}
                />
                {tauxActuels && v.tauxCnyMga !== tauxActuels.CNY && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Utiliser le taux du jour"
                    onClick={() => maj("tauxCnyMga", tauxActuels.CNY)}
                  >
                    <RotateCcw />
                  </Button>
                )}
              </div>
            </Champ>
          </CardContent>
        </Card>

        {/* Transitaire */}
        <Card>
          <CardHeader>
            <CardTitle>Transitaire</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ label="Transitaire" erreur={erreurs.transitaireId}>
              <Select value={v.transitaireId || "aucun"} onValueChange={choisirTransitaire}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aucun">— Non défini —</SelectItem>
                  {options.transitaires.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Champ>
            <Champ label="Devise des frais transitaire" erreur={erreurs.deviseTransitaire}>
              <Select value={v.deviseTransitaire} onValueChange={(x) => choisirDevise(x as DeviseCode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MGA">Ariary (MGA)</SelectItem>
                  <SelectItem value="USD">Dollar (USD)</SelectItem>
                  <SelectItem value="CNY">Yuan (CNY)</SelectItem>
                </SelectContent>
              </Select>
            </Champ>
            <Champ label="Poids (kg)" htmlFor="poidsKg" erreur={erreurs.poidsKg}>
              <Input id="poidsKg" inputMode="decimal" value={v.poidsKg} onChange={(e) => maj("poidsKg", e.target.value)} />
            </Champ>
            <Champ label="Volume (m³)" htmlFor="volumeM3" erreur={erreurs.volumeM3}>
              <Input id="volumeM3" inputMode="decimal" value={v.volumeM3} onChange={(e) => maj("volumeM3", e.target.value)} />
            </Champ>
            <Champ
              label={`Frais estimés (${v.deviseTransitaire})`}
              htmlFor="fraisTransitaireEstime"
              erreur={erreurs.fraisTransitaireEstime}
              aide={
                estimationTarif && transitaire
                  ? transitaire.devise === v.deviseTransitaire
                    ? `D'après le tarif : ${formatDevise(estimationTarif, transitaire.devise)}`
                    : `Tarif en ${transitaire.devise} ≠ devise choisie`
                  : "Laisser vide si inconnu"
              }
            >
              <div className="flex gap-2">
                <Input
                  id="fraisTransitaireEstime"
                  inputMode="decimal"
                  value={v.fraisTransitaireEstime}
                  onChange={(e) => maj("fraisTransitaireEstime", e.target.value)}
                />
                {estimationTarif && transitaire?.devise === v.deviseTransitaire && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Utiliser l'estimation du tarif"
                    onClick={() => maj("fraisTransitaireEstime", estimationTarif.toFixed(2))}
                  >
                    <Calculator />
                  </Button>
                )}
              </div>
            </Champ>
            <Champ
              label={`Frais réels (${v.deviseTransitaire})`}
              htmlFor="fraisTransitaireReel"
              erreur={erreurs.fraisTransitaireReel}
              aide="À saisir lors de la récupération"
            >
              <Input
                id="fraisTransitaireReel"
                inputMode="decimal"
                value={v.fraisTransitaireReel}
                onChange={(e) => maj("fraisTransitaireReel", e.target.value)}
              />
            </Champ>
            {v.deviseTransitaire !== "MGA" && (
              <Champ
                label={`Taux 1 ${v.deviseTransitaire} → Ar`}
                htmlFor="tauxDeviseTransitaireMga"
                erreur={erreurs.tauxDeviseTransitaireMga}
                aide={
                  v.deviseTransitaire === "USD" && tauxActuels
                    ? `Taux du jour : ${formatTaux(tauxActuels.USD)}`
                    : "Vide = taux de la commande"
                }
              >
                <Input
                  id="tauxDeviseTransitaireMga"
                  inputMode="decimal"
                  value={v.tauxDeviseTransitaireMga}
                  onChange={(e) => maj("tauxDeviseTransitaireMga", e.target.value)}
                />
              </Champ>
            )}
            {initial && (
              <Champ label="Date de récupération" htmlFor="dateRecuperation" erreur={erreurs.dateRecuperation}>
                <Input
                  id="dateRecuperation"
                  type="date"
                  value={v.dateRecuperation}
                  onChange={(e) => maj("dateRecuperation", e.target.value)}
                />
              </Champ>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Champ label="Notes" htmlFor="notes" erreur={erreurs.notes}>
              <Textarea id="notes" rows={3} value={v.notes} onChange={(e) => maj("notes", e.target.value)} />
            </Champ>
          </CardContent>
        </Card>
      </div>

      {/* Récapitulatif en direct */}
      <Card className="lg:sticky lg:top-18">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Récapitulatif <StatutTotalBadge statut={calcul.statutTotal} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Ligne label="Articles" valeur={formatCNY(montantArticles || "0")} />
          <Ligne label="Frais application" valeur={formatCNY(fraisApp || "0")} />
          <Ligne label="Livraison Chine" valeur={formatCNY(v.fraisLivraisonCny || "0")} />
          <Separator />
          <Ligne label="Sous-total" valeur={formatCNY(calcul.sousTotalCny)} fort />
          <Ligne label="Sous-total en Ar" valeur={formatMGA(calcul.sousTotalMga)} />
          <Ligne
            label="Frais transitaire"
            valeur={calcul.fraisTransitaireMga ? formatMGA(calcul.fraisTransitaireMga) : "inconnus"}
          />
          <Separator />
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">Coût total</span>
            <span className="text-lg font-semibold tabular-nums">{formatMGA(calcul.coutTotalMga)}</span>
          </div>
          {articlesRemplis.length > 0 && (
            <>
              <Separator />
              {calcul.ventes.clientsMga.gt(0) && (
                <Ligne label="À facturer aux clients" valeur={formatMGA(calcul.ventes.clientsMga)} />
              )}
              {calcul.ventes.stockMga.gt(0) && (
                <Ligne label="Stock à vendre" valeur={formatMGA(calcul.ventes.stockMga)} />
              )}
              {calcul.ventes.personnelMga.gt(0) && (
                <Ligne label="Pour moi (coût)" valeur={formatMGA(calcul.ventes.personnelMga)} />
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">Gain prévu</span>
                <span className="font-semibold text-green-700 tabular-nums dark:text-green-400">
                  {formatMGA(calcul.ventes.margeMga)}
                </span>
              </div>
            </>
          )}
          <Button type="submit" className="mt-2 w-full" disabled={pending}>
            {pending ? "Enregistrement…" : initial ? "Enregistrer les modifications" : "Créer la commande"}
          </Button>
          {initial && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => router.back()}>
              Annuler
            </Button>
          )}
        </CardContent>
      </Card>
      <ClientDialog
        client={clientPourArticle !== null ? { ...CLIENT_VIDE } : null}
        onClose={() => setClientPourArticle(null)}
        onSaved={(c) => {
          setClients((prev) => [...prev, c].sort((x, y) => x.nom.localeCompare(y.nom)));
          if (clientPourArticle !== null) majArticle(clientPourArticle, "clientId", c.id);
        }}
      />
    </form>
  );
}

/** Coût, prix client et gain d'un article, calculés en direct. */
function PrixArticle({ cout, destination }: { cout?: CoutArticle; destination: DestinationCode }) {
  if (!cout || cout.totalLigneCny.isZero()) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Coût {formatMGA(cout.coutRevientLigneMga)}
      {cout.prixVenteLigneMga && destination !== "PERSONNEL" && (
        <>
          {" · "}
          {destination === "CLIENT" ? "Prix client" : "Prix de vente"}{" "}
          <span className="font-medium text-foreground tabular-nums">{formatMGA(cout.prixVenteLigneMga)}</span>
          {" · "}gain{" "}
          <span className="text-green-700 tabular-nums dark:text-green-400">
            {formatMGA(cout.margeLigneMga)}
          </span>
        </>
      )}
    </p>
  );
}

function Ligne({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={fort ? "font-medium tabular-nums" : "tabular-nums"}>{valeur}</span>
    </div>
  );
}
