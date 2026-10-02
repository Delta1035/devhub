export type DevhubErrorCode =
  | 'INVALID_INPUT'
  | 'PROJECT_PATH_NOT_FOUND'
  | 'PROJECT_PATH_NOT_DIRECTORY'
  | 'PROJECT_ALREADY_ADDED'
  | 'PROJECT_NOT_FOUND'
  | 'SCRIPT_NOT_FOUND'
  | 'SCRIPT_ALREADY_RUNNING'
  | 'SPAWN_FAILED'
  | 'RUN_NOT_FOUND'
  | 'RUN_NOT_ACTIVE'
  | 'RUN_STILL_ACTIVE'
  | 'EDITOR_NOT_FOUND'
  | 'SHELL_NOT_FOUND'
  | 'GROUP_NOT_FOUND'
  | 'GROUP_NAME_TAKEN'
  | 'GROUP_ALREADY_RUNNING'
  | 'SETTINGS_INVALID'
  | 'PORT_IN_USE'
  | 'EDITOR_LAUNCH_FAILED'
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
