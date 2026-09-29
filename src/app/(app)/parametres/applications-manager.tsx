"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Champ } from "@/components/champ";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatCNY } from "@/lib/format";
import { enregistrerApplication, supprimerApplication } from "./actions";

export type ApplicationDto = {
  id: string;
  nom: string;
  fraisType: "POURCENTAGE" | "FIXE";
  fraisValeur: string;
  actif: boolean;
  nbCommandes: number;
};

const VIDE: Omit<ApplicationDto, "nbCommandes"> = {
  id: "",
  nom: "",
  fraisType: "POURCENTAGE",
  fraisValeur: "0",
  actif: true,
};

export function decrireFrais(a: Pick<ApplicationDto, "fraisType" | "fraisValeur">) {
  return a.fraisType === "POURCENTAGE" ? `${a.fraisValeur.replace(".", ",")} %` : formatCNY(a.fraisValeur);
}

export function ApplicationsManager({ applications }: { applications: ApplicationDto[] }) {
  const [edition, setEdition] = useState<Omit<ApplicationDto, "nbCommandes"> | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function ouvrir(app?: ApplicationDto) {
    setErreurs({});
    setEdition(app ? { ...app } : { ...VIDE });
  }

  function enregistrer() {
    if (!edition) return;
    startTransition(async () => {
      const res = await enregistrerApplication({ ...edition, id: edition.id || undefined });
      if (res.ok) {
        toast.success("Application enregistrée");
        setEdition(null);
      } else {
        setErreurs(res.erreurs ?? {});
        if (res.erreur) toast.error(res.erreur);
      }
    });
  }

  function supprimer(app: ApplicationDto) {
    if (!confirm(`Supprimer l'application « ${app.nom} » ?`)) return;
    startTransition(async () => {
      const res = await supprimerApplication(app.id);
      if (res.ok) toast.success("Application supprimée");
      else toast.error(res.erreur ?? "Erreur");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications d&apos;achat</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => ouvrir()}>
            <Plus /> Ajouter
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="divide-y">
        {applications.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune application.</p>
        )}
        {applications.map((app) => (
          <div key={app.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{app.nom}</span>
                {!app.actif && <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                Frais : {decrireFrais(app)} · {app.nbCommandes} commande(s)
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => ouvrir(app)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Supprimer"
              disabled={pending}
              onClick={() => supprimer(app)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edition?.id ? "Modifier l'application" : "Nouvelle application"}</DialogTitle>
          </DialogHeader>
          {edition && (
            <div className="space-y-4">
              <Champ label="Nom" htmlFor="app-nom" erreur={erreurs.nom}>
                <Input
                  id="app-nom"
                  value={edition.nom}
                  onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                />
              </Champ>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Type de frais" erreur={erreurs.fraisType}>
                  <Select
                    value={edition.fraisType}
                    onValueChange={(v) =>
                      setEdition({ ...edition, fraisType: v as ApplicationDto["fraisType"] })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POURCENTAGE">Pourcentage (%)</SelectItem>
                      <SelectItem value="FIXE">Montant fixe (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                </Champ>
                <Champ
                  label={edition.fraisType === "POURCENTAGE" ? "Valeur (%)" : "Valeur (¥)"}
                  htmlFor="app-valeur"
                  erreur={erreurs.fraisValeur}
                >
                  <Input
                    id="app-valeur"
                    inputMode="decimal"
                    value={edition.fraisValeur}
                    onChange={(e) => setEdition({ ...edition, fraisValeur: e.target.value })}
                  />
                </Champ>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={edition.actif}
                  onCheckedChange={(v) => setEdition({ ...edition, actif: v })}
                />
                Active (proposée lors de la création d&apos;une commande)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdition(null)}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
