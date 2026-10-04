import { defineConfig, type DefaultTheme } from 'vitepress'

const repo = 'https://github.com/Delta1035/devhub'
const download = `${repo}/releases/latest`

function zhSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '指南',
      items: [
        { text: '快速上手', link: '/guide/getting-started' },
        { text: '自定义脚本（.devhub.yaml）', link: '/guide/devhub-yaml' },
        { text: '批量任务', link: '/guide/batch-tasks' }
      ]
    }
  ]
}

function enSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Guide',
      items: [
        { text: 'Getting started', link: '/en/guide/getting-started' },
        { text: 'Custom scripts (.devhub.yaml)', link: '/en/guide/devhub-yaml' },
        { text: 'Batch tasks', link: '/en/guide/batch-tasks' }
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
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
              modal: {
                noResultsText: '没有找到结果',
                resetButtonTitle: '清除',
                displayDetails: '显示详情',
                backButtonTitle: '返回',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
              }
            }
          }
        }
      }
    }
  },
  // Chinese is the primary language; English lives under /en/.
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      description: '统一管理本地多个项目的脚本。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/guide/getting-started' },
          { text: '下载', link: download }
        ],
        sidebar: { '/guide/': zhSidebar() },
        editLink: {
          pattern: `${repo}/edit/main/apps/website/:path`,
          text: '在 GitHub 上编辑此页'
        },
        footer: { message: '基于 MIT 许可发布。' },
        outline: { label: '本页目录' },
        docFooter: { prev: '上一页', next: '下一页' },
        lastUpdated: { text: '最后更新' },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
        notFound: {
          title: '页面未找到',
          quote: '这个页面不存在或已被移动。',
          linkLabel: '返回首页',
          linkText: '返回首页'
        }
      }
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      description: 'Run the scripts of all your local projects from one place.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'Download', link: download }
        ],
        sidebar: { '/en/guide/': enSidebar() },
        editLink: {
          pattern: `${repo}/edit/main/apps/website/:path`,
          text: 'Edit this page on GitHub'
        },
        footer: { message: 'Released under the MIT License.' }
      }
    }
  }
})
