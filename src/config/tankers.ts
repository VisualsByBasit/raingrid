// Water tanker prices for the "worth about N tanker loads" comparison.
// Both prices are real reported figures, but a household's actual price
// varies by sector, season and supplier, so the app labels them "estimate".
// Neither source states a tanker size; TANKER_SIZE is an assumption to
// confirm locally. Edit this file to change either.

export interface TankerPreset {
  id: "cda" | "private";
  label: string;
  short: string; // "CDA", "private": reads inside a sentence
  priceRs: number;
  source: { label: string; url: string };
  note: string;
}

export const TANKER_SIZE = {
  litres: 4546, // 1,000 imperial gallons
  label: "1,000 gallons (4,546 L)",
  note: "assumed size, confirm locally",
};

export const TANKER_PRESETS: TankerPreset[] = [
  {
    id: "cda",
    label: "CDA tanker",
    short: "CDA",
    priceRs: 500,
    source: {
      label: "APP, 5 Mar 2025",
      url: "https://www.app.com.pk/domestic/cda-attributed-40-percent-increase-of-water-tanker-price-to-cover-operational-expenses/",
    },
    note: "CDA's price per delivery, raised from Rs 300 to Rs 500",
  },
  {
    id: "private",
    label: "Private tanker",
    short: "private",
    priceRs: 3000,
    source: { label: "Dawn, 19 Jun 2023 (Rawalpindi)", url: "https://www.dawn.com/news/1760503" },
    note: "a resident's reported private tanker price in Rawalpindi",
  },
];
