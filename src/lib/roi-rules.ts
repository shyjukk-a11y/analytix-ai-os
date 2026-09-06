// Deterministic ROI estimation for Phase 5's ROI / Business Cases module.
//
// This is intentionally a transparent, formula-based planning estimate -- never a real financial
// model or an LLM guess. Every number traces back to one of: a reviewer-supplied input (monthly
// case volume, cost per hour), or a fixed, documented per-case time-saved heuristic keyed off the
// opportunity's impact band (the same LOW|MEDIUM|HIGH band already shown on the opportunity, see
// ai-opportunity-rules.ts). `buildAssumptions` spells out the arithmetic in plain English so a
// reviewer never mistakes this for audited analysis.
import type { Band } from './ai-opportunity-rules';

// Minutes saved per case, by the opportunity's impact band. Deliberately conservative and fixed --
// not derived from the specific process -- because Phase 5 has no time-and-motion data to draw on.
export const MINUTES_SAVED_BY_IMPACT: Record<Band, number> = {
  LOW: 10,
  MEDIUM: 25,
  HIGH: 45
};

export function minutesSavedPerCase(impact: string): number {
  const band: Band = impact === 'MEDIUM' || impact === 'HIGH' ? impact : 'LOW';
  return MINUTES_SAVED_BY_IMPACT[band];
}

/** Best-effort guess at a starting monthly volume from the interview's free-text frequency answer
 * (e.g. "about 20 to 25 of these cases every month" -> 20). Falls back to a sensible default when
 * no number can be found -- this is only ever a pre-filled starting point the reviewer can edit
 * before calculating, never used as-is in a stored estimate. */
export function guessMonthlyVolume(frequency: string | null, fallback = 20): number {
  if (!frequency) return fallback;
  const match = frequency.match(/\d+/);
  if (!match) return fallback;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type RoiNumbers = {
  minutesPerCase: number;
  hoursSavedPerMonth: number;
  monthlySavingsEstimate: number;
  annualSavingsEstimate: number;
};

export function calculateRoiNumbers(params: { impact: string; monthlyVolume: number; costPerHour: number }): RoiNumbers {
  const minutesPerCase = minutesSavedPerCase(params.impact);
  const hoursSavedPerMonth = (minutesPerCase * params.monthlyVolume) / 60;
  const monthlySavingsEstimate = hoursSavedPerMonth * params.costPerHour;
  const annualSavingsEstimate = monthlySavingsEstimate * 12;
  return { minutesPerCase, hoursSavedPerMonth, monthlySavingsEstimate, annualSavingsEstimate };
}

export function buildAssumptions(params: {
  impact: string;
  monthlyVolume: number;
  minutesPerCase: number;
  costPerHour: number;
}): string {
  const { impact, monthlyVolume, minutesPerCase, costPerHour } = params;
  const hours = (minutesPerCase * monthlyVolume) / 60;
  return (
    `Based on a ${impact} impact rating, this estimate assumes ${minutesPerCase} minutes saved per case. ` +
    `At ${monthlyVolume} cases/month and a fully-loaded cost of $${costPerHour.toFixed(2)}/hour, that is ` +
    `${hours.toFixed(1)} hours saved per month. ` +
    `This is a planning estimate only, not an audited financial figure -- the per-case minutes-saved figure is a ` +
    `fixed heuristic by impact band, not measured time-and-motion data for this specific process.`
  );
}
