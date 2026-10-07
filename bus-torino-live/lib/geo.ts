const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
/** Distanza in linea d'aria in metri (non segue la strada). */
export function distM(a1: number, o1: number, a2: number, o2: number): number {
  const dLa = rad(a2 - a1), dLo = rad(o2 - o1);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
