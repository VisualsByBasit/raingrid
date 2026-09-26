// Everything city-specific lives here. Swapping cities = swapping this file.

export const CITY = {
  name: "Islamabad",
  center: [73.05, 33.69] as [number, number],
  zoom: 11.6,
  bounds: [
    [72.75, 33.45],
    [73.35, 33.85],
  ] as [[number, number], [number, number]],
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
      text: "rise in the local water table from one recharge well at Kachnar Park, I-8, which also cut flood peaks in Nullah Leh.",
      source: { label: "Dawn, Jun 2026", url: "https://www.dawn.com/news/amp/2010706" },
    },
  ],
  whyNow: {
    text: "In March 2026 CDA made rooftop rainwater harvesting mandatory under its building bylaws. RAIN//GRID does not wait for enforcement: it shows every household what its own roof can do.",
    source: {
      label: "CDA",
      url: "https://www.cda.gov.pk/cdaImagesGallery/cda-accelerates-water-projects-mandates-rainwater-harvesting-in-islamabad",
    },
  },
};
