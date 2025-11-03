export type UpdateType = 'Major' | 'Minor' | 'Patch'
export interface ChangepackResult {
  logs: {
    type: UpdateType
    note: string
  }[]
  version: string | null
  nextVersion: string | null
  name: string | null
  path: string
  changed: boolean
}

export type ChangepackResultMap = Record<string, ChangepackResult>

export interface ChangepackConfig {
  ignore: string[]
  baseBranch: string
  latestPackage: string | null
}
