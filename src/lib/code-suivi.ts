/** Codes de suivi stockés en majuscules sans espaces : unicité et recherche insensibles à la casse. */
export function normaliserCodeSuivi(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}
