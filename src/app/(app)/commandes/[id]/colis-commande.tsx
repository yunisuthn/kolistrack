"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DeviseCode } from "@/lib/calculs";
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
  colis: ColisDto[];
  /** Articles non annulés sans code de suivi, donc dans aucun colis */
  nbHorsColis: number;
  devise: DeviseCode;
  /** Taux devise → Ar proposé (celui de la commande, sinon du jour) */
  tauxDevise: string;
  aujourdhui: string;
};

export function ColisCommande({ colis, nbHorsColis, devise, tauxDevise, aujourdhui }: Props) {
  const [pending, startTransition] = useTransition();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [recup, setRecup] = useState<{
    colis: ColisDto;
    fraisReel: string;
    tauxDeviseTransitaireMga: string;
    poidsKg: string;
    dateRecuperation: string;
  } | null>(null);

  function ouvrir(x: ColisDto) {
    setErreurs({});
    setRecup({
      colis: x,
      fraisReel: x.fraisReel || x.fraisEstime,
      tauxDeviseTransitaireMga: tauxDevise,
      poidsKg: x.poidsKg,
      dateRecuperation: aujourdhui,
    });
  }

  function valider() {
    if (!recup) return;
    const { colis: x, ...champs } = recup;
    startTransition(async () => {
      const res = await marquerColisRecupere({ colisId: x.id, ...champs });
      if (res.ok) {
        toast.success(`Colis ${x.codeSuivi} récupéré`);
        setRecup(null);
      } else {
        setErreurs(res.erreurs ?? {});
        toast.error(res.erreur ?? "Veuillez corriger le formulaire.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Colis ({colis.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {colis.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun colis : ajoutez un code de suivi aux articles (Modifier) pour saisir les frais de chaque colis.
          </p>
        )}
        {colis.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
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
              <Button variant="outline" size="sm" onClick={() => ouvrir(x)}>
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
            <DialogTitle>Colis {recup?.colis.codeSuivi} récupéré</DialogTitle>
            <DialogDescription>
              Saisissez les frais réels payés au transitaire pour ce colis : ses articles passent « Récupérée ».
            </DialogDescription>
          </DialogHeader>
          {recup && (
            <div className="space-y-4">
              <Champ label={`Frais réels (${devise})`} htmlFor="colis-frais" erreur={erreurs.fraisReel}>
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
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Poids (kg)" htmlFor="colis-poids" erreur={erreurs.poidsKg}>
                  <Input
                    id="colis-poids"
                    inputMode="decimal"
                    value={recup.poidsKg}
                    onChange={(e) => setRecup({ ...recup, poidsKg: e.target.value })}
                  />
                </Champ>
                <Champ label="Date de récupération" htmlFor="colis-date" erreur={erreurs.dateRecuperation}>
                  <Input
                    id="colis-date"
                    type="date"
                    value={recup.dateRecuperation}
                    onChange={(e) => setRecup({ ...recup, dateRecuperation: e.target.value })}
                  />
                </Champ>
              </div>
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
