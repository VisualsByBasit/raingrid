// Islamabad sectors for search. Centres come from a grid fitted to known
// sector landmarks (error under about 1 km), so search flies you to the
// right area, never to an exact address.

const ROW_INDEX: Record<string, number> = { D: -1, E: 0, F: 1, G: 2, H: 3, I: 4 };
const LAT = [33.78974, -0.008157, -0.0153739];
const LNG = [73.169651, -0.0172663, 0.0099421];

const SECTORS: Record<string, number[]> = {
  D: [12, 13],
  E: [7, 11, 12],
  F: [5, 6, 7, 8, 9, 10, 11],
  G: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  H: [8, 9, 10, 11, 12, 13],
  I: [8, 9, 10, 11, 12, 14, 15, 16],
};

export interface Sector {
  id: string; // "F-7"
  lat: number;
  lng: number;
}

export const ALL_SECTORS: Sector[] = Object.entries(SECTORS).flatMap(([row, nums]) =>
  nums.map((n) => {
    const r = ROW_INDEX[row];
    return {
      id: `${row}-${n}`,
      lat: LAT[0] + LAT[1] * n + LAT[2] * r,
      lng: LNG[0] + LNG[1] * n + LNG[2] * r,
    };
  }),
);

// "f7", "F 7", "f-7/2", "F7 markaz" -> "F-7"
export function normalizeSector(q: string): string | null {
  const m = q.trim().toUpperCase().match(/^([DEFGHI])\s*-?\s*(\d{1,2})/);
  return m ? `${m[1]}-${Number(m[2])}` : null;
}

export function searchSectors(q: string, limit = 6): Sector[] {
  const s = q.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return [];
  const exact = normalizeSector(q);
  const hits = ALL_SECTORS.filter((x) => x.id.replace("-", "").startsWith(s.replace("-", "").split("/")[0]));
  if (exact) {
    const e = ALL_SECTORS.find((x) => x.id === exact);
    if (e) return [e, ...hits.filter((h) => h.id !== e.id)].slice(0, limit);
  }
  return hits.slice(0, limit);
}
