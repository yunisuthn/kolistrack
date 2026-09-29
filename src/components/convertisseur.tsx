"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { dec } from "@/lib/calculs";
import { formatTaux } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function Convertisseur({ tauxCnyMga }: { tauxCnyMga: string | null }) {
  const [taux, setTaux] = useState(tauxCnyMga ?? "");
  const [cny, setCny] = useState("");
  const [mga, setMga] = useState("");

  function depuisCny(valeur: string, t = taux) {
    setCny(valeur);
    const v = dec(valeur);
    const r = dec(t);
    setMga(v && r ? v.mul(r).toDecimalPlaces(0).toString() : "");
  }

  function depuisMga(valeur: string) {
    setMga(valeur);
    const v = dec(valeur);
    const r = dec(taux);
    setCny(v && r && !r.isZero() ? v.div(r).toDecimalPlaces(2).toString() : "");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Convertisseur CNY ⇄ MGA">
          <ArrowLeftRight className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium">Convertisseur ¥ ⇄ Ar</p>
        <div className="space-y-1.5">
          <Label htmlFor="conv-cny">Yuan (CNY)</Label>
          <Input
            id="conv-cny"
            inputMode="decimal"
            placeholder="0,00"
            value={cny}
            onChange={(e) => depuisCny(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conv-mga">Ariary (MGA)</Label>
          <Input
            id="conv-mga"
            inputMode="decimal"
            placeholder="0"
            value={mga}
            onChange={(e) => depuisMga(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conv-taux" className="text-xs text-muted-foreground">
            Taux utilisé (1 ¥ en Ar){tauxCnyMga ? ` — du jour : ${formatTaux(tauxCnyMga)}` : ""}
          </Label>
          <Input
            id="conv-taux"
            inputMode="decimal"
            value={taux}
            onChange={(e) => {
              setTaux(e.target.value);
              depuisCny(cny, e.target.value);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
