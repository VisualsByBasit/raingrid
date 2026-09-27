// Everything city-specific lives here. Swapping cities = swapping this file.

export const CITY = {
  name: "Islamabad",
  center: [73.05, 33.69] as [number, number],
  zoom: 11.6,
  bounds: [
    [72.75, 33.45],
    [73.35, 33.85],
  ] as [[number, number], [number, number]],
  // Approximate demo boundary around the Islamabad sector grid. This is used
  // to reject Rawalpindi and other out-of-city roofs; it is not a legal or
  // cadastral boundary.
  authorizedArea: [
    [72.8, 33.58],
    [72.98, 33.58],
    [73.02, 33.62],
    [73.04, 33.643],
    [73.2, 33.65],
    [73.25, 33.82],
    [72.8, 33.82],
  ] as [number, number][],
  facts: [
    {
      stat: "175 mm",
      text: "fell near H-8 on 21 July 2025, Islamabad's heaviest monsoon rain since 2001.",
      source: {
        label: "APP",
        url: "https://www.app.com.pk/national/cda-islamabad-authorities-respond-swiftly-as-record-monsoon-rainfall-hits-capital/",
      },
    },
    {
      stat: "2 to 4 ft",
      text: "a year: how fast groundwater is dropping in some Islamabad sectors (PCRWR, 2023).",
      source: {
        label: "Accountability Lab, citing PCRWR",
        url: "https://pakistan.accountabilitylab.org/groundwater-recharge-reviving-the-hidden-lifeline/",
      },
    },
    {
      stat: "~4 m",
      text: "rise in the local water table from one recharge well at Kachnar Park, I-8, which also cut flood peaks in Nalah Leh.",
      source: { label: "Dawn, Jun 2026", url: "https://www.dawn.com/news/amp/2010706" },
    },
  ],
  whyNow: {
    text: "In March 2026 CDA called for strict compliance with Islamabad's existing rooftop rainwater-harvesting requirement. RAIN//GRID does not wait for enforcement: it shows every household what its own roof can do.",
    source: {
      label: "CDA",
      url: "https://www.cda.gov.pk/cdaImagesGallery/cda-accelerates-water-projects-mandates-rainwater-harvesting-in-islamabad",
    },
  },
};

export const OUT_OF_AUTHORIZED_RANGE = "This RAIN//GRID build covers Islamabad only.";

export function isInAuthorizedCity(lat: number, lng: number): boolean {
  let inside = false;
  const polygon = CITY.authorizedArea;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
