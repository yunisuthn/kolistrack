-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "codeSuivi" TEXT,
ADD COLUMN     "statut" "StatutCommande" NOT NULL DEFAULT 'COMMANDEE';

-- Les articles existants héritent du statut de leur commande
UPDATE "Article" a SET "statut" = c."statut" FROM "Commande" c WHERE c."id" = a."commandeId";

-- CreateIndex
CREATE INDEX "Article_codeSuivi_idx" ON "Article"("codeSuivi");
