-- L'ancien code de suivi de la commande n'est plus modifiable : on le vide dès qu'il est porté par
-- un de ses articles, pour qu'un code corrigé sur l'article ne reste pas affiché et trouvé en double.
-- Les articles sans code reprennent d'abord celui de la commande (comme 20260930130000).
UPDATE "Article" a SET "codeSuivi" = c."codeSuivi"
FROM "Commande" c
WHERE c."id" = a."commandeId" AND a."codeSuivi" IS NULL AND c."codeSuivi" IS NOT NULL;

-- Les commandes sans articles détaillés gardent le leur : c'est leur seul code.
UPDATE "Commande" c SET "codeSuivi" = NULL
WHERE c."codeSuivi" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Article" a WHERE a."commandeId" = c."id" AND a."codeSuivi" = c."codeSuivi");
