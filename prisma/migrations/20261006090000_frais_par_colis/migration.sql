-- CreateEnum
CREATE TYPE "ModeFraisTransitaire" AS ENUM ('COMMANDE', 'COLIS');

-- AlterTable
ALTER TABLE "Transitaire" ADD COLUMN     "modeFrais" "ModeFraisTransitaire" NOT NULL DEFAULT 'COLIS';

-- Les commandes existantes gardent un seul montant transitaire pour toute la commande
-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "modeFraisTransitaire" "ModeFraisTransitaire" NOT NULL DEFAULT 'COMMANDE';

-- CreateTable
CREATE TABLE "Colis" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "codeSuivi" TEXT NOT NULL,
    "poidsKg" DECIMAL(10,3),
    "fraisEstime" DECIMAL(14,2),
    "fraisReel" DECIMAL(14,2),

    CONSTRAINT "Colis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Colis_commandeId_codeSuivi_key" ON "Colis"("commandeId", "codeSuivi");

-- AddForeignKey
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

