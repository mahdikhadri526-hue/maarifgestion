// Liste fixe des opérateurs autorisés (Effectué par / Collaborateur / Visa opérateur).
// La saisie libre n'est pas autorisée — seuls ces noms peuvent être sélectionnés.
export const OPERATORS: string[] = [
  "AZIZ BELHAM",
  "ZAKARIA ORBANE",
  "OMAR NAFAA",
  "HOUSSINE MADIDI",
  "SYOUMI MOHEMMED",
  "MOURAD HANANE",
  "SOUFIANE LAAROUSY",
  "RACHID LAAYOUN",
  "MAAFAR MUSTAPHA",
  "SAID MECHMACHI",
  "SOUFIANE EL ISSAOUI",
  "ABDELHAK RIAHI",
  "BOUCHAIB TOUMI",
  "IBRAHIME NAJIH",
  "YAHYA",
  "YOUSSEF BOUHANA",
  "KHALID MACHTAM",
  "MOHAMMED EL HIYANNI",
  "MOHAMED AQIQI",
  "KHALID TAYBI",
  "JAWAD HADNA",
  "MED ABID",
  "MOUNIR KARTOUBI",
  "ABDEWAHAD BELAAZIZ",
  "Mr Mahdi Khadri",
  "Mr Hamza Fadlou",
];

export function getOperators(): string[] {
  return OPERATORS;
}

// Compat: l'ajout libre n'est plus permis; cette fonction est un no-op.
export function rememberOperator(_name: string): string[] {
  return OPERATORS;
}
