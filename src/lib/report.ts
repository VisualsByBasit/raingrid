// The Rain Report's sections. Pure, so share links can carry the open
// section (&view=report&tab=money) and tests can check it.

export const REPORT_TABS = ["overview", "water", "money", "street", "install"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export const REPORT_TAB_LABEL: Record<ReportTab, string> = {
  overview: "Overview",
  water: "Water",
  money: "Money",
  street: "Street",
  install: "Get it installed",
};

export const isReportTab = (v: unknown): v is ReportTab => typeof v === "string" && (REPORT_TABS as readonly string[]).includes(v);

// "&view=report&tab=water", or "" when the Report is closed.
export function reportQuery(tab: ReportTab | null): string {
  return tab ? `&view=report&tab=${tab}` : "";
}

// The Report section a URL asks for: null when it doesn't open the Report,
// the Overview when the section is missing or unknown.
export function reportFromSearch(search: string): ReportTab | null {
  const p = new URLSearchParams(search);
  if (p.get("view") !== "report") return null;
  const tab = p.get("tab");
  return isReportTab(tab) ? tab : "overview";
}
