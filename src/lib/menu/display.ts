/** Short capital words after the first, and words with digits or slashes, are codes such as FIN, NL/BE or 1.CL: they stay as written. */
const CODE = /^[A-Z]{1,3}$|\d|\//;

/**
 * A catalogue name for people. Names written in capitals ("RED ONION FIN") become sentence case ("Red onion FIN"),
 * keeping short codes; names already in mixed case are kept as the wholesaler wrote them.
 */
export function displayName(name: string): string {
  if (/[a-zäöå]/.test(name)) return name;
  // The first word names the product ("RED ONION"), so only later short words are read as codes.
  const words = name.split(/\s+/).filter(Boolean).map((word, at) => (at > 0 && CODE.test(word) ? word : word.toLowerCase()));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
