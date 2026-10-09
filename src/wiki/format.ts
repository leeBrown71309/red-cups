/** Small text helpers shared by the wiki's written content: amounts and ratios read as the game writes them. */

/** 6000 → « 6 000 » (a plain space, like the rest of the wiki's prose). */
export function formatCoins(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 0.2 → « 20 % ». */
export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}
