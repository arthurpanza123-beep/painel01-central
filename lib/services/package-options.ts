export type PackageType = 'no_adult' | 'full_adult'

export type PackageMetadata = {
  adult_content: boolean
  package_type: PackageType
  provider_package: 'sem_adulto' | 'complete_adult'
}

function normalized(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizePackageType(value: unknown): PackageType {
  if (value === true) return 'full_adult'
  if (value === false) return 'no_adult'
  const key = normalized(value)
  if (['full_adult', 'complete_adult', 'completo_adulto', 'completo_18', 'adult', 'adulto', 'mais_18', '18'].includes(key)) {
    return 'full_adult'
  }
  return 'no_adult'
}

export function packageMetadata(packageType: unknown): PackageMetadata {
  const normalizedPackage = normalizePackageType(packageType)
  return normalizedPackage === 'full_adult'
    ? { adult_content: true, package_type: 'full_adult', provider_package: 'complete_adult' }
    : { adult_content: false, package_type: 'no_adult', provider_package: 'sem_adulto' }
}

export function packageTypeFromMetadata(metadata: Record<string, unknown> | null | undefined): PackageType {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  if (source.adult_content === true || source.adult_content === 'true' || source.adult_content === 1 || source.adult_content === '1') {
    return 'full_adult'
  }
  return normalizePackageType(source.package_type || source.provider_package)
}

export function packageLabel(packageType: unknown): string {
  return normalizePackageType(packageType) === 'full_adult' ? 'Completo +18' : 'Sem adulto'
}
