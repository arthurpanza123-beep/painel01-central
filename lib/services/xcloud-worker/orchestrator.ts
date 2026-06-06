import path from 'node:path'

import { maskDeviceKey, maskPassword, maskSensitiveText, maskUrl, maskUsername } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { getXcloudPage, runXcloudExclusive } from './browser'
import { saveXcloudScreenshot } from './screenshots'
import { addXcloudDevice } from './steps/add-device'
import { attachXtreamCredentials } from './steps/attach-xtream'
import { deactivateXcloudDevice, deleteXcloudDevice, findXcloudDevice } from './steps/recreate-device'
import type { XcloudDeviceReadiness, XcloudResolvedTest, XcloudWorkerConfig, XcloudWorkerInput, XcloudWorkerResult, XcloudWorkerStage } from './types'

type JsonRecord = Record<string, unknown>

class XcloudWorkerError extends Error {
  status: number
  code: string
  stage: XcloudWorkerStage
  screenshotPath?: string | null

  constructor(status: number, code: string, message: string, stage: XcloudWorkerStage) {
    super(message)
    this.status = status
    this.code = code
    this.stage = stage
  }
}

function db() {
  const client = getSupabaseServerClient()
  if (!client) throw new XcloudWorkerError(500, 'SUPABASE_NOT_CONFIGURED', 'Supabase server env ausente.', 'GenerateAccess')
  return client
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return /^(1|true|yes|on)$/i.test(value)
}

function numEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function config(): XcloudWorkerConfig {
  return {
    enabled: boolEnv(process.env.XCLOUD_WORKER_ENABLED, false),
    mode: process.env.XCLOUD_WORKER_MODE === 'real' ? 'real' : 'mock',
    panelUrl: String(process.env.XCLOUD_PANEL_URL || '').trim(),
    devicesUrl: String(process.env.XCLOUD_DEVICES_URL || '').trim(),
    customPlaylistUrl: String(process.env.XCLOUD_CUSTOM_PLAYLIST_URL || '').trim(),
    email: String(process.env.XCLOUD_EMAIL || '').trim(),
    password: String(process.env.XCLOUD_PASSWORD || '').trim(),
    profileDir: String(process.env.XCLOUD_PROFILE_DIR || path.join(process.cwd(), '.xcloud-profile')).trim(),
    screenshotsDir: String(process.env.XCLOUD_WORKER_SCREENSHOTS_DIR || 'storage/screenshots').trim(),
    maxRetries: Math.max(numEnv(process.env.XCLOUD_WORKER_MAX_RETRIES, 2), 0),
    headless: boolEnv(process.env.XCLOUD_HEADLESS || process.env.HEADLESS, true),
    slowMoMs: Math.max(numEnv(process.env.XCLOUD_SLOW_MO_MS || process.env.SLOW_MO_MS, 0), 0),
    pageTimeoutMs: Math.max(numEnv(process.env.XCLOUD_PAGE_TIMEOUT_MS, 30000), 3000),
  }
}

function metadataValue(metadata: JsonRecord, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value.trim() : ''
}

function technicalMetadata(metadata: JsonRecord): JsonRecord {
  const technical = metadata.technical_connection
  return technical && typeof technical === 'object' && !Array.isArray(technical) ? technical as JsonRecord : {}
}

function safeMetadata(metadata: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(metadata, (key, value: unknown) => {
    if (typeof value !== 'string') return value
    if (/password|senha/i.test(key)) return maskPassword(value)
    if (/username|usuario|user/i.test(key)) return maskUsername(value)
    if (/device/i.test(key)) return maskDeviceKey(value)
    if (/url|m3u|hls|token|cookie/i.test(key)) return maskUrl(value)
    return maskSensitiveText(value)
  })) as JsonRecord
}

async function writeLog(event: string, level: 'info' | 'warning' | 'error' | 'success', payload: {
  client_id?: string | null
  test_id?: string | null
  message?: string
  metadata?: JsonRecord
}): Promise<string | null> {
  const database = db()
  const { data, error } = await database.from('logs').insert({
    scope: 'xcloud_worker',
    level,
    event,
    client_id: payload.client_id || null,
    test_id: payload.test_id || null,
    account_id: null,
    message: maskSensitiveText(payload.message || event).slice(0, 800),
    metadata: safeMetadata(payload.metadata || {}),
  }).select('id').single()
  if (error) throw new XcloudWorkerError(500, 'XCLOUD_LOG_FAILED', error.message, 'GenerateAccess')
  return (data as { id: string } | null)?.id || null
}

async function writeDeviceReadinessLogs(test: XcloudResolvedTest, readiness: XcloudDeviceReadiness | undefined) {
  if (!readiness) return
  await writeLog('XCLOUD_DEVICE_LIST_REFRESHED', 'info', {
    client_id: test.client_id,
    test_id: test.test_id,
    message: 'Lista Devices atualizada para validar device.',
    metadata: { device_key: test.device_key },
  })
  await writeLog('XCLOUD_DEVICE_ROW_FOUND', 'success', {
    client_id: test.client_id,
    test_id: test.test_id,
    message: 'Linha da device localizada na lista.',
    metadata: { device_key: test.device_key, row_found: readiness.row_found, app_name: readiness.app_name || null },
  })
  if (readiness.status_active) {
    await writeLog('XCLOUD_DEVICE_STATUS_ACTIVE_CONFIRMED', 'success', {
      client_id: test.client_id,
      test_id: test.test_id,
      message: 'Status Active confirmado na device.',
      metadata: { status_text: readiness.status_text || null },
    })
  }
  if (readiness.playlist_empty) {
    await writeLog('XCLOUD_DEVICE_PLAYLIST_EMPTY_CONFIRMED', 'success', {
      client_id: test.client_id,
      test_id: test.test_id,
      message: 'Playlist vazia/N/A confirmada antes do Xtream.',
      metadata: { playlist_text: readiness.playlist_text || null },
    })
  }
  if (readiness.own_playlist_confirmed) {
    await writeLog('XCLOUD_DEVICE_OWN_PLAYLIST_CONFIRMED', 'success', {
      client_id: test.client_id,
      test_id: test.test_id,
      message: 'Own playlist confirmado na device.',
      metadata: { own_playlist_confirmed: true },
    })
  }
  await writeLog('XCLOUD_DEVICE_READY_FOR_XTREAM', 'success', {
    client_id: test.client_id,
    test_id: test.test_id,
    message: 'Device pronta para vincular Xtream.',
    metadata: {
      device_key: test.device_key,
      status_active: readiness.status_active,
      playlist_empty: readiness.playlist_empty,
      own_playlist_confirmed: readiness.own_playlist_confirmed,
      app_name_confirmed: readiness.app_name_confirmed,
    },
  })
}

async function createPipelineEvent(test: XcloudResolvedTest, eventType: string, payload: JsonRecord, operatorRef?: string | null) {
  if (!test.test_id) return
  const database = db()
  const { error } = await database.from('pipeline_events').insert({
    entity_type: 'test',
    entity_id: test.test_id,
    event_type: eventType,
    from_status: null,
    to_status: null,
    operator_ref: operatorRef || null,
    payload: safeMetadata(payload),
  })
  if (error) throw new XcloudWorkerError(500, 'XCLOUD_PIPELINE_EVENT_FAILED', error.message, 'GenerateAccess')
}

async function updateTestMetadata(test: XcloudResolvedTest, patch: JsonRecord) {
  if (!test.test_id) return
  const database = db()
  const { error } = await database.from('tests').update({
    legacy_metadata: {
      ...(test.legacy_metadata || {}),
      xcloud_worker: {
        ...(((test.legacy_metadata || {}).xcloud_worker as JsonRecord | undefined) || {}),
        ...patch,
        updated_at: new Date().toISOString(),
      },
    },
  }).eq('id', test.test_id)
  if (error) throw new XcloudWorkerError(500, 'XCLOUD_TEST_UPDATE_FAILED', error.message, 'GenerateAccess')
}

async function resolveFromTestId(testId: string, requiresXtream: boolean): Promise<XcloudResolvedTest> {
  const database = db()
  const { data: testData, error: testError } = await database
    .from('tests')
    .select('id,client_id,app_id,device_key,legacy_metadata')
    .eq('id', testId)
    .maybeSingle()
  if (testError) throw new XcloudWorkerError(500, 'TEST_LOOKUP_FAILED', testError.message, 'GenerateAccess')
  if (!testData) throw new XcloudWorkerError(404, 'TEST_NOT_FOUND', 'Teste nao encontrado.', 'GenerateAccess')

  const test = testData as { id: string; client_id: string | null; app_id: string | null; device_key: string | null; legacy_metadata: JsonRecord | null }
  const { data: appData, error: appError } = await database.from('apps').select('key').eq('id', test.app_id).maybeSingle()
  if (appError) throw new XcloudWorkerError(500, 'APP_LOOKUP_FAILED', appError.message, 'GenerateAccess')
  const appKey = (appData as { key?: string } | null)?.key || null
  if (appKey !== 'xcloud') throw new XcloudWorkerError(400, 'APP_NOT_XCLOUD', 'Worker XCloud so pode executar para app XCloud.', 'GenerateAccess')

  const metadata = test.legacy_metadata || {}
  const technical = technicalMetadata(metadata)
  const host = metadataValue(metadata, 'host') || metadataValue(metadata, 'dns')
  const username = metadataValue(metadata, 'username')
  const password = metadataValue(metadata, 'password')
  const deviceKey = String(test.device_key || metadataValue(metadata, 'device_key') || '').trim()

  if (!deviceKey) throw new XcloudWorkerError(400, 'DEVICE_KEY_REQUIRED', 'device_key e obrigatoria para XCloud.', 'GenerateAccess')
  if (requiresXtream && (!host || !username || !password)) throw new XcloudWorkerError(400, 'XTREAM_REQUIRED', 'Teste nao tem host/username/password para vincular no XCloud.', 'GenerateAccess')

  return {
    test_id: test.id,
    client_id: test.client_id,
    app_key: appKey,
    device_key: deviceKey,
    host,
    username,
    password,
    legacy_metadata: { ...metadata, technical_connection: technical },
  }
}

async function resolveDirect(input: XcloudWorkerInput, requiresXtream: boolean): Promise<XcloudResolvedTest> {
  const deviceKey = String(input.device_key || '').trim()
  const host = String(input.host || '').trim()
  const username = String(input.username || '').trim()
  const password = String(input.password || '').trim()
  if (!deviceKey) throw new XcloudWorkerError(400, 'DEVICE_KEY_REQUIRED', 'device_key e obrigatoria para XCloud.', 'GenerateAccess')
  if (requiresXtream && (!host || !username || !password)) throw new XcloudWorkerError(400, 'XTREAM_REQUIRED', 'Informe host, username e password.', 'GenerateAccess')
  return {
    test_id: null,
    client_id: null,
    app_key: 'xcloud',
    device_key: deviceKey,
    host,
    username,
    password,
    legacy_metadata: {},
  }
}

async function resolveInput(input: XcloudWorkerInput, requiresXtream: boolean): Promise<XcloudResolvedTest> {
  if (input.test_id) return resolveFromTestId(input.test_id, requiresXtream)
  return resolveDirect(input, requiresXtream)
}

function disabledResult(test: XcloudResolvedTest, logId: string | null, modeStatus: 'disabled' | 'mocked'): XcloudWorkerResult {
  return {
    status: modeStatus,
    stage: modeStatus === 'disabled' ? 'GenerateAccess' : 'Completed',
    device_added: false,
    xtream_attached: false,
    confirmation_found: false,
    masked_device_key: maskDeviceKey(test.device_key),
    log_id: logId,
    message: modeStatus === 'disabled' ? 'Worker XCloud desativado.' : 'Worker XCloud em modo mock.',
  }
}

async function withRetries<T>(maxRetries: number, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries) break
    }
  }
  throw lastError
}

export async function runXcloudWorker(input: XcloudWorkerInput): Promise<XcloudWorkerResult> {
  const cfg = config()
  const workerMode = input.mode === 'recreate_device' ? 'recreate_device' : input.mode === 'remove_device' ? 'remove_device' : 'normal'
  const test = await resolveInput(input, workerMode !== 'remove_device')

  if (workerMode === 'recreate_device' && input.confirm_recreate !== true) {
    throw new XcloudWorkerError(409, 'XCLOUD_RECREATE_CONFIRMATION_REQUIRED', 'Recriacao da device XCloud exige confirm_recreate=true.', 'FindXcloudDevice')
  }
  if (workerMode === 'remove_device' && input.confirm_remove !== true) {
    throw new XcloudWorkerError(409, 'XCLOUD_REMOVE_CONFIRMATION_REQUIRED', 'Remocao da device XCloud exige confirm_remove=true.', 'FindXcloudDevice')
  }

  const startedLogId = await writeLog('XCLOUD_WORKER_STARTED', 'info', {
    client_id: test.client_id,
    test_id: test.test_id,
    message: 'Worker XCloud iniciado.',
    metadata: { device_key: test.device_key, retry_stage: input.retry_stage || null, enabled: cfg.enabled, mode: cfg.mode, worker_mode: workerMode },
  })

  if (workerMode === 'recreate_device') {
    await writeLog('XCLOUD_RECREATE_REQUESTED', 'warning', {
      client_id: test.client_id,
      test_id: test.test_id,
      message: 'Recriacao controlada de device XCloud solicitada.',
      metadata: { device_key: test.device_key, confirm_recreate: true },
    })
  }
  if (workerMode === 'remove_device') {
    await writeLog('XCLOUD_REMOVE_REQUESTED', 'warning', {
      client_id: test.client_id,
      test_id: test.test_id,
      message: 'Remocao controlada de device XCloud solicitada.',
      metadata: { device_key: test.device_key, confirm_remove: true },
    })
  }

  if (!cfg.enabled) {
    await updateTestMetadata(test, { status: 'disabled', device_added: false, xtream_attached: false })
    return disabledResult(test, startedLogId, 'disabled')
  }

  if (cfg.mode !== 'real') {
    await updateTestMetadata(test, { status: 'mocked', device_added: false, xtream_attached: false })
    await createPipelineEvent(test, 'xcloud_worker_mocked', { device_key: test.device_key }, input.operator_ref)
    return disabledResult(test, startedLogId, 'mocked')
  }

  if (!cfg.panelUrl || !cfg.customPlaylistUrl) {
    throw new XcloudWorkerError(500, 'XCLOUD_CONFIG_MISSING', 'XCLOUD_PANEL_URL e XCLOUD_CUSTOM_PLAYLIST_URL sao obrigatorias.', 'GenerateAccess')
  }

  return runXcloudExclusive(async () => {
    let currentStage: XcloudWorkerStage = input.retry_stage || (workerMode === 'recreate_device' || workerMode === 'remove_device' ? 'FindXcloudDevice' : 'AddXcloudDevice')
    let deviceAdded = false
    let deviceAlreadyExists = false
    let deviceFound = false
    let deviceDeactivated = false
    let deviceDeleted = false
    let deviceRecreated = false
    let deviceRemoved = false
    let deviceReady = false
    let deviceReadiness: XcloudDeviceReadiness | undefined
    let xtreamAttached = false
    let confirmationFound = false
    let screenshotPath: string | null = null

    try {
      const page = await getXcloudPage(cfg)

      if (workerMode === 'recreate_device' || workerMode === 'remove_device') {
        if (!input.retry_stage || input.retry_stage === 'FindXcloudDevice') {
          currentStage = 'FindXcloudDevice'
          await updateTestMetadata(test, { status: 'running', stage: currentStage, recreate_device: workerMode === 'recreate_device', remove_device: workerMode === 'remove_device' })
          if (workerMode === 'remove_device') {
            await writeLog('XCLOUD_DEVICE_REMOVAL_STARTED', 'info', {
              client_id: test.client_id,
              test_id: test.test_id,
              message: 'Remocao da device XCloud iniciada.',
              metadata: { device_key: test.device_key, mode: workerMode },
            })
          }
          const findResult = await withRetries(cfg.maxRetries, () => findXcloudDevice(page, cfg, test.device_key))
          deviceFound = findResult.device_found
          await writeLog('XCLOUD_DEVICE_FOUND', deviceFound ? 'success' : 'warning', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: deviceFound ? 'Device XCloud localizada.' : 'Device XCloud nao localizada; seguindo para recadastro.',
            metadata: { device_key: test.device_key, device_found: deviceFound },
          })
        } else {
          const findResult = await findXcloudDevice(page, cfg, test.device_key)
          deviceFound = findResult.device_found
        }

        if ((!input.retry_stage || input.retry_stage === 'FindXcloudDevice' || input.retry_stage === 'DeactivateXcloudDevice') && deviceFound) {
          currentStage = 'DeactivateXcloudDevice'
          await updateTestMetadata(test, { status: 'running', stage: currentStage, device_found: true })
          await writeLog('XCLOUD_DEVICE_DEACTIVATE_STARTED', 'info', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: 'Desativacao da device XCloud iniciada.',
            metadata: { device_key: test.device_key },
          })
          const deactivateResult = await withRetries(cfg.maxRetries, () => deactivateXcloudDevice(page, cfg, test.device_key))
          deviceDeactivated = deactivateResult.device_deactivated
          await writeLog('XCLOUD_DEVICE_DEACTIVATED', 'success', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: 'Device XCloud desativada.',
            metadata: { device_key: test.device_key, device_deactivated: deviceDeactivated },
          })
        }

        if ((!input.retry_stage || input.retry_stage === 'FindXcloudDevice' || input.retry_stage === 'DeactivateXcloudDevice' || input.retry_stage === 'DeleteXcloudDevice') && deviceFound) {
          currentStage = 'DeleteXcloudDevice'
          await updateTestMetadata(test, { status: 'running', stage: currentStage, device_deactivated: deviceDeactivated })
          await writeLog('XCLOUD_DEVICE_DELETE_STARTED', 'info', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: 'Exclusao da device XCloud iniciada.',
            metadata: { device_key: test.device_key },
          })
          const deleteResult = await withRetries(cfg.maxRetries, () => deleteXcloudDevice(page, cfg, test.device_key))
          deviceDeleted = deleteResult.device_deleted
          if (!deviceDeleted) throw new XcloudWorkerError(500, 'XCLOUD_DEVICE_DELETE_NOT_CONFIRMED', 'Device XCloud ainda aparece na lista apos excluir.', 'DeleteXcloudDevice')
          await writeLog('XCLOUD_DEVICE_DELETED', 'success', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: 'Device XCloud excluida.',
            metadata: { device_key: test.device_key, device_deleted: deviceDeleted },
          })
        }

        if (workerMode === 'remove_device') {
          deviceRemoved = !deviceFound || deviceDeleted
          currentStage = 'Completed'
          await updateTestMetadata(test, {
            status: 'success',
            stage: 'Completed',
            mode: workerMode,
            device_found: deviceFound,
            device_deactivated: deviceDeactivated,
            device_deleted: deviceDeleted,
            device_removed: deviceRemoved,
            xtream_attached: false,
            confirmation_found: false,
            screenshot_path: null,
            error: null,
          })
          await createPipelineEvent(test, 'xcloud_remove_device_completed', {
            device_key: test.device_key,
            mode: workerMode,
            device_found: deviceFound,
            device_deactivated: deviceDeactivated,
            device_deleted: deviceDeleted,
            device_removed: deviceRemoved,
          }, input.operator_ref)
          const logId = await writeLog('XCLOUD_REMOVE_CONFIRMED', 'success', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: deviceFound ? 'Device XCloud removida.' : 'Device XCloud nao estava presente; remocao considerada concluida.',
            metadata: { device_key: test.device_key, device_found: deviceFound, device_deleted: deviceDeleted },
          })
          await writeLog('XCLOUD_DEVICE_REMOVAL_COMPLETED', 'success', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: 'Remocao da device XCloud concluida.',
            metadata: { device_key: test.device_key, device_found: deviceFound, device_deactivated: deviceDeactivated, device_deleted: deviceDeleted, device_removed: deviceRemoved },
          })
          return {
            status: 'success',
            stage: 'Completed',
            device_added: false,
            device_found: deviceFound,
            device_deactivated: deviceDeactivated,
            device_deleted: deviceDeleted,
            device_removed: deviceRemoved,
            xtream_attached: false,
            confirmation_found: false,
            masked_device_key: maskDeviceKey(test.device_key),
            log_id: logId,
            message: 'Device XCloud removida sem recriar.',
          }
        }

        if (!input.retry_stage || input.retry_stage !== 'AttachXtreamCredentials') {
          currentStage = 'ReAddXcloudDevice'
          await updateTestMetadata(test, { status: 'running', stage: currentStage, device_deleted: deviceDeleted })
          await writeLog('XCLOUD_DEVICE_READD_STARTED', 'info', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: 'Recadastro da device XCloud iniciado.',
            metadata: { device_key: test.device_key },
          })
          const readdResult = await withRetries(cfg.maxRetries, () => addXcloudDevice(page, cfg, test.device_key))
          deviceAdded = readdResult.device_added || readdResult.already_exists
          deviceAlreadyExists = readdResult.already_exists
          deviceRecreated = readdResult.device_added
          deviceReady = readdResult.ready_for_xtream
          deviceReadiness = readdResult.readiness
          await writeDeviceReadinessLogs(test, deviceReadiness)
          await writeLog('XCLOUD_DEVICE_RECREATED', 'success', {
            client_id: test.client_id,
            test_id: test.test_id,
            message: readdResult.already_exists ? 'Device XCloud ja existia no recadastro.' : 'Device XCloud recriada.',
            metadata: { device_key: test.device_key, already_exists: readdResult.already_exists, device_recreated: deviceRecreated },
          })
        }
      } else if (!input.retry_stage || input.retry_stage === 'AddXcloudDevice') {
        currentStage = 'AddXcloudDevice'
        await updateTestMetadata(test, { status: 'running', stage: currentStage })
        const addResult = await withRetries(cfg.maxRetries, () => addXcloudDevice(page, cfg, test.device_key))
        deviceAdded = addResult.device_added || addResult.already_exists
        deviceAlreadyExists = addResult.already_exists
        deviceReady = addResult.ready_for_xtream
        deviceReadiness = addResult.readiness
        await writeDeviceReadinessLogs(test, deviceReadiness)
        await writeLog('XCLOUD_DEVICE_ADDED', 'success', {
          client_id: test.client_id,
          test_id: test.test_id,
          message: addResult.already_exists ? 'Device XCloud ja existia; seguindo para Xtream.' : 'Device XCloud adicionado.',
          metadata: { device_key: test.device_key, already_exists: addResult.already_exists },
        })
      }

      currentStage = 'AttachXtreamCredentials'
      await updateTestMetadata(test, { status: 'running', stage: currentStage, device_added: true })
      await writeLog('XCLOUD_XTREAM_ATTACH_STARTED', 'info', {
        client_id: test.client_id,
        test_id: test.test_id,
        message: 'Vinculo Xtream iniciado na device XCloud.',
        metadata: { device_key: test.device_key },
      })
      const attachResult = await withRetries(cfg.maxRetries, () => attachXtreamCredentials(page, cfg, {
        deviceKey: test.device_key,
        host: test.host,
        username: test.username,
        password: test.password,
      }))
      xtreamAttached = attachResult.xtream_attached
      confirmationFound = attachResult.confirmation_found

      await writeLog('XCLOUD_XTREAM_ATTACHED', 'success', {
        client_id: test.client_id,
        test_id: test.test_id,
        message: workerMode === 'recreate_device' ? 'Xtream vinculado na device XCloud recriada.' : 'Xtream vinculado na device XCloud.',
        metadata: { device_key: test.device_key, confirmation_found: confirmationFound },
      })

      await updateTestMetadata(test, {
        status: 'success',
        stage: 'Completed',
        mode: workerMode,
        device_added: deviceAdded,
        device_already_exists: deviceAlreadyExists,
        device_ready: deviceReady,
        device_readiness: deviceReadiness || null,
        device_found: deviceFound,
        device_deactivated: deviceDeactivated,
        device_deleted: deviceDeleted,
        device_recreated: deviceRecreated,
        device_removed: deviceRemoved,
        xtream_attached: xtreamAttached,
        confirmation_found: confirmationFound,
        screenshot_path: null,
        error: null,
      })
      await createPipelineEvent(test, 'xcloud_worker_completed', {
        device_key: test.device_key,
        mode: workerMode,
        device_added: deviceAdded,
        device_already_exists: deviceAlreadyExists,
        device_ready: deviceReady,
        device_readiness: deviceReadiness || null,
        device_found: deviceFound,
        device_deactivated: deviceDeactivated,
        device_deleted: deviceDeleted,
        device_recreated: deviceRecreated,
        device_removed: deviceRemoved,
        xtream_attached: xtreamAttached,
        confirmation_found: confirmationFound,
      }, input.operator_ref)
      const logId = await writeLog(workerMode === 'recreate_device' ? 'XCLOUD_RECREATE_CONFIRMED' : 'XCLOUD_WORKER_COMPLETED', 'success', {
        client_id: test.client_id,
        test_id: test.test_id,
        message: workerMode === 'recreate_device' ? 'Recriacao da device XCloud confirmada com RELOAD.' : 'Worker XCloud finalizado com sucesso.',
        metadata: { device_key: test.device_key, confirmation_found: confirmationFound },
      })

      return {
        status: 'success',
        stage: 'Completed',
        device_added: deviceAdded,
        device_already_exists: deviceAlreadyExists,
        device_ready: deviceReady,
        device_readiness: deviceReadiness,
        device_found: deviceFound,
        device_deactivated: deviceDeactivated,
        device_deleted: deviceDeleted,
        device_recreated: deviceRecreated,
        device_removed: deviceRemoved,
        xtream_attached: xtreamAttached,
        confirmation_found: confirmationFound,
        masked_device_key: maskDeviceKey(test.device_key),
        log_id: logId,
      }
    } catch (error) {
      const err = error instanceof XcloudWorkerError
        ? error
        : new XcloudWorkerError(500, 'XCLOUD_WORKER_FAILED', error instanceof Error ? error.message : String(error), currentStage)
      const page = await getXcloudPage(cfg).catch(() => null)
      screenshotPath = await saveXcloudScreenshot(page, cfg.screenshotsDir, err.stage).catch(() => null)
      err.screenshotPath = screenshotPath

      if (/DEVICE_NOT_FOUND_AFTER_ADD/i.test(err.message)) {
        await writeLog('XCLOUD_DEVICE_NOT_FOUND_AFTER_ADD', 'error', {
          client_id: test.client_id,
          test_id: test.test_id,
          message: 'Device nao encontrada na lista apos Add Device.',
          metadata: { device_key: test.device_key, stage: err.stage, screenshot_path: screenshotPath },
        }).catch(() => null)
      } else if (/XCLOUD_DEVICE_NOT_READY/i.test(err.message)) {
        await writeLog('XCLOUD_DEVICE_NOT_READY', 'error', {
          client_id: test.client_id,
          test_id: test.test_id,
          message: 'Device encontrada, mas nao esta pronta para Attach Xtream.',
          metadata: { device_key: test.device_key, stage: err.stage, device_readiness: deviceReadiness || null, screenshot_path: screenshotPath },
        }).catch(() => null)
      }

      await updateTestMetadata(test, {
        status: 'failed',
        stage: err.stage,
        mode: workerMode,
        device_added: deviceAdded,
        device_ready: deviceReady,
        device_readiness: deviceReadiness || null,
        device_found: deviceFound,
        device_deactivated: deviceDeactivated,
        device_deleted: deviceDeleted,
        device_recreated: deviceRecreated,
        device_removed: deviceRemoved,
        xtream_attached: xtreamAttached,
        confirmation_found: confirmationFound,
        screenshot_path: screenshotPath,
        error: err.message,
      }).catch(() => undefined)
      const logId = await writeLog(workerMode === 'recreate_device' ? 'XCLOUD_RECREATE_FAILED' : workerMode === 'remove_device' ? 'XCLOUD_REMOVE_FAILED' : 'XCLOUD_WORKER_FAILED', 'error', {
        client_id: test.client_id,
        test_id: test.test_id,
        message: err.message,
        metadata: { code: err.code, stage: err.stage, device_key: test.device_key, screenshot_path: screenshotPath },
      }).catch(() => null)
      await createPipelineEvent(test, 'xcloud_worker_failed', {
        code: err.code,
        stage: err.stage,
        device_key: test.device_key,
        screenshot_path: screenshotPath,
      }, input.operator_ref).catch(() => undefined)

      return {
        status: 'failed',
        stage: err.stage,
        device_added: deviceAdded,
        device_ready: deviceReady,
        device_readiness: deviceReadiness,
        device_found: deviceFound,
        device_deactivated: deviceDeactivated,
        device_deleted: deviceDeleted,
        device_recreated: deviceRecreated,
        device_removed: deviceRemoved,
        xtream_attached: xtreamAttached,
        confirmation_found: confirmationFound,
        masked_device_key: maskDeviceKey(test.device_key),
        log_id: logId,
        screenshot_path: screenshotPath,
        message: maskSensitiveText(err.message),
      }
    }
  })
}

export function xcloudWorkerErrorResponse(error: unknown) {
  const err = error instanceof XcloudWorkerError
    ? error
    : new XcloudWorkerError(500, 'XCLOUD_WORKER_FAILED', error instanceof Error ? error.message : String(error), 'GenerateAccess')
  return {
    status: err.status,
    body: {
      success: false,
      code: err.code,
      error: maskSensitiveText(err.message),
      stage: err.stage,
      screenshot_path: err.screenshotPath || null,
    },
  }
}
