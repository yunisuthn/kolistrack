"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { enregistrerParametres } from "./actions";

export function TauxVenteForm({ tauxVenteCnyMga }: { tauxVenteCnyMga: string }) {
  const [taux, setTaux] = useState(tauxVenteCnyMga);
  const [erreur, setErreur] = useState<string>();
  const [pending, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await enregistrerParametres({ tauxVenteCnyMga: taux });
      if (res.ok) {
        setErreur(undefined);
        toast.success("Taux de vente enregistré");
      } else setErreur(res.erreurs?.tauxVenteCnyMga ?? res.erreur);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <form onSubmit={enregistrer} className="flex items-end gap-2">
          <Champ label="Taux de vente 1 ¥ → Ar" htmlFor="tauxVente" className="flex-1">
            <Input id="tauxVente" inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} />
          </Champ>
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Enregistrer"}
          </Button>
        </form>
        {erreur ? (
          <p className="text-xs text-destructive">{erreur}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Prix client = prix en ¥ × ce taux + sa part des frais au prix coûtant. Les articles déjà enregistrés
            gardent leur taux.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
