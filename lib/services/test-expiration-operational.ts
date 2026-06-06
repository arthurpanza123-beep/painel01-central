export type JsonRecord = Record<string, unknown>

const STICKER_DONE_STATUSES = new Set(['sent', 'already_sent'])
const XCLOUD_DONE_STATUSES = new Set(['removed', 'done', 'success', 'already_removed', 'not_required'])

export function safeMetadata(metadata: JsonRecord | null | undefined): JsonRecord {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

export function metadataString(metadata: JsonRecord, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function metadataObject(metadata: JsonRecord, key: string): JsonRecord {
  const value = metadata[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function statusValue(metadata: JsonRecord, key: string): string {
  return metadataString(metadata, key).trim().toLowerCase()
}

export function isCustomerExpiredStickerSatisfied(metadataInput: JsonRecord | null | undefined): boolean {
  const metadata = safeMetadata(metadataInput)
  return Boolean(metadataString(metadata, 'customer_expired_sticker_sent_at')) ||
    STICKER_DONE_STATUSES.has(statusValue(metadata, 'customer_expired_sticker_status')) ||
    Boolean(metadataString(metadata, 'expired_dispatch_sent_at')) ||
    STICKER_DONE_STATUSES.has(statusValue(metadata, 'expired_dispatch_status'))
}

export function isOperatorExpireActionCompleted(metadataInput: JsonRecord | null | undefined): boolean {
  const metadata = safeMetadata(metadataInput)
  return Boolean(metadataString(metadata, 'operator_expire_action_completed_at')) ||
    statusValue(metadata, 'operator_expire_action_status') === 'completed'
}

export function isXcloudApp(appKey: string | null | undefined, appName: string | null | undefined): boolean {
  return `${appKey || ''} ${appName || ''}`.toLowerCase().includes('xcloud')
}

export function xcloudDeviceKey(input: {
  deviceKey?: string | null
  metadata?: JsonRecord | null
}): string {
  const metadata = safeMetadata(input.metadata)
  return String(input.deviceKey || metadataString(metadata, 'device_key') || '').trim()
}

export function getXcloudRemovalState(input: {
  appKey?: string | null
  appName?: string | null
  deviceKey?: string | null
  metadata?: JsonRecord | null
}): {
  required: boolean
  satisfied: boolean
  removed: boolean
  alreadyRemoved: boolean
  notRequired: boolean
  status: 'removed' | 'already_removed' | 'not_required' | 'failed' | 'pending'
} {
  const metadata = safeMetadata(input.metadata)
  const required = isXcloudApp(input.appKey, input.appName) && Boolean(xcloudDeviceKey({ deviceKey: input.deviceKey, metadata }))
  if (!required) {
    return { required: false, satisfied: true, removed: false, alreadyRemoved: false, notRequired: true, status: 'not_required' }
  }

  const currentStatus = statusValue(metadata, 'xcloud_device_remove_status')
  const legacyStatus = statusValue(metadata, 'expired_xcloud_remove_status')
  const workerMetadata = metadataObject(metadata, 'xcloud_worker')
  const workerRemoved = workerMetadata.device_removed === true
  const hasRemovedAt = Boolean(metadataString(metadata, 'xcloud_device_removed_at')) ||
    (Boolean(metadataString(metadata, 'expired_xcloud_remove_finished_at')) && ['done', 'success', 'removed'].includes(legacyStatus))
  const statusSatisfied = XCLOUD_DONE_STATUSES.has(currentStatus) || ['done', 'success', 'removed'].includes(legacyStatus)
  const alreadyRemoved = currentStatus === 'already_removed'
  const notRequired = currentStatus === 'not_required'
  const removed = Boolean(workerRemoved || hasRemovedAt || currentStatus === 'removed' || currentStatus === 'done' || currentStatus === 'success')
  const satisfied = Boolean(statusSatisfied || workerRemoved || hasRemovedAt)

  if (alreadyRemoved) return { required, satisfied: true, removed: false, alreadyRemoved: true, notRequired: false, status: 'already_removed' }
  if (notRequired) return { required, satisfied: true, removed: false, alreadyRemoved: false, notRequired: true, status: 'not_required' }
  if (removed || satisfied) return { required, satisfied: true, removed: true, alreadyRemoved: false, notRequired: false, status: 'removed' }
  if (currentStatus === 'failed' || legacyStatus === 'failed') return { required, satisfied: false, removed: false, alreadyRemoved: false, notRequired: false, status: 'failed' }
  return { required, satisfied: false, removed: false, alreadyRemoved: false, notRequired: false, status: 'pending' }
}

export function getOperationalExpirationState(input: {
  status?: string | null
  appKey?: string | null
  appName?: string | null
  deviceKey?: string | null
  metadata?: JsonRecord | null
}): {
  customerStickerSatisfied: boolean
  xcloudRemovalSatisfied: boolean
  operatorActionCompleted: boolean
  complete: boolean
  xcloud: ReturnType<typeof getXcloudRemovalState>
} {
  const metadata = safeMetadata(input.metadata)
  const customerStickerSatisfied = isCustomerExpiredStickerSatisfied(metadata)
  const xcloud = getXcloudRemovalState(input)
  const operatorActionCompleted = isOperatorExpireActionCompleted(metadata)
  return {
    customerStickerSatisfied,
    xcloudRemovalSatisfied: xcloud.satisfied,
    operatorActionCompleted,
    complete: customerStickerSatisfied && xcloud.satisfied && operatorActionCompleted,
    xcloud,
  }
}

export function needsOperationalExpirationAction(input: {
  status?: string | null
  appKey?: string | null
  appName?: string | null
  deviceKey?: string | null
  metadata?: JsonRecord | null
}): boolean {
  const status = String(input.status || '').trim().toLowerCase()
  if (!['active', 'generating', 'pending', 'expired'].includes(status)) return false
  return !getOperationalExpirationState(input).complete
}
