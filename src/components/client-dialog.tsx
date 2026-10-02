"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { enregistrerClient } from "@/app/(app)/parametres/actions";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ClientEdition = { id: string; nom: string; telephone: string; notes: string };

export const CLIENT_VIDE: ClientEdition = { id: "", nom: "", telephone: "", notes: "" };

/** Création / modification d'un client. `client` null = fenêtre fermée. */
export function ClientDialog({
  client,
  onClose,
  onSaved,
}: {
  client: ClientEdition | null;
  onClose: () => void;
  onSaved?: (client: { id: string; nom: string }) => void;
}) {
  return (
    <Dialog open={client !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        {/* Remonté à chaque ouverture : le formulaire repart des valeurs reçues */}
        {client && <Formulaire key={client.id || "nouveau"} initial={client} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulaire({
  initial,
  onClose,
  onSaved,
}: {
  initial: ClientEdition;
  onClose: () => void;
  onSaved?: (client: { id: string; nom: string }) => void;
}) {
  const [edition, setEdition] = useState(initial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function enregistrer() {
    startTransition(async () => {
      const res = await enregistrerClient({ ...edition, id: edition.id || undefined });
      if (res.ok && res.data) {
        toast.success("Client enregistré");
        onSaved?.(res.data);
        onClose();
      } else if (!res.ok) {
        setErreurs(res.erreurs ?? {});
        if (res.erreur) toast.error(res.erreur);
      }
    });
  }

  const set = (champ: keyof ClientEdition) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEdition({ ...edition, [champ]: e.target.value });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{edition.id ? "Modifier le client" : "Nouveau client"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <Champ label="Nom" htmlFor="cl-nom" erreur={erreurs.nom}>
          <Input id="cl-nom" value={edition.nom} onChange={set("nom")} autoFocus />
        </Champ>
        <Champ label="Téléphone" htmlFor="cl-tel" erreur={erreurs.telephone}>
          <Input id="cl-tel" type="tel" value={edition.telephone} onChange={set("telephone")} />
        </Champ>
        <Champ label="Notes" htmlFor="cl-notes" erreur={erreurs.notes}>
          <Textarea id="cl-notes" rows={3} value={edition.notes} onChange={set("notes")} />
        </Champ>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={enregistrer} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </>
  );
}
