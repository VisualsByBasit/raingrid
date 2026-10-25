// Rupee formatting for package prices. Pure, unit tested.

import { ESTIMATE_LABEL, type Price } from "../config/packages";

const rs = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });

// "Rs 15,500 to 27,500", "Rs 17,500", "Rs 482.4 per foot"
export function priceLabel(price: Price | null): string {
  if (!price) return "quote on site visit";
  const amount = price.lowRs === price.highRs ? `Rs ${rs(price.lowRs)}` : `Rs ${rs(price.lowRs)} to ${rs(price.highRs)}`;
  return price.unit ? `${amount} ${price.unit}` : amount;
}

// The same, with the estimate flag spelled out where it applies.
export function priceWithFlag(price: Price | null): string {
  const label = priceLabel(price);
  return price?.estimate ? `${label} (${ESTIMATE_LABEL})` : label;
}
