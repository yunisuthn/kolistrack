import { NextResponse } from "next/server";
import { getTauxActuels } from "@/lib/taux";

// Protégée par proxy.ts comme toutes les routes /api
export async function GET() {
  const taux = await getTauxActuels();
  if (!taux) return NextResponse.json({ erreur: "Taux indisponibles" }, { status: 503 });
  return NextResponse.json(taux);
}
