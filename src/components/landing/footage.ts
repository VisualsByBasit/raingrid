// Every video clip used on the landing, with its source and licence. Shown
// in the sources drawer under "Footage".

export interface Clip {
  file: string;
  use: string;
  title: string;
  source: string;
  url: string;
  licence: string;
  licenceUrl: string;
}

export const FOOTAGE: Clip[] = [
  {
    file: "/media/hero-clouds.mp4",
    use: "Landing hero",
    title: "Cloudy sky covered with thick clouds moving with the wind",
    source: "Mixkit",
    url: "https://mixkit.co/free-stock-video/cloudy-sky-covered-with-thick-clouds-moving-with-the-wind-21576/",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
  },
];
