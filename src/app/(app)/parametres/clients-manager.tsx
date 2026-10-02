"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_VIDE, ClientDialog, type ClientEdition } from "@/components/client-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supprimerClient } from "./actions";

export type ClientDto = ClientEdition & { nbArticles: number };

export function ClientsManager({ clients }: { clients: ClientDto[] }) {
  const [edition, setEdition] = useState<ClientEdition | null>(null);
  const [pending, startTransition] = useTransition();

  function supprimer(c: ClientDto) {
    if (!confirm(`Supprimer le client « ${c.nom} » ?`)) return;
    startTransition(async () => {
      const res = await supprimerClient(c.id);
      if (res.ok) toast.success("Client supprimé");
      else toast.error(res.erreur ?? "Erreur");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clients</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => setEdition({ ...CLIENT_VIDE })}>
            <Plus /> Ajouter
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="divide-y">
        {clients.length === 0 && <p className="text-sm text-muted-foreground">Aucun client.</p>}
        {clients.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.nom}</p>
              <p className="text-sm text-muted-foreground">
                {[c.telephone, `${c.nbArticles} article(s)`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => setEdition(c)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Supprimer"
              disabled={pending}
              onClick={() => supprimer(c)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </CardContent>
      <ClientDialog client={edition} onClose={() => setEdition(null)} />
    </Card>
  );
}
