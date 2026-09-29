"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Champ } from "@/components/champ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUT_LABELS, TOUS_STATUTS } from "@/lib/statuts";
import { TRIS } from "./tris";


const TOUS = "tous";
const CLES_FILTRES = ["statut", "application", "transitaire", "du", "au"] as const;

type Option = { id: string; nom: string };

export function FiltresCommandes({ applications, transitaires }: { applications: Option[]; transitaires: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const nbFiltres = CLES_FILTRES.filter((k) => searchParams.get(k)).length;
  const [ouvert, setOuvert] = useState(nbFiltres > 0);

  function maj(changements: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changements)) {
      if (!v || v === TOUS) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Recherche avec un léger délai pendant la frappe
  useEffect(() => {
    const actuel = searchParams.get("q") ?? "";
    if (q.trim() === actuel) return;
    const t = setTimeout(() => maj({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const valeur = (k: string) => searchParams.get(k) ?? TOUS;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Code de suivi ou nom d'article…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant={ouvert ? "secondary" : "outline"} onClick={() => setOuvert(!ouvert)}>
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filtres</span>
          {nbFiltres > 0 && <span className="text-xs">({nbFiltres})</span>}
        </Button>
      </div>

      {ouvert && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 lg:grid-cols-6">
          <Champ label="Statut">
            <Select value={valeur("statut")} onValueChange={(v) => maj({ statut: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Tous</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                {TOUS_STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Application">
            <Select value={valeur("application")} onValueChange={(v) => maj({ application: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Toutes</SelectItem>
                {applications.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Transitaire">
            <Select value={valeur("transitaire")} onValueChange={(v) => maj({ transitaire: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Tous</SelectItem>
                <SelectItem value="aucun">Non défini</SelectItem>
                {transitaires.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Tri">
            <Select value={searchParams.get("tri") ?? "date_desc"} onValueChange={(v) => maj({ tri: v === "date_desc" ? null : v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Du" htmlFor="filtre-du">
            <Input
              id="filtre-du"
              type="date"
              value={searchParams.get("du") ?? ""}
              onChange={(e) => maj({ du: e.target.value })}
            />
          </Champ>
          <Champ label="Au" htmlFor="filtre-au">
            <Input
              id="filtre-au"
              type="date"
              value={searchParams.get("au") ?? ""}
              onChange={(e) => maj({ au: e.target.value })}
            />
          </Champ>
          {(nbFiltres > 0 || searchParams.get("tri")) && (
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2 justify-self-start lg:col-span-6"
              onClick={() => maj({ statut: null, application: null, transitaire: null, du: null, au: null, tri: null })}
            >
              <X /> Réinitialiser les filtres
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
