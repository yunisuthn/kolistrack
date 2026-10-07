"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ModeFraisCode } from "@/lib/calculs";
import { formatDevise } from "@/lib/format";
import { MODE_FRAIS_LABELS, TOUS_MODES_FRAIS } from "@/lib/modes-frais";
import { enregistrerTransitaire, supprimerTransitaire } from "./actions";

export type TransitaireDto = {
  id: string;
  nom: string;
  contact: string;
  tarifParKg: string;
  tarifParM3: string;
  devise: "MGA" | "USD" | "CNY";
  modeFrais: ModeFraisCode;
  notes: string;
  nbCommandes: number;
};

const VIDE: Omit<TransitaireDto, "nbCommandes"> = {
  id: "",
  nom: "",
  contact: "",
  tarifParKg: "",
  tarifParM3: "",
  devise: "MGA",
  modeFrais: "COLIS",
  notes: "",
};

export function TransitairesManager({ transitaires }: { transitaires: TransitaireDto[] }) {
  const [edition, setEdition] = useState<Omit<TransitaireDto, "nbCommandes"> | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function ouvrir(t?: TransitaireDto) {
    setErreurs({});
    setEdition(t ? { ...t } : { ...VIDE });
  }

  function enregistrer() {
    if (!edition) return;
    startTransition(async () => {
      const res = await enregistrerTransitaire({ ...edition, id: edition.id || undefined });
      if (res.ok) {
        toast.success("Transitaire enregistré");
        setEdition(null);
      } else {
        setErreurs(res.erreurs ?? {});
        if (res.erreur) toast.error(res.erreur);
      }
    });
  }

  function supprimer(t: TransitaireDto) {
    if (!confirm(`Supprimer le transitaire « ${t.nom} » ?`)) return;
    startTransition(async () => {
      const res = await supprimerTransitaire(t.id);
      if (res.ok) toast.success("Transitaire supprimé");
      else toast.error(res.erreur ?? "Erreur");
    });
  }

  const set = (champ: keyof typeof VIDE) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    edition && setEdition({ ...edition, [champ]: e.target.value });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transitaires</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => ouvrir()}>
            <Plus /> Ajouter
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="divide-y">
        {transitaires.length === 0 && <p className="text-sm text-muted-foreground">Aucun transitaire.</p>}
        {transitaires.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.nom}</p>
              <p className="text-sm text-muted-foreground">
                {[
                  t.tarifParKg && `${formatDevise(t.tarifParKg, t.devise)}/kg`,
                  t.tarifParM3 && `${formatDevise(t.tarifParM3, t.devise)}/m³`,
                  !t.tarifParKg && !t.tarifParM3 && `Tarif non renseigné (${t.devise})`,
                  t.modeFrais === "COLIS" ? "frais par colis" : "frais par commande",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {t.contact && <p className="text-xs text-muted-foreground">{t.contact}</p>}
            </div>
            <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => ouvrir(t)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Supprimer"
              disabled={pending}
              onClick={() => supprimer(t)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edition?.id ? "Modifier le transitaire" : "Nouveau transitaire"}</DialogTitle>
          </DialogHeader>
          {edition && (
            <div className="space-y-4">
              <Champ label="Nom" htmlFor="tr-nom" erreur={erreurs.nom}>
                <Input id="tr-nom" value={edition.nom} onChange={set("nom")} />
              </Champ>
              <Champ label="Contact" htmlFor="tr-contact" erreur={erreurs.contact}>
                <Input id="tr-contact" value={edition.contact} onChange={set("contact")} />
              </Champ>
              <Champ label="Devise des tarifs" erreur={erreurs.devise}>
                <Select
                  value={edition.devise}
                  onValueChange={(v) => setEdition({ ...edition, devise: v as TransitaireDto["devise"] })}
                >
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
              <Champ
                label="Frais facturés"
                erreur={erreurs.modeFrais}
                aide="Repris sur chaque nouvelle commande, modifiable sur la commande"
              >
                <Select
                  value={edition.modeFrais}
                  onValueChange={(v) => setEdition({ ...edition, modeFrais: v as ModeFraisCode })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOUS_MODES_FRAIS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MODE_FRAIS_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Champ>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Tarif par kg" htmlFor="tr-kg" erreur={erreurs.tarifParKg}>
                  <Input id="tr-kg" inputMode="decimal" value={edition.tarifParKg} onChange={set("tarifParKg")} />
                </Champ>
                <Champ label="Tarif par m³" htmlFor="tr-m3" erreur={erreurs.tarifParM3}>
                  <Input id="tr-m3" inputMode="decimal" value={edition.tarifParM3} onChange={set("tarifParM3")} />
                </Champ>
              </div>
              <Champ label="Notes" htmlFor="tr-notes" erreur={erreurs.notes}>
                <Textarea id="tr-notes" rows={3} value={edition.notes} onChange={set("notes")} />
              </Champ>
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
