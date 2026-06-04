/**
 * lib/services/date-normalizer.ts
 *
 * Normalização e formatação de datas entre os diferentes formatos usados
 * no projeto:
 *
 *   - Mocks usam: "dd/MM/yyyy" e "dd/MM/yyyy HH:mm"
 *   - Supabase retorna: ISO 8601 "yyyy-MM-ddTHH:mm:ssZ"
 *   - Exibição no painel: "dd/MM/yyyy" ou "dd/MM/yyyy às HH:mm"
 *   - dias restantes: número inteiro
 *
 * Estas funções centralizam a conversão para que, ao migrar para o
 * Supabase, apenas o parsing de entrada mude — a exibição continua igual.
 */

/**
 * Converte uma data de qualquer formato suportado para Date.
 * Suporta: "dd/MM/yyyy", "dd/MM/yyyy HH:mm", ISO 8601.
 */
export function toDate(value: string): Date {
  if (!value) return new Date(NaN)

  // ISO 8601 (Supabase)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value)
  }

  // "dd/MM/yyyy HH:mm"
  if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(value)) {
    const [datePart, timePart] = value.split(' ')
    const [d, m, y] = datePart.split('/')
    const [h, min]  = timePart.split(':')
    return new Date(+y, +m - 1, +d, +h, +min)
  }

  // "dd/MM/yyyy"
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/')
    return new Date(+y, +m - 1, +d)
  }

  return new Date(value)
}

/**
 * Formata uma data para exibição no painel: "dd/MM/yyyy"
 */
export function formatDateBR(value: string | Date): string {
  const d = typeof value === 'string' ? toDate(value) : value
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

/**
 * Formata uma data+hora para exibição no painel: "dd/MM/yyyy às HH:mm"
 */
export function formatDateTimeBR(value: string | Date): string {
  const d = typeof value === 'string' ? toDate(value) : value
  if (isNaN(d.getTime())) return '—'
  return (
    d.toLocaleDateString('pt-BR') +
    ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

/**
 * Calcula quantos dias faltam (ou já passaram) entre hoje e a data informada.
 * Retorna negativo se já venceu.
 */
export function daysUntil(value: string | Date): number {
  const d   = typeof value === 'string' ? toDate(value) : value
  if (isNaN(d.getTime())) return 0
  const now = new Date()
  // Zera horário para comparação apenas de dia
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Converte uma data ISO ou BR para o formato ISO 8601 (para salvar no Supabase).
 * MIGRAÇÃO FUTURA: usar ao persistir dados do frontend → banco.
 */
export function toISO(value: string): string {
  const d = toDate(value)
  if (isNaN(d.getTime())) return ''
  return d.toISOString()
}

/**
 * Retorna uma label amigável de tempo relativo.
 * Ex: "há 2 dias", "em 3 dias", "hoje"
 */
export function relativeTime(value: string | Date): string {
  const days = daysUntil(value)
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days === -1) return 'ontem'
  if (days > 0)  return `em ${days} dias`
  return `há ${Math.abs(days)} dias`
}
