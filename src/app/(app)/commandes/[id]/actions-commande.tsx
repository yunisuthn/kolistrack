"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, History, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StatutCommande } from "@/generated/prisma/enums";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUT_LABELS, TOUS_STATUTS } from "@/lib/statuts";
import { changerStatut, marquerRecuperee, supprimerCommande } from "../actions";

type Devise = "MGA" | "USD" | "CNY";

type Props = {
  commandeId: string;
  statut: StatutCommande;
  statutSuivant: StatutCommande | null;
  aujourdhui: string;
  recuperation: {
    /** COLIS : un montant réel par colis à la place du montant de la commande */
    parColis: boolean;
    fraisTransitaireReel: string;
    colis: { id: string; codeSuivi: string; fraisReel: string }[];
    deviseTransitaire: Devise;
    tauxDeviseTransitaireMga: string;
    poidsKg: string;
  };
};

export function ActionsCommande({ commandeId, statut, statutSuivant, aujourdhui, recuperation }: Props) {
  const [pending, startTransition] = useTransition();
  const [dialogStatut, setDialogStatut] = useState(false);
  const [dialogRecup, setDialogRecup] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const [nouveauStatut, setNouveauStatut] = useState<StatutCommande>(statutSuivant ?? statut);
  const [dateStatut, setDateStatut] = useState(aujourdhui);
  const [note, setNote] = useState("");

  const [recup, setRecup] = useState({ ...recuperation, dateRecuperation: aujourdhui, note: "" });

  function ouvrirStatut(s: StatutCommande) {
    setErreurs({});
    setNouveauStatut(s);
    setDateStatut(aujourdhui);
    setNote("");
    setDialogStatut(true);
  }

  function ouvrirRecuperation() {
    setErreurs({});
    setRecup({ ...recuperation, dateRecuperation: aujourdhui, note: "" });
    setDialogRecup(true);
  }

  function validerStatut() {
    if (nouveauStatut === "RECUPEREE") {
      // La récupération passe par le formulaire dédié (frais réels)
      setDialogStatut(false);
      ouvrirRecuperation();
      return;
    }
    startTransition(async () => {
      const res = await changerStatut({ commandeId, statut: nouveauStatut, date: dateStatut, note });
      if (res.ok) {
        toast.success(`Statut : ${STATUT_LABELS[nouveauStatut]}`);
        setDialogStatut(false);
      } else {
        setErreurs(res.erreurs ?? {});
        toast.error(res.erreur ?? "Veuillez corriger le formulaire.");
      }
    });
  }

  function validerRecuperation() {
    startTransition(async () => {
      const { parColis, colis, ...champs } = recup;
      const res = await marquerRecuperee({
        commandeId,
        ...champs,
        ...(parColis
          ? { fraisTransitaireReel: "", poidsKg: "", colis: colis.map(({ id, fraisReel }) => ({ id, fraisReel })) }
          : {}),
      });
      if (res.ok) {
        toast.success("Commande marquée comme récupérée");
        setDialogRecup(false);
      } else {
        setErreurs(res.erreurs ?? {});
        toast.error(res.erreur ?? "Veuillez corriger le formulaire.");
      }
    });
  }

  function supprimer() {
    if (!confirm("Supprimer définitivement cette commande et son historique ?")) return;
    startTransition(() => supprimerCommande(commandeId));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {statutSuivant && statutSuivant !== "RECUPEREE" && (
        <Button onClick={() => ouvrirStatut(statutSuivant)} className="flex-1 sm:flex-none">
          <ArrowRight /> {STATUT_LABELS[statutSuivant]}
        </Button>
      )}
      {statut !== "RECUPEREE" && statut !== "ANNULEE" && (
        <Button
          variant={statutSuivant === "RECUPEREE" ? "default" : "outline"}
          onClick={ouvrirRecuperation}
          className="flex-1 sm:flex-none"
        >
          <CheckCircle2 /> Marquer comme récupérée
        </Button>
      )}
      <Button variant="outline" onClick={() => ouvrirStatut(statutSuivant ?? statut)}>
        <History /> Changer le statut
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Plus d'actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={supprimer} disabled={pending}>
            <Trash2 /> Supprimer la commande
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Changement de statut */}
      <Dialog open={dialogStatut} onOpenChange={setDialogStatut}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
            <DialogDescription>
              S&apos;applique aux articles pas encore à ce stade ; le statut d&apos;un seul article se change
              directement dans la liste des articles. Le changement est ajouté à l&apos;historique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Champ label="Nouveau statut" erreur={erreurs.statut}>
              <Select value={nouveauStatut} onValueChange={(v) => setNouveauStatut(v as StatutCommande)}>
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
            <Champ label="Date" htmlFor="date-statut" erreur={erreurs.date}>
              <Input id="date-statut" type="date" value={dateStatut} onChange={(e) => setDateStatut(e.target.value)} />
            </Champ>
            <Champ label="Note (optionnelle)" htmlFor="note-statut" erreur={erreurs.note}>
              <Textarea id="note-statut" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Champ>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogStatut(false)}>
              Annuler
            </Button>
            <Button onClick={validerStatut} disabled={pending}>
              {nouveauStatut === "RECUPEREE" ? "Continuer" : pending ? "Enregistrement…" : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Récupération */}
      <Dialog open={dialogRecup} onOpenChange={setDialogRecup}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Marquer comme récupérée</DialogTitle>
            <DialogDescription>
              {recup.parColis
                ? "Saisissez les frais réels payés au transitaire pour chaque colis."
                : "Saisissez les frais réels payés au transitaire."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {recup.parColis &&
              recup.colis.map((x, i) => (
                <Champ
                  key={x.id}
                  label={<>Frais réels du colis <span className="font-mono">{x.codeSuivi}</span></>}
                  htmlFor={`recup-colis-${i}`}
                  erreur={erreurs[`colis.${i}.fraisReel`]}
                >
                  <Input
                    id={`recup-colis-${i}`}
                    inputMode="decimal"
                    autoFocus={i === 0}
                    value={x.fraisReel}
                    onChange={(e) =>
                      setRecup({
                        ...recup,
                        colis: recup.colis.map((y, j) => (j === i ? { ...y, fraisReel: e.target.value } : y)),
                      })
                    }
                  />
                </Champ>
              ))}
            <div className={recup.parColis ? "" : "grid grid-cols-[1fr_120px] gap-3"}>
              {!recup.parColis && (
                <Champ label="Frais réels" htmlFor="recup-frais" erreur={erreurs.fraisTransitaireReel}>
                  <Input
                    id="recup-frais"
                    inputMode="decimal"
                    autoFocus
                    value={recup.fraisTransitaireReel}
                    onChange={(e) => setRecup({ ...recup, fraisTransitaireReel: e.target.value })}
                  />
                </Champ>
              )}
              <Champ label="Devise" erreur={erreurs.deviseTransitaire}>
                <Select
                  value={recup.deviseTransitaire}
                  onValueChange={(v) => setRecup({ ...recup, deviseTransitaire: v as Devise })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MGA">MGA</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </Champ>
            </div>
            {recup.deviseTransitaire !== "MGA" && (
              <Champ
                label={`Taux 1 ${recup.deviseTransitaire} → Ar`}
                htmlFor="recup-taux"
                erreur={erreurs.tauxDeviseTransitaireMga}
                aide={recup.deviseTransitaire === "CNY" ? "Vide = taux de la commande" : undefined}
              >
                <Input
                  id="recup-taux"
                  inputMode="decimal"
                  value={recup.tauxDeviseTransitaireMga}
                  onChange={(e) => setRecup({ ...recup, tauxDeviseTransitaireMga: e.target.value })}
                />
              </Champ>
            )}
            <div className="grid grid-cols-2 gap-3">
              {!recup.parColis && (
                <Champ label="Poids (kg)" htmlFor="recup-poids" erreur={erreurs.poidsKg}>
                  <Input
                    id="recup-poids"
                    inputMode="decimal"
                    value={recup.poidsKg}
                    onChange={(e) => setRecup({ ...recup, poidsKg: e.target.value })}
                  />
                </Champ>
              )}
              <Champ label="Date de récupération" htmlFor="recup-date" erreur={erreurs.dateRecuperation}>
                <Input
                  id="recup-date"
                  type="date"
                  value={recup.dateRecuperation}
                  onChange={(e) => setRecup({ ...recup, dateRecuperation: e.target.value })}
                />
              </Champ>
            </div>
            <Champ label="Note (optionnelle)" htmlFor="recup-note" erreur={erreurs.note}>
              <Textarea
                id="recup-note"
                rows={2}
                value={recup.note}
                onChange={(e) => setRecup({ ...recup, note: e.target.value })}
              />
            </Champ>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRecup(false)}>
              Annuler
            </Button>
            <Button onClick={validerRecuperation} disabled={pending}>
              {pending ? "Enregistrement…" : "Confirmer la récupération"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
