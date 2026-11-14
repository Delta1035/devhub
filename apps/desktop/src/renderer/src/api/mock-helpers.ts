import type {
  AppInfo,
  EditorId,
  EditorInfo,
  RemoteState,
  Settings,
  SystemTerminalInfo,
  WorkspacePatch,
  WorkspaceView
} from '@devhub/shared'

export async function mockGetAppInfo(): Promise<AppInfo> {
  return { version: '0.18.2', platform: 'win32' }
}

export async function mockListWorkspaces(): Promise<WorkspaceView[]> {
  return []
}

export async function mockAddWorkspace(p: string, depth?: number): Promise<WorkspaceView> {
  return {
    id: 'ws-1',
    name: 'demo-workspace',
    path: p,
    depth: depth ?? 1,
    excluded: [],
    addedAt: new Date().toISOString(),
    scan: null
  }
}

export async function mockUpdateWorkspace(
  workspaceId: string,
  patch: WorkspacePatch
): Promise<WorkspaceView> {
  return {
    id: workspaceId,
    name: 'demo-workspace',
    path: 'D:\\demo',
    depth: patch.depth ?? 1,
    excluded: patch.excluded ?? [],
    addedAt: new Date().toISOString(),
    scan: null
  }
}

export async function mockRemoveWorkspace(workspaceId: string): Promise<void> {
  void workspaceId
  await Promise.resolve()
}

export async function mockRescanWorkspaces(): Promise<WorkspaceView[]> {
  return []
}

export async function mockGetSettings(): Promise<Settings> {
  return {
    defaultShell: null,
    editorPaths: { vscode: null, idea: null },
    stopGraceSeconds: 5,
    portConflictPolicy: 'terminate',
    closeAction: 'tray',
    customShells: []
  }
}

export async function mockUpdateSettings(patch: Partial<Settings>): Promise<Settings> {
  return {
    defaultShell: patch.defaultShell !== undefined ? patch.defaultShell : null,
    editorPaths: {
      vscode: patch.editorPaths?.vscode !== undefined ? patch.editorPaths.vscode : null,
      idea: patch.editorPaths?.idea !== undefined ? patch.editorPaths.idea : null
    },
    stopGraceSeconds: patch.stopGraceSeconds ?? 5,
    portConflictPolicy: patch.portConflictPolicy ?? 'terminate',
    closeAction: patch.closeAction ?? 'tray',
    customShells: patch.customShells ?? []
  }
}

export async function mockListEditors(): Promise<EditorInfo[]> {
  return [
    { id: 'vscode', name: 'VS Code', available: true, path: 'code.cmd', custom: false },
    { id: 'idea', name: 'IntelliJ IDEA', available: true, path: 'idea.cmd', custom: false }
  ]
}

export async function mockOpenInEditor(_projectId: string, editor: EditorId): Promise<void> {
  void _projectId
  void editor
}

export async function mockGetSystemTerminal(): Promise<SystemTerminalInfo | null> {
  return { name: 'Windows Terminal', path: 'wt.exe' }
}

export async function mockOpenInSystemTerminal(projectId: string): Promise<void> {
  void projectId
  await Promise.resolve()
}

export async function mockGetRemoteState(): Promise<RemoteState> {
  return {
    enabled: true,
    host: '127.0.0.1',
    port: 9876,
    allowTerminal: true,
    token: 'devhub-demo-token',
    status: { state: 'listening', port: 9876 },
    addresses: []
  }
}

export async function mockUpdateRemoteConfig(patch: unknown): Promise<RemoteState> {
  void patch
  return mockGetRemoteState()
}

export async function mockRegenerateRemoteToken(): Promise<RemoteState> {
  return {
    ...(await mockGetRemoteState()),
    token: 'devhub-new-token'
  }
}
