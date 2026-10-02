-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "gainMinimumMga" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Parametres" ADD COLUMN     "gainMinimumMga" DECIMAL(14,2) NOT NULL DEFAULT 5000;

-- Les articles à vendre existants prennent le minimum par défaut : 5 000 Ar par unité
UPDATE "Article" SET "gainMinimumMga" = 5000 WHERE "destination" <> 'PERSONNEL';
