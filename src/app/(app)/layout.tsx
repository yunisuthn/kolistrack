import Link from "next/link";
import { Package } from "lucide-react";
import { getTauxActuels } from "@/lib/taux";
import { formatTaux } from "@/lib/format";
import { logout } from "@/app/login/actions";
import { Convertisseur } from "@/components/convertisseur";
import { NavDesktop, NavMobile } from "@/components/navigation";
import { Button } from "@/components/ui/button";

// Toutes les pages protégées lisent la base : rendu à chaque requête
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const taux = await getTauxActuels();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="size-5" />
            <span className="hidden sm:inline">KolisTrack</span>
          </Link>
          <NavDesktop />
          <div className="ml-auto flex items-center gap-2">
            <div
              className="text-right text-xs leading-tight text-muted-foreground"
              title={taux?.perime ? "Taux non mis à jour (API injoignable)" : "Taux du jour"}
            >
              {taux ? (
                <>
                  <div>
                    1 ¥ = <span className="font-medium text-foreground">{formatTaux(taux.CNY)} Ar</span>
                    {taux.perime && " ⚠"}
                  </div>
                  <div className="hidden sm:block">1 $ = {formatTaux(taux.USD)} Ar</div>
                </>
              ) : (
                <span>Taux indisponible</span>
              )}
            </div>
            <Convertisseur tauxCnyMga={taux?.CNY ?? null} />
            <form action={logout} className="hidden md:block">
              <Button variant="ghost" size="sm" type="submit">
                Déconnexion
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:pb-8">{children}</main>
      <NavMobile />
    </div>
  );
}
