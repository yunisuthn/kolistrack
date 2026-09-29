"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PointMensuel = {
  cle: string;
  libelle: string;
  court: string;
  valeur: number;
  valeurTexte: string;
};

const HAUTEUR = 176; // px, zone de tracé

export function GraphiqueMensuel({ points }: { points: PointMensuel[] }) {
  const [actif, setActif] = useState<number | null>(null);
  const [vueTableau, setVueTableau] = useState(false);
  const max = Math.max(...points.map((p) => p.valeur), 0);
  const indexMax = max > 0 ? points.findIndex((p) => p.valeur === max) : -1;
  const survole = actif !== null ? points[actif] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {/* Zone d'info-bulle fixe : lisible au doigt comme à la souris */}
        <p className="min-h-5 text-sm" aria-live="polite">
          {survole ? (
            <>
              <span className="text-muted-foreground capitalize">{survole.libelle} : </span>
              <span className="font-medium tabular-nums">{survole.valeurTexte}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Touchez ou survolez une barre</span>
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setVueTableau(!vueTableau)}>
          {vueTableau ? "Graphique" : "Tableau"}
        </Button>
      </div>

      {vueTableau ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">Mois</th>
              <th className="py-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.cle} className="border-t">
                <td className="py-1.5 capitalize">{p.libelle}</td>
                <td className="py-1.5 text-right tabular-nums">{p.valeurTexte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div role="img" aria-label="Total dépensé par mois sur les 12 derniers mois" onMouseLeave={() => setActif(null)}>
          <div className="relative flex items-end gap-0.5 border-b border-border" style={{ height: HAUTEUR }}>
            {points.map((p, i) => {
              const h = max > 0 ? Math.max((p.valeur / max) * (HAUTEUR - 20), p.valeur > 0 ? 2 : 0) : 0;
              return (
                <button
                  key={p.cle}
                  type="button"
                  className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
                  onMouseEnter={() => setActif(i)}
                  onFocus={() => setActif(i)}
                  onClick={() => setActif(i)}
                  aria-label={`${p.libelle} : ${p.valeurTexte}`}
                >
                  {i === indexMax && actif === null && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground tabular-nums"
                      style={{ bottom: h + 4 }}
                    >
                      {p.valeurTexte.replace(" Ar", "")}
                    </span>
                  )}
                  <span
                    className={cn(
                      "w-full max-w-7 rounded-t-[4px] bg-chart-barre transition-opacity",
                      actif !== null && actif !== i && "opacity-40",
                      "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    )}
                    style={{ height: h }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-0.5">
            {points.map((p, i) => (
              <span
                key={p.cle}
                className={cn(
                  "flex-1 text-center text-[10px] text-muted-foreground",
                  // Sur mobile, un mois sur deux (en partant du mois courant) pour éviter les chevauchements
                  (points.length - 1 - i) % 2 === 1 ? "invisible sm:visible" : "",
                )}
              >
                {p.court}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
