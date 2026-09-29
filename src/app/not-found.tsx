import Link from "next/link";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <PackageX className="size-12 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Page introuvable</h1>
        <p className="text-muted-foreground">Cette page ou cette commande n&apos;existe pas.</p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Tableau de bord</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/commandes">Mes commandes</Link>
        </Button>
      </div>
    </main>
  );
}
