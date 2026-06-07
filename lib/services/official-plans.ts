export type PlanDurationKey = 'mensal' | 'trimestral' | 'semestral' | 'anual'
export type ScreensCount = 1 | 2

export type OfficialPlan = {
  key: PlanDurationKey
  label: string
  months: number
  oneScreenCents: number
  twoScreensCents: number
  secondScreenDeltaCents: number
}

export const OFFICIAL_PLANS: OfficialPlan[] = [
  { key: 'mensal', label: 'Mensal', months: 1, oneScreenCents: 2000, twoScreensCents: 3000, secondScreenDeltaCents: 1000 },
  { key: 'trimestral', label: 'Trimestral', months: 3, oneScreenCents: 5000, twoScreensCents: 7500, secondScreenDeltaCents: 2500 },
  { key: 'semestral', label: 'Semestral', months: 6, oneScreenCents: 9000, twoScreensCents: 14000, secondScreenDeltaCents: 5000 },
  { key: 'anual', label: 'Anual', months: 12, oneScreenCents: 15000, twoScreensCents: 22000, secondScreenDeltaCents: 7000 },
]

export const PLAN_MONTHS: Record<PlanDurationKey, number> = OFFICIAL_PLANS.reduce((acc, plan) => {
  acc[plan.key] = plan.months
  return acc
}, {} as Record<PlanDurationKey, number>)

export function normalizePlanKey(value: unknown): PlanDurationKey {
  const key = String(value || 'mensal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return (OFFICIAL_PLANS.find((plan) => key.includes(plan.key))?.key || 'mensal') as PlanDurationKey
}

export function normalizeScreensCount(value: unknown): ScreensCount {
  return Number(value) >= 2 ? 2 : 1
}

export function officialPlan(planKey: unknown, screens: unknown = 1): OfficialPlan & {
  screens: ScreensCount
  amountCents: number
  displayLabel: string
} {
  const key = normalizePlanKey(planKey)
  const selected = OFFICIAL_PLANS.find((plan) => plan.key === key) || OFFICIAL_PLANS[0]
  const screensCount = normalizeScreensCount(screens)
  const amountCents = screensCount === 2 ? selected.twoScreensCents : selected.oneScreenCents
  return {
    ...selected,
    screens: screensCount,
    amountCents,
    displayLabel: `${selected.label} ${screensCount} tela${screensCount > 1 ? 's' : ''}`,
  }
}

export function officialPlanAmountCents(planKey: unknown, screens: unknown = 1): number {
  return officialPlan(planKey, screens).amountCents
}

export function officialPlanLabel(planKey: unknown, screens: unknown = 1): string {
  return officialPlan(planKey, screens).displayLabel
}

export function secondScreenDeltaCents(planKey: unknown): number {
  const key = normalizePlanKey(planKey)
  return (OFFICIAL_PLANS.find((plan) => plan.key === key) || OFFICIAL_PLANS[0]).secondScreenDeltaCents
}

export function formatCurrencyBRLFromCents(cents: number): string {
  return `R$ ${(Math.max(0, cents) / 100).toFixed(2).replace('.', ',')}`
}
