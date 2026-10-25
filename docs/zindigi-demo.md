# RainGrid as a service: Zindigi demo

Written 25 October 2026. Live at https://raingridpk.vercel.app (deploys from `main`).

RAIN//GRID now goes past the calculation: after replaying a storm, a household sees a package and an installed price, can request a free site visit, mark where a tank and downpipe would go, and see indicative instalments via Zindigi. This page explains what runs in **demo mode** today and what to fill in before going live.

## The flow

1. **Calculate.** Pick a roof, replay a recorded storm, then open the Rain Report: Overview, Water (with the system diagram), Money (the tanker comparison), Street and Get it installed.
2. **Get it installed (a Report section).** The engine recommends Basic, Standard or Plus with one 2,000 L tank (two on roofs over 400 m²) and a recharge well for what the storm overflows; more tanks are an optional add (`src/lib/engine/recommend.ts`). The quote is priced line by line from `src/config/packages.ts` (`src/lib/quote.ts`), with 6 and 12 month instalments.
3. **Roof check in 3D.** Orbit the roof, switch on satellite imagery, drag the T (tank spot) and D (downpipe) pins.
4. **Request a free site visit.** A form builds a WhatsApp message with the roof area, quote, recharge add-on, pins and a link back to the roof.
5. **Become a RainGrid installer.** A short application, also by WhatsApp.
6. **Trust.** "How RainGrid works", a yearly maintenance plan and a water-safety explainer, with every number in the sources drawer.

## Demo mode

There is no backend and no stored personal data. Requests are WhatsApp messages that the user sends from their own phone.

- **While `NEXT_PUBLIC_CONTACT_WHATSAPP` is unset** (today), both forms end in a **Demo mode** box that previews the exact message with a Copy button and says it goes live when the team number is added. Nothing is sent anywhere.
- **Once it is set**, the same step shows the message and an **Open WhatsApp** button (`wa.me/<number>?text=...`). WhatsApp opens with the message filled in; nothing is sent until the user presses send.
- **Invite a neighbour** never needs the team number: it opens WhatsApp's contact picker with a pre-filled message.

## Before going live

| What | Where | Notes |
| --- | --- | --- |
| Team WhatsApp number | Vercel → Project → Settings → Environment Variables: `NEXT_PUBLIC_CONTACT_WHATSAPP` | International or local format both work (`+92 300 1234567`, `03001234567`). It is read **at build time**, so redeploy after setting it. Check the live site: the form's last step should say "Open WhatsApp", not "Demo mode". |
| Pilot installers | `src/data/installers.ts` | Empty on purpose ("Pilot installers coming soon"). Add someone only with their consent and after vetting. |
| Prices | `src/config/packages.ts` | Sourced: tanks (watertank.pk 2026), plumber, helper and 4" UPVC pipe (Avenir Developments Q4 2026), UV filter (aquafilter.pk, sale price). Estimates: the gutter / screen / first-flush kit (Rs 10,000 to 30,000), pipe length and labour days. Re-check the sourced prices and replace estimates with real installer quotes once the pilot runs. |
| Tanker comparison | `src/config/tankers.ts` | CDA Rs 500 (APP, 5 Mar 2025) and private Rs 3,000 (Dawn, 19 Jun 2023, Rawalpindi). The 1,000 gallon (4,546 L) size is an assumption to confirm locally. |
| Instalments | `src/lib/quote.ts`, the quote card in the Rain Report | Today: the quote range split evenly, "via Zindigi, indicative", before any financing charges. Replace with Zindigi's actual product terms once agreed, and get their sign-off on the wording and the use of their name. |
| Service margin | `SERVICE_MARGIN` in `src/config/packages.ts` | 15% on parts and labour in every quote and on the maintenance visit, shown as its own line: "RainGrid service: vetting, quality check, warranty (15%)". It is RainGrid's own charge, so it has no source. |
| Maintenance price | `MAINTENANCE` in `src/config/packages.ts` | One plumber day plus one helper day at the Avenir rates (Rs 4,338 to 5,338), plus the 15% service margin: Rs 5,000 to 6,100 a visit. Filter cartridges and the lab water test have no source yet and are "quoted on the visit". |
| Weather card | `src/lib/weather.ts` | Open-Meteo's free API is for non-commercial use. A commercial launch needs their paid plan or another source. |
| Satellite imagery | `MapView.tsx` (`SAT_TILES`, `SAT_CREDIT`) | EOX Sentinel-2 cloudless **2016** layer, CC BY 4.0, attribution in the map and the sources drawer. Do not switch to the 2017+ layers: they are CC BY-NC-SA (non-commercial) without a commercial licence from EOX. Imagery is 10 m per pixel. |
| Privacy note | Request form, share links | Share links and requests carry roof coordinates, and the T/D pins add precise points. The site-visit form says the location and pins are only shared when the user sends the message, the installer form says the same of their details, and the street link says it includes the roof's location. Add a fuller privacy notice before collecting requests at scale. |

## What is not real yet

- No installers are listed or certified.
- No price is a binding quote: every price says it is confirmed on the free site visit.
- Instalments are illustrative arithmetic, not a Zindigi offer.
- Recharge wells are never priced online: suitability depends on soil and depth to groundwater, checked on site.
