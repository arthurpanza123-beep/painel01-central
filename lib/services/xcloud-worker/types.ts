export type XcloudWorkerStage =
  | 'GenerateAccess'
  | 'FindXcloudDevice'
  | 'DeactivateXcloudDevice'
  | 'DeleteXcloudDevice'
  | 'ReAddXcloudDevice'
  | 'AddXcloudDevice'
  | 'AttachXtreamCredentials'
  | 'Completed'

export type XcloudWorkerMode = 'normal' | 'recreate_device' | 'remove_device'

export type XcloudDeviceReadiness = {
  row_found: boolean
  status_active: boolean
  playlist_empty: boolean
  own_playlist_confirmed: boolean
  app_name_confirmed: boolean
  status_text?: string
  playlist_text?: string
  app_name?: string
}

export type XcloudWorkerInput = {
  test_id?: string
  device_key?: string
  host?: string
  username?: string
  password?: string
  mode?: XcloudWorkerMode
  confirm_recreate?: boolean
  confirm_remove?: boolean
  retry_stage?: Exclude<XcloudWorkerStage, 'GenerateAccess' | 'Completed'>
  operator_ref?: string
}

export type XcloudWorkerConfig = {
  enabled: boolean
  mode: 'mock' | 'real'
  panelUrl: string
  devicesUrl: string
  customPlaylistUrl: string
  email: string
  password: string
  profileDir: string
  screenshotsDir: string
  maxRetries: number
  headless: boolean
  slowMoMs: number
  pageTimeoutMs: number
}

export type XcloudWorkerResult = {
  status: 'disabled' | 'mocked' | 'success' | 'failed'
  stage: XcloudWorkerStage
  device_added: boolean
  device_already_exists?: boolean
  device_ready?: boolean
  device_readiness?: XcloudDeviceReadiness
  device_found?: boolean
  device_deactivated?: boolean
  device_deleted?: boolean
  device_recreated?: boolean
  device_removed?: boolean
  xtream_attached: boolean
  confirmation_found: boolean
  masked_device_key: string
  log_id: string | null
  screenshot_path?: string | null
  message?: string
}

export type XcloudResolvedTest = {
  test_id: string | null
  client_id: string | null
  app_key: string | null
  device_key: string
  host: string
  username: string
  password: string
  legacy_metadata: Record<string, unknown>
}
