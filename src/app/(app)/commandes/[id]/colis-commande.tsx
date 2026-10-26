"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSelection } from "@/hooks/use-selection";
import { dec, repartirFraisColis, type BaseRepartitionColis, type DeviseCode } from "@/lib/calculs";
import { formatDevise, formatNombre } from "@/lib/format";
import { marquerColisRecupere } from "../actions";

export type ColisDto = {
  id: string;
  codeSuivi: string;
  poidsKg: string;
  fraisEstime: string;
  fraisReel: string;
  articles: string[];
  /** Vrai si au moins un de ses articles n'est ni récupéré ni annulé */
  aRecuperer: boolean;
};

type Props = {
  commandeId: string;
  colis: ColisDto[];
  /** Articles non annulés sans code de suivi, donc dans aucun colis */
  nbHorsColis: number;
  devise: DeviseCode;
  /** Taux devise → Ar proposé (celui de la commande, sinon du jour) */
  tauxDevise: string;
  aujourdhui: string;
};

const BASE_LABELS: Record<BaseRepartitionColis, string> = {
  POIDS: "au prorata du poids",
  ESTIME: "au prorata des frais estimés (poids incomplets)",
  EGAL: "à parts égales (saisissez les poids pour répartir au poids)",
};

export function ColisCommande({ commandeId, colis, nbHorsColis, devise, tauxDevise, aujourdhui }: Props) {
  const [pending, startTransition] = useTransition();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [recup, setRecup] = useState<{
    colis: (ColisDto & { poidsSaisi: string })[];
    fraisReel: string;
    tauxDeviseTransitaireMga: string;
    dateRecuperation: string;
  } | null>(null);

  const aRecuperer = colis.filter((x) => x.aRecuperer);
  const { choisis, estChoisi, basculer, etatTout, basculerTout, vider } = useSelection(aRecuperer.map((x) => x.id));
  const selection = aRecuperer.filter((x) => choisis.includes(x.id));

  function ouvrir(liste: ColisDto[]) {
    // Total proposé : la somme des montants connus, si chaque colis en a un
    const montants = liste.map((x) => dec(x.fraisReel || x.fraisEstime));
    const total = montants.every((m) => m !== null) ? montants.reduce((acc, m) => acc.add(m!)).toString() : "";
    setErreurs({});
    setRecup({
      colis: liste.map((x) => ({ ...x, poidsSaisi: x.poidsKg })),
      fraisReel: total,
      tauxDeviseTransitaireMga: tauxDevise,
      dateRecuperation: aujourdhui,
    });
  }

  function valider() {
    if (!recup) return;
    const { colis: liste, ...champs } = recup;
    startTransition(async () => {
      const res = await marquerColisRecupere({
        commandeId,
        colis: liste.map((x) => ({ id: x.id, poidsKg: x.poidsSaisi })),
        ...champs,
      });
      if (res.ok) {
        toast.success(liste.length === 1 ? `Colis ${liste[0].codeSuivi} récupéré` : `${liste.length} colis récupérés`);
        vider();
        setRecup(null);
      } else {
        setErreurs(res.erreurs ?? {});
        toast.error(res.erreur ?? "Veuillez corriger le formulaire.");
      }
    });
  }

  const plusieurs = (recup?.colis.length ?? 0) > 1;
  const repartition =
    recup && plusieurs
      ? repartirFraisColis(
          recup.fraisReel,
          recup.colis.map((x) => ({ poidsKg: x.poidsSaisi, fraisEstime: x.fraisEstime })),
        )
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Colis ({colis.length})
          {aRecuperer.length > 1 && (
            <div className="flex items-center gap-3">
              {selection.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => ouvrir(selection)}>
                  <CheckCircle2 /> Récupérés ensemble ({selection.length})
                </Button>
              )}
              <label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <Checkbox checked={etatTout} onCheckedChange={basculerTout} />
                Tout
              </label>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {colis.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun colis : ajoutez un code de suivi aux articles (Modifier) pour saisir les frais de chaque colis.
          </p>
        )}
        {colis.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            {aRecuperer.length > 1 && (
              <Checkbox
                aria-label={`Sélectionner le colis ${x.codeSuivi}`}
                className={x.aRecuperer ? "" : "invisible"}
                disabled={!x.aRecuperer}
                checked={estChoisi(x.id)}
                onCheckedChange={(v) => basculer(x.id, v === true)}
              />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-mono text-sm font-medium">{x.codeSuivi}</p>
              <p className="text-xs text-muted-foreground">{x.articles.join(", ")}</p>
              <p className="text-sm">
                {x.fraisReel ? (
                  <>
                    Frais réels <span className="font-medium tabular-nums">{formatDevise(x.fraisReel, devise)}</span>
                  </>
                ) : x.fraisEstime ? (
                  <>
                    Frais estimés <span className="tabular-nums">{formatDevise(x.fraisEstime, devise)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Frais inconnus</span>
                )}
                {x.poidsKg && <span className="text-muted-foreground"> · {formatNombre(x.poidsKg)} kg</span>}
              </p>
            </div>
            {x.aRecuperer && (
              <Button variant="outline" size="sm" onClick={() => ouvrir([x])}>
                <CheckCircle2 /> Récupéré
              </Button>
            )}
          </div>
        ))}
        {colis.length > 0 && nbHorsColis > 0 && (
          <p className="pt-3 text-xs text-muted-foreground">
            {nbHorsColis} article(s) sans code de suivi : leurs frais transitaire ne sont pas encore comptés.
          </p>
        )}
      </CardContent>

      <Dialog open={recup !== null} onOpenChange={(o) => !o && setRecup(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {plusieurs ? `${recup?.colis.length} colis récupérés ensemble` : `Colis ${recup?.colis[0].codeSuivi} récupéré`}
            </DialogTitle>
            <DialogDescription>
              {plusieurs
                ? "Saisissez le total payé au transitaire pour ces colis : il est réparti entre eux et leurs articles passent « Récupérée »."
                : "Saisissez les frais réels payés au transitaire pour ce colis : ses articles passent « Récupérée »."}
            </DialogDescription>
          </DialogHeader>
          {recup && (
            <div className="space-y-4">
              <Champ
                label={plusieurs ? `Total payé (${devise})` : `Frais réels (${devise})`}
                htmlFor="colis-frais"
                erreur={erreurs.fraisReel}
              >
                <Input
                  id="colis-frais"
                  inputMode="decimal"
                  autoFocus
                  value={recup.fraisReel}
                  onChange={(e) => setRecup({ ...recup, fraisReel: e.target.value })}
                />
              </Champ>
              {devise !== "MGA" && (
                <Champ
                  label={`Taux 1 ${devise} → Ar`}
                  htmlFor="colis-taux"
                  erreur={erreurs.tauxDeviseTransitaireMga}
                  aide={devise === "CNY" ? "Vide = taux de la commande" : "Appliqué à tous les colis de la commande"}
                >
                  <Input
                    id="colis-taux"
                    inputMode="decimal"
                    value={recup.tauxDeviseTransitaireMga}
                    onChange={(e) => setRecup({ ...recup, tauxDeviseTransitaireMga: e.target.value })}
                  />
                </Champ>
              )}
              <div className="space-y-2">
                {recup.colis.map((x, i) => (
                  <Champ
                    key={x.id}
                    label={plusieurs ? <span className="font-mono">{x.codeSuivi}</span> : "Poids (kg)"}
                    htmlFor={`colis-poids-${i}`}
                    erreur={erreurs[`colis.${i}.poidsKg`]}
                  >
                    <div className="flex items-center gap-3">
                      <Input
                        id={`colis-poids-${i}`}
                        inputMode="decimal"
                        placeholder={plusieurs ? "Poids (kg)" : undefined}
                        value={x.poidsSaisi}
                        onChange={(e) =>
                          setRecup({
                            ...recup,
                            colis: recup.colis.map((c, j) => (j === i ? { ...c, poidsSaisi: e.target.value } : c)),
                          })
                        }
                      />
                      {repartition && (
                        <span className="w-32 shrink-0 text-right text-sm tabular-nums">
                          {formatDevise(repartition.parts[i], devise)}
                        </span>
                      )}
                    </div>
                  </Champ>
                ))}
                {repartition && (
                  <p className="text-xs text-muted-foreground">Total réparti {BASE_LABELS[repartition.base]}.</p>
                )}
              </div>
              <Champ label="Date de récupération" htmlFor="colis-date" erreur={erreurs.dateRecuperation}>
                <Input
                  id="colis-date"
                  type="date"
                  value={recup.dateRecuperation}
                  onChange={(e) => setRecup({ ...recup, dateRecuperation: e.target.value })}
                />
              </Champ>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecup(null)}>
              Annuler
            </Button>
            <Button onClick={valider} disabled={pending}>
              {pending ? "Enregistrement…" : "Confirmer la récupération"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
