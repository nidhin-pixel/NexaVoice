export const TEAM_SIZE_OPTIONS = ['1–10', '11–50', '51–200', '201–500', '500+'] as const;

export type TeamSizeOption = (typeof TEAM_SIZE_OPTIONS)[number];

export interface PreCallProspect {
  contactName: string;
  contactEmail: string;
  company: string;
  teamSize: TeamSizeOption;
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function teamSizeBandFromCount(count: number): TeamSizeOption {
  if (count <= 10) return '1–10';
  if (count <= 50) return '11–50';
  if (count <= 200) return '51–200';
  if (count <= 500) return '201–500';
  return '500+';
}
