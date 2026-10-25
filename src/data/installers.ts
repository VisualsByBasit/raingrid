// Certified RainGrid installers. Empty until the pilot installers are
// vetted: the app shows "Pilot installers coming soon". Never add a person
// or business here without their consent and a completed vetting.

export interface Installer {
  id: string;
  name: string;
  trade: string;
  sectors: string[];
  certifiedOn: string; // ISO date
}

export const INSTALLERS: Installer[] = [];
