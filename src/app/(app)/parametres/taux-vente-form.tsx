"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { enregistrerParametres } from "./actions";

type Props = { tauxVenteCnyMga: string; gainMinimumMga: string };

export function TauxVenteForm(initial: Props) {
  const [v, setV] = useState(initial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await enregistrerParametres(v);
      if (res.ok) {
        setErreurs({});
        toast.success("Réglages de vente enregistrés");
      } else {
        setErreurs(res.erreurs ?? {});
        if (res.erreur) toast.error(res.erreur);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enregistrer} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Taux de vente 1 元 → Ar" htmlFor="tauxVente" erreur={erreurs.tauxVenteCnyMga}>
              <Input
                id="tauxVente"
                inputMode="decimal"
                value={v.tauxVenteCnyMga}
                onChange={(e) => setV({ ...v, tauxVenteCnyMga: e.target.value })}
              />
            </Champ>
            <Champ label="Gain minimum par unité (Ar)" htmlFor="gainMinimum" erreur={erreurs.gainMinimumMga}>
              <Input
                id="gainMinimum"
                inputMode="decimal"
                value={v.gainMinimumMga}
                onChange={(e) => setV({ ...v, gainMinimumMga: e.target.value })}
              />
            </Champ>
          </div>
          <p className="text-xs text-muted-foreground">
            Prix client = prix en 元 × ce taux + sa part des frais au prix coûtant, relevé si besoin pour
            rapporter au moins le gain minimum par unité. Les articles déjà enregistrés gardent leurs réglages.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
