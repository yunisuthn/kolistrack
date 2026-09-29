import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Label + contrôle + message d'erreur/aide. */
export function Champ({
  label,
  htmlFor,
  erreur,
  aide,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  erreur?: string;
  aide?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {erreur ? (
        <p className="text-xs text-destructive">{erreur}</p>
      ) : aide ? (
        <p className="text-xs text-muted-foreground">{aide}</p>
      ) : null}
    </div>
  );
}
