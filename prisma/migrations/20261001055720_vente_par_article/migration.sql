-- CreateEnum
CREATE TYPE "DestinationArticle" AS ENUM ('CLIENT', 'STOCK', 'PERSONNEL');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "destination" "DestinationArticle" NOT NULL DEFAULT 'STOCK',
ADD COLUMN     "tauxVenteCnyMga" DECIMAL(14,6);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametres" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tauxVenteCnyMga" DECIMAL(14,6) NOT NULL DEFAULT 900,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_nom_key" ON "Client"("nom");

-- CreateIndex
CREATE INDEX "Article_clientId_idx" ON "Article"("clientId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Réglages par défaut : 900 Ar/¥
INSERT INTO "Parametres" ("id", "tauxVenteCnyMga", "updatedAt") VALUES (1, 900, CURRENT_TIMESTAMP);

-- Les articles existants passent « à vendre » au taux par défaut
UPDATE "Article" SET "tauxVenteCnyMga" = 900;
