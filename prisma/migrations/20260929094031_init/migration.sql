-- CreateEnum
CREATE TYPE "FraisType" AS ENUM ('POURCENTAGE', 'FIXE');

-- CreateEnum
CREATE TYPE "Devise" AS ENUM ('MGA', 'USD', 'CNY');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('COMMANDEE', 'EXPEDIEE_VERS_TRANSITAIRE', 'CHEZ_TRANSITAIRE', 'EN_TRANSIT', 'ARRIVEE', 'RECUPEREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "fraisType" "FraisType" NOT NULL DEFAULT 'POURCENTAGE',
    "fraisValeur" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transitaire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "tarifParKg" DECIMAL(14,4),
    "tarifParM3" DECIMAL(14,4),
    "devise" "Devise" NOT NULL DEFAULT 'MGA',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transitaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "transitaireId" TEXT,
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codeSuivi" TEXT,
    "statut" "StatutCommande" NOT NULL DEFAULT 'COMMANDEE',
    "montantArticlesCny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fraisAppCny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fraisLivraisonCny" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tauxCnyMga" DECIMAL(14,6) NOT NULL,
    "poidsKg" DECIMAL(10,3),
    "volumeM3" DECIMAL(10,4),
    "fraisTransitaireEstime" DECIMAL(14,2),
    "fraisTransitaireReel" DECIMAL(14,2),
    "deviseTransitaire" "Devise" NOT NULL DEFAULT 'MGA',
    "tauxDeviseTransitaireMga" DECIMAL(14,6),
    "dateRecuperation" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "lienProduit" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prixUnitaireCny" DECIMAL(12,2) NOT NULL,
    "image" TEXT,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueStatut" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "statut" "StatutCommande" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "HistoriqueStatut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TauxChange" (
    "id" TEXT NOT NULL,
    "devise" "Devise" NOT NULL,
    "tauxVersMga" DECIMAL(14,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TauxChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_nom_key" ON "Application"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Transitaire_nom_key" ON "Transitaire"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_codeSuivi_key" ON "Commande"("codeSuivi");

-- CreateIndex
CREATE INDEX "Commande_statut_idx" ON "Commande"("statut");

-- CreateIndex
CREATE INDEX "Commande_dateCommande_idx" ON "Commande"("dateCommande");

-- CreateIndex
CREATE INDEX "Commande_applicationId_idx" ON "Commande"("applicationId");

-- CreateIndex
CREATE INDEX "Commande_transitaireId_idx" ON "Commande"("transitaireId");

-- CreateIndex
CREATE INDEX "Article_commandeId_idx" ON "Article"("commandeId");

-- CreateIndex
CREATE INDEX "Article_nom_idx" ON "Article"("nom");

-- CreateIndex
CREATE INDEX "HistoriqueStatut_commandeId_date_idx" ON "HistoriqueStatut"("commandeId", "date");

-- CreateIndex
CREATE INDEX "TauxChange_devise_date_idx" ON "TauxChange"("devise", "date");

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_transitaireId_fkey" FOREIGN KEY ("transitaireId") REFERENCES "Transitaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueStatut" ADD CONSTRAINT "HistoriqueStatut_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
