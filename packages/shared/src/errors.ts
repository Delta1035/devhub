export type DevhubErrorCode =
  | 'INVALID_INPUT'
  | 'PROJECT_PATH_NOT_FOUND'
  | 'PROJECT_PATH_NOT_DIRECTORY'
  | 'PROJECT_ALREADY_ADDED'
  | 'PROJECT_NOT_FOUND'
  | 'INTERNAL'

/** Expected, user-facing failure. `message` is shown in the UI as-is. */
export class DevhubError extends Error {
  constructor(
    readonly code: DevhubErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'DevhubError'
  }
}
