// Every image and clip used on the landing, with where it came from. Shown in
// the sources drawer under "Footage".

export interface Clip {
  file: string;
  use: string;
  title: string;
  // Licensed stock: source, link and licence. Made for this project: a note.
  source?: string;
  url?: string;
  licence?: string;
  licenceUrl?: string;
  note?: string;
}

export const FOOTAGE: Clip[] = [
  {
    file: "/media/islamabad-plate.jpg",
    use: "Islamabad background plate",
    title: "Monsoon clouds over the Margalla Hills and Faisal Mosque",
    note: "generated for this project",
  },
  {
    file: "/media/islamabad-depth.png",
    use: "Depth map",
    title: "Hand-tuned depth zones for the plate's parallax",
    note: "built from sky, ridge, city, trees and street zones by scripts/build-hero-assets.mjs, not measured terrain",
  },
];
