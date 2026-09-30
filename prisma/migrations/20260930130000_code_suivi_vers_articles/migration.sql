-- Le suivi se fait désormais par article : les articles sans code reprennent celui de leur commande
UPDATE "Article" a SET "codeSuivi" = c."codeSuivi"
FROM "Commande" c
WHERE c."id" = a."commandeId" AND a."codeSuivi" IS NULL AND c."codeSuivi" IS NOT NULL;
