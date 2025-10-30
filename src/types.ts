export type UpdateType = 'MAJOR' | 'MINOR' | 'PATCH'
export interface ChangepackResult {
  logs: {
    type: UpdateType
    note: string
  }[]
  version: string
  nextVersion: string
  name: string
}

export type ChangepackResultMap = Record<string, ChangepackResult>
