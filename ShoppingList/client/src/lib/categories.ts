export const categories = {
  frukt: ["äpple", "banan", "apelsin", "päron", "vindruvor", "citron", "lime", "jordgubbar"],
  grönsaker: ["morot", "potatis", "tomat", "lök", "sallad", "gurka", "broccoli"],
  mejeri: ["mjölk", "ost", "yoghurt", "smör", "grädde", "ägg"],
  kött: ["kyckling", "nötkött", "fläsk", "fisk", "lax", "räkor"],
  skafferi: ["ris", "pasta", "bröd", "mjöl", "socker", "salt", "olja"],
  snacks: ["chips", "kakor", "godis", "choklad", "nötter"],
  dryck: ["vatten", "juice", "läsk", "kaffe", "te"],
  hushåll: ["tvål", "papper", "tvättmedel", "soppåsar", "rengöring"],
  övrigt: [],
} as const;

export type Category = keyof typeof categories;

export function categorizeItem(name: string): Category {
  const lowercaseName = name.toLowerCase();

  for (const [category, items] of Object.entries(categories)) {
    if (items.some(item => lowercaseName.includes(item))) {
      return category as Category;
    }
  }

  return "övrigt";
}