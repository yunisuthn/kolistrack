"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Plus, ScanSearch, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LIENS = [
  { href: "/", label: "Tableau de bord", court: "Accueil", icon: LayoutDashboard },
  { href: "/commandes", label: "Commandes", court: "Commandes", icon: List },
  { href: "/commandes/nouvelle", label: "Nouvelle", court: "Nouvelle", icon: Plus },
  { href: "/recherche", label: "Recherche colis", court: "Colis", icon: ScanSearch },
  { href: "/parametres", label: "Paramètres", court: "Réglages", icon: Settings },
];

function estActif(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/commandes") return pathname.startsWith("/commandes") && pathname !== "/commandes/nouvelle";
  return pathname.startsWith(href);
}

export function NavDesktop() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {LIENS.map((lien) => (
        <Link
          key={lien.href}
          href={lien.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
            estActif(pathname, lien.href) ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          {lien.label}
        </Link>
      ))}
    </nav>
  );
}

export function NavMobile() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {LIENS.map((lien) => {
          const actif = estActif(pathname, lien.href);
          const Icon = lien.icon;
          const principal = lien.href === "/commandes/nouvelle";
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                actif ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  principal && "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              {lien.court}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
