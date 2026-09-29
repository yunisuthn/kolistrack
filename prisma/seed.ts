import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Valeurs d'exemple : à ajuster dans Paramètres selon vos vraies conditions
const applications = [
  { nom: "Taobao", fraisType: "POURCENTAGE", fraisValeur: "3" },
  { nom: "1688", fraisType: "POURCENTAGE", fraisValeur: "5" },
  { nom: "Pinduoduo", fraisType: "FIXE", fraisValeur: "0" },
  { nom: "AliExpress", fraisType: "FIXE", fraisValeur: "0" },
] as const;

const transitaires = [
  {
    nom: "Transitaire Aérien (exemple)",
    contact: "034 00 000 00",
    tarifParKg: "48000",
    tarifParM3: null,
    devise: "MGA",
    notes: "Fret aérien Guangzhou → Tana, ~10 à 15 jours.",
  },
  {
    nom: "Transitaire Maritime (exemple)",
    contact: "032 00 000 00",
    tarifParKg: null,
    tarifParM3: "380",
    devise: "USD",
    notes: "Groupage maritime, ~45 à 60 jours. Facturé au m³.",
  },
] as const;

async function main() {
  for (const app of applications) {
    await prisma.application.upsert({
      where: { nom: app.nom },
      update: {},
      create: app,
    });
  }
  for (const t of transitaires) {
    await prisma.transitaire.upsert({
      where: { nom: t.nom },
      update: {},
      create: t,
    });
  }
  console.log(`Seed terminé : ${applications.length} applications, ${transitaires.length} transitaires.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
