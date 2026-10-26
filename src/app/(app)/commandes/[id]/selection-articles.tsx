"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { dec } from "@/lib/calculs";
import { formatTaux } from "@/lib/format";
import { cn } from "@/lib/utils";
import { chercherCommandesCibles, deplacerArticles, type CommandeCibleDto } from "../actions";

type Contexte = ReturnType<typeof useSelection> & { commandeId: string; articleIds: string[]; tauxCnyMga: string };

const SelectionContext = createContext<Contexte | null>(null);

function useContexte() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("À utiliser dans <SelectionArticles>");
  return ctx;
}

/** Sélection d'articles de la commande, pour les déplacer vers une autre commande. */
export function SelectionArticles({
  commandeId,
  articleIds,
  tauxCnyMga,
  children,
}: {
  commandeId: string;
  articleIds: string[];
  /** Taux figé de la commande, comparé à celui de la commande de destination */
  tauxCnyMga: string;
  children: React.ReactNode;
}) {
  const selection = useSelection(articleIds);
  return (
    <SelectionContext.Provider value={{ ...selection, commandeId, articleIds, tauxCnyMga }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function CaseArticle({ articleId, nom }: { articleId: string; nom: string }) {
  const { estChoisi, basculer } = useContexte();
  return (
    <Checkbox
      className="mt-1"
      aria-label={`Sélectionner ${nom}`}
      checked={estChoisi(articleId)}
      onCheckedChange={(v) => basculer(articleId, v === true)}
    />
  );
}

export function BarreSelectionArticles() {
  const { commandeId, articleIds, tauxCnyMga, choisis, etatTout, basculerTout, vider } = useContexte();
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<CommandeCibleDto[] | null>(null);
  const [cible, setCible] = useState<CommandeCibleDto | null>(null);
  const [erreur, setErreur] = useState("");

  // Liste chargée seulement quand la fenêtre est ouverte, puis à chaque recherche
  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    const minuteur = setTimeout(
      async () => {
        const liste = await chercherCommandesCibles(commandeId, recherche);
        if (!annule) setResultats(liste);
      },
      recherche ? 250 : 0,
    );
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [ouvert, recherche, commandeId]);

  if (articleIds.length === 0) return null;
  const nb = choisis.length;
  const autreTaux = cible && !dec(cible.tauxCnyMga)?.eq(dec(tauxCnyMga) ?? 0);

  function ouvrir() {
    setRecherche("");
    setResultats(null);
    setCible(null);
    setErreur("");
    setOuvert(true);
  }

  function valider() {
    if (!cible) return;
    startTransition(async () => {
      const res = await deplacerArticles({ commandeSourceId: commandeId, commandeCibleId: cible.id, articleIds: choisis });
      if (res.ok) {
        toast.success(`${nb} article(s) déplacé(s) vers ${cible.application}`);
        vider();
        setOuvert(false);
      } else {
        setErreur(res.erreur ?? Object.values(res.erreurs ?? {})[0] ?? "Le déplacement a échoué.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {nb > 0 && (
        <Button variant="outline" size="sm" onClick={ouvrir}>
          <ArrowRightLeft /> Déplacer ({nb})
        </Button>
      )}
      <label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
        <Checkbox checked={etatTout} onCheckedChange={basculerTout} />
        Tout
      </label>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Déplacer {nb} article(s)</DialogTitle>
            <DialogDescription>
              Leur colis et leur part des frais déjà payés (application, livraison, transitaire) passent dans la
              commande choisie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              aria-label="Rechercher une commande"
              placeholder="Application, article ou code de suivi…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {resultats === null && <p className="py-2 text-sm text-muted-foreground">Chargement…</p>}
              {resultats?.length === 0 && <p className="py-2 text-sm text-muted-foreground">Aucune commande trouvée.</p>}
              {resultats?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCible(c);
                    setErreur("");
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    cible?.id === c.id && "border-primary bg-muted",
                  )}
                >
                  <span className="font-medium">{c.application}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {c.date} · {c.statut} · {c.nbArticles} article(s)
                  </span>
                </button>
              ))}
            </div>
            {autreTaux && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Taux figé différent : ces articles passeront de {formatTaux(tauxCnyMga)} à {formatTaux(cible.tauxCnyMga)}{" "}
                Ar/元, leur coût de revient changera.
              </p>
            )}
            {erreur && <p className="text-sm text-destructive">{erreur}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={valider} disabled={pending || !cible}>
              {pending ? "Déplacement…" : cible ? `Déplacer vers ${cible.application}` : "Déplacer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
