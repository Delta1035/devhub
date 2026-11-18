import type { Group, Project, ProjectScripts, Run, RunRecord } from '@devhub/shared'

export const mockProjects: Project[] = [
  {
    id: 'proj-shop-web',
    name: 'shop-web',
    path: 'D:\\demo\\shop-web',
    pinnedAt: '2026-11-01T00:00:00.000Z',
    addedAt: '2026-11-01T00:00:00.000Z'
  },
  {
    id: 'proj-order-api',
    name: 'order-api',
    path: 'D:\\demo\\order-api',
    addedAt: '2026-11-02T00:00:00.000Z'
  },
  {
    id: 'proj-inventory',
    name: 'inventory-service',
    path: 'D:\\demo\\inventory',
    addedAt: '2026-11-03T00:00:00.000Z'
  }
]

export const mockScripts: Record<string, ProjectScripts> = {
  'proj-shop-web': {
    status: 'ok',
    scripts: [
      {
        id: 'dev',
        name: 'dev',
        command: 'pnpm run dev',
        source: 'npm',
        ports: [5173],
        description: '启动与热更新'
      },
      {
        id: 'dev:mock',
        name: 'dev:mock',
        command: 'pnpm run dev:mock',
        source: 'npm',
        ports: [5174],
        description: '前端 + 本地 mock'
      },
      {
        id: 'build',
        name: 'build',
        command: 'pnpm run build',
        source: 'npm',
        description: '生产构建'
      },
      {
        id: 'test',
        name: 'test',
        command: 'pnpm run test',
        source: 'npm',
        description: '单元测试 · vitest'
      },
      {
        id: 'lint',
        name: 'lint',
        command: 'pnpm run lint --fix',
        source: 'npm',
        description: 'ESLint + Prettier'
      },
      {
        id: 'seed',
        name: 'seed',
        command: 'node scripts/seed.js',
        source: 'custom',
        ports: [5432],
        description: '初始化本地测试数据库'
      }
    ],
    warnings: []
  },
  'proj-order-api': {
    status: 'ok',
    scripts: [
      {
        id: 'spring-boot:run',
        name: 'spring-boot:run',
        command: './mvnw spring-boot:run',
        source: 'maven',
        ports: [8080],
        description: '启动 Spring Boot 服务'
      },
      {
        id: 'test',
        name: 'test',
        command: './mvnw test',
        source: 'maven',
        description: 'JUnit 测试套件'
      }
    ],
    warnings: []
  },
  'proj-inventory': {
    status: 'ok',
    scripts: [
      {
        id: 'start',
        name: 'start',
        command: 'npm start',
        source: 'npm',
        ports: [8081],
        description: '启动库存服务'
      }
    ],
    warnings: []
  }
}

export const mockRuns: Run[] = [
  {
    kind: 'script',
    id: 'run-dev',
    projectId: 'proj-shop-web',
    scriptId: 'dev',
    title: 'dev',
    command: 'pnpm run dev',
    status: 'running',
    startedAt: new Date(Date.now() - 134000).toISOString(),
    pid: 51730,
    exitCode: null,
    stopped: false
  },
  {
    kind: 'script',
    id: 'run-boot',
    projectId: 'proj-order-api',
    scriptId: 'spring-boot:run',
    title: 'spring-boot:run',
    command: './mvnw spring-boot:run',
    status: 'running',
    startedAt: new Date(Date.now() - 48000).toISOString(),
    pid: 80800,
    exitCode: null,
    stopped: false
  }
]

export const mockGroups: Group[] = [
  {
    id: 'grp-fullstack',
    name: '全栈本地开发',
    mode: 'serial',
    pinnedAt: '2026-11-01T00:00:00.000Z',
    steps: [
      {
        id: 'step-1',
        projectId: 'proj-order-api',
        scriptId: 'spring-boot:run',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-2',
        projectId: 'proj-inventory',
        scriptId: 'start',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-3',
        projectId: 'proj-shop-web',
        scriptId: 'dev',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-4',
        projectId: 'proj-shop-web',
        scriptId: 'test',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      }
    ]
  },
  {
    id: 'grp-daily',
    name: '每日构建与测试',
    mode: 'parallel',
    pinnedAt: '2026-11-02T00:00:00.000Z',
    steps: [
      {
        id: 'step-d1',
        projectId: 'proj-shop-web',
        scriptId: 'build',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-d2',
        projectId: 'proj-shop-web',
        scriptId: 'test',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      }
    ]
  },
  {
    id: 'grp-preflight',
    name: '发布前全量校验',
    mode: 'serial',
    steps: [
      {
        id: 'step-p1',
        projectId: 'proj-shop-web',
        scriptId: 'lint',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-p2',
        projectId: 'proj-shop-web',
        scriptId: 'test',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-p3',
        projectId: 'proj-shop-web',
        scriptId: 'build',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      }
    ]
  },
  {
    id: 'grp-stop-all',
    name: '微服务一键停止',
    mode: 'parallel',
    steps: [
      {
        id: 'step-s1',
        projectId: 'proj-order-api',
        scriptId: 'spring-boot:run',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      },
      {
        id: 'step-s2',
        projectId: 'proj-inventory',
        scriptId: 'start',
        continueWhen: { type: 'exit', timeoutSeconds: 60 }
      }
    ]
  }
]

export const sampleTerminalOutput = [
  '$ pnpm run dev',
  '> shop-web@1.4.0 dev D:\\demo\\shop-web',
  '> node dev.js --port 5173',
  '',
  '  \x1b[32mVITE v7.1.4  ready in 412 ms\x1b[0m',
  '',
  '  ➜  \x1b[36mLocal:\x1b[0m   http://localhost:5173/',
  '  ➜  \x1b[90mNetwork:\x1b[0m use --host to expose',
  '',
  '14:32:19  \x1b[34m[api]\x1b[0m  GET  /api/cart            \x1b[32m200\x1b[0m   12ms',
  '14:33:02  \x1b[32m[mock]\x1b[0m order-api :8080 已连接',
  '14:34:10  \x1b[34m[api]\x1b[0m  POST /api/checkout       \x1b[31m500\x1b[0m   84ms',
  "14:34:10  \x1b[31m[error] TypeError: cannot read properties of undefined (reading 'total')\x1b[0m",
  '            at computeTotal (src/lib/cart.ts:42:18)',
  '14:34:22  \x1b[34m[api]\x1b[0m  POST /api/checkout       \x1b[32m200\x1b[0m   31ms'
].join('\r\n')

export const sampleFailedOutput = [
  '$ pnpm run lint --fix',
  '> shop-web@1.4.0 lint D:\\demo\\shop-web',
  '> eslint . --fix',
  '',
  'D:\\demo\\shop-web\\src\\features\\cart.ts',
  '  42:18  error  Unsafe member access .total on an `any` value  @typescript-eslint/no-unsafe-member-access',
  '',
  '✖ 1 problem (1 error, 0 warnings)',
  'ELIFECYCLE  Command failed with exit code 1.'
].join('\r\n')

export function createMockRunHistory(projectId: string, scriptId: string): RunRecord[] {
  return [
    {
      projectId,
      scriptId,
      runId: 'run-dev-1',
      command: 'pnpm run ' + scriptId,
      startedAt: new Date(Date.now() - 134000).toISOString(),
      endedAt: null,
      exitCode: null,
      stopped: false,
      status: 'running'
    },
    {
      projectId,
      scriptId,
      runId: 'run-dev-2',
      command: 'pnpm run ' + scriptId,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      endedAt: new Date(Date.now() - 1000 * 60 * 60 * 3 + 112000).toISOString(),
      exitCode: 0,
      stopped: false,
      status: 'finished'
    },
    {
      projectId,
      scriptId: 'lint',
      runId: 'run-lint-1',
      command: 'pnpm run lint --fix',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      endedAt: new Date(Date.now() - 1000 * 60 * 60 * 4 + 8400).toISOString(),
      exitCode: 1,
      stopped: false,
      status: 'finished'
    },
    {
      projectId,
      scriptId: 'build',
      runId: 'run-build-1',
      command: 'pnpm run build',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      endedAt: new Date(Date.now() - 1000 * 60 * 60 * 4 + 24000).toISOString(),
      exitCode: 0,
      stopped: false,
      status: 'finished'
    },
    {
      projectId,
      scriptId: 'test',
      runId: 'run-test-1',
      command: 'pnpm run test',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      endedAt: new Date(Date.now() - 1000 * 60 * 60 * 5 + 75000).toISOString(),
      exitCode: 0,
      stopped: false,
      status: 'finished'
    }
  ]
}
