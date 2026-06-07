type JsonRecord = Record<string, unknown>

export type AccountSharingAccount = {
  id: string
  client_id: string | null
  username?: string | null
  status?: string | null
  max_slots?: number | null
  legacy_metadata?: JsonRecord | null
  created_at?: string | null
}

export type AccountSharingSlot = {
  id: string
  account_id: string
  client_id: string | null
  status?: string | null
  assigned_at?: string | null
  slot_number?: number | null
}

function metadata(value: JsonRecord | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizedUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function dateKey(value: string | null | undefined): string {
  return String(value || '')
}

export function isMergedAccount(account: AccountSharingAccount | null | undefined): boolean {
  const source = metadata(account?.legacy_metadata)
  return Boolean(source.merged_into_account_id || source.merged_reason === 'shared_two_screen_account_mirror')
}

export function isOperationalAccount(account: AccountSharingAccount | null | undefined): boolean {
  if (!account || isMergedAccount(account)) return false
  const status = String(account.status || 'active').toLowerCase()
  return status === 'active' || status === 'provisioning'
}

export function isOccupiedSlot(slot: AccountSharingSlot | null | undefined): boolean {
  if (!slot) return false
  return String(slot.status || '').toLowerCase() === 'occupied' || Boolean(slot.client_id)
}

export function isSharedMirrorAccount(
  account: AccountSharingAccount,
  accounts: AccountSharingAccount[],
  slots: AccountSharingSlot[],
): boolean {
  if (!account.client_id || !account.username) return false
  if (slots.some((slot) => slot.account_id === account.id)) return false

  const username = normalizedUsername(account.username)
  if (!username) return false

  return slots.some((slot) => {
    if (slot.client_id !== account.client_id || slot.account_id === account.id || !isOccupiedSlot(slot)) return false
    const slotAccount = accounts.find((item) => item.id === slot.account_id)
    return Boolean(
      slotAccount &&
      isOperationalAccount(slotAccount) &&
      Number(slotAccount.max_slots || 1) >= 2 &&
      normalizedUsername(slotAccount.username) === username
    )
  })
}

export function visibleOperationalAccounts<T extends AccountSharingAccount>(
  accounts: T[],
  slots: AccountSharingSlot[],
): T[] {
  return accounts.filter((account) => (
    isOperationalAccount(account) && !isSharedMirrorAccount(account, accounts, slots)
  ))
}

export function findSlotForClient<T extends AccountSharingSlot>(clientId: string, slots: T[]): T | null {
  return slots
    .filter((slot) => slot.client_id === clientId && isOccupiedSlot(slot))
    .sort((a, b) => dateKey(b.assigned_at).localeCompare(dateKey(a.assigned_at)) || Number(a.slot_number || 0) - Number(b.slot_number || 0))[0] || null
}

export function findAccountForClient<T extends AccountSharingAccount>(
  clientId: string,
  accounts: T[],
  slots: AccountSharingSlot[],
): T | null {
  const slot = findSlotForClient(clientId, slots)
  const slotAccount = slot ? accounts.find((account) => account.id === slot.account_id && isOperationalAccount(account)) : null
  if (slotAccount) return slotAccount

  return accounts
    .filter((account) => account.client_id === clientId && isOperationalAccount(account))
    .filter((account) => !isSharedMirrorAccount(account, accounts, slots))
    .sort((a, b) => dateKey(b.created_at).localeCompare(dateKey(a.created_at)))[0] || null
}
