import type { RainResult } from "@/lib/engine";
import type { ReportTab } from "@/lib/report";
import type { Roof } from "@/lib/roof";
import type { SourceRef } from "@/lib/sources";
import type { Setup } from "../RainGridApp";
import type { QuoteChoice } from "../service/QuoteCard";

// Every roof on the street link, added up for the chosen storm.
export interface Street {
  gross: number;
  tank: number;
  rechargePotential: number;
  drain: number;
  lost: number;
  netLow: number;
  netHigh: number;
  count: number;
  potentialWithWells: number;
}

export interface Rain {
  mm: number;
  label: string;
  where: string;
  km?: number;
  source?: SourceRef;
}

export interface ReportProps {
  tab: ReportTab;
  setTab: (t: ReportTab) => void;
  onClose: () => void;
  roof: Roof;
  roofs: Roof[];
  rain: Rain;
  result: RainResult;
  setup: Setup;
  // Changing the setup in the Report recalculates it (and resets the replay).
  setSetup: (s: Setup) => void;
  street: Street | null;
  onQuoteChoice: (c: QuoteChoice) => void;
  onRequestVisit: () => void;
  onBecomeInstaller: () => void;
  // These leave the Report for the map, and come back to it afterwards.
  onRoofCheck: () => void;
  onAddNeighbours: () => void;
  share: () => void;
  invite: () => void;
  copyReportLink: () => void;
  openSources: () => void;
}
