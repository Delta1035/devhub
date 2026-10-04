import { defineConfig, type DefaultTheme } from 'vitepress'

const repo = 'https://github.com/Delta1035/devhub'
const download = `${repo}/releases/latest`

function enSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Guide',
      items: [
        { text: 'Getting started', link: '/guide/getting-started' },
        { text: 'Custom scripts (.devhub.yaml)', link: '/guide/devhub-yaml' },
        { text: 'Batch tasks', link: '/guide/batch-tasks' }
      ]
    }
  ]
}

function zhSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '指南',
      items: [
        { text: '快速上手', link: '/zh/guide/getting-started' },
        { text: '自定义脚本（.devhub.yaml）', link: '/zh/guide/devhub-yaml' },
        { text: '批量任务', link: '/zh/guide/batch-tasks' }
      ]
    }
  ]
}

export default defineConfig({
  title: 'DevHub',
  // Served from GitHub Pages as a project site: https://delta1035.github.io/devhub/
  base: '/devhub/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/png', href: '/devhub/logo.png' }]],
  themeConfig: {
    logo: '/logo.png',
    socialLinks: [{ icon: 'github', link: repo }],
    search: { provider: 'local' }
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description: 'Run the scripts of all your local projects from one place.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'Download', link: download }
        ],
        sidebar: { '/guide/': enSidebar() },
        editLink: {
          pattern: `${repo}/edit/main/apps/website/:path`,
          text: 'Edit this page on GitHub'
        },
        footer: { message: 'Released under the MIT License.' }
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description: '统一管理本地多个项目的脚本。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: '下载', link: download }
        ],
        sidebar: { '/zh/guide/': zhSidebar() },
        editLink: {
          pattern: `${repo}/edit/main/apps/website/:path`,
          text: '在 GitHub 上编辑此页'
        },
        footer: { message: '基于 MIT 许可发布。' },
        outline: { label: '本页目录' },
        docFooter: { prev: '上一页', next: '下一页' },
        lastUpdated: { text: '最后更新' },
        darkModeSwitchLabel: '外观',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言'
      }
    }
  }
})
