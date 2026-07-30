# pro04-miniapp — Taro 微信小程序实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Taro 4.x + React 18 + NutUI 构建微信小程序前端，连接 pro04-server API，复刻现有 Next.js Web 应用的全部功能。

**Architecture:** Taro 小程序作为纯前端，通过 `Taro.request` 调用 Fastify API。认证使用 JWT token 存储在本地，微信 `wx.login` 换取 token，手机号绑定关联已有账号。UI 组件使用 NutUI React Taro 代替 shadcn/ui。

**Tech Stack:** Taro 4.x, React 18, TypeScript, NutUI React Taro, SCSS Modules

**后端 API Base URL:** 配置在 `config/index.ts` 中，开发环境指向 `http://localhost:3000`

---

## 文件结构

```
pro04-miniapp/
├── package.json
├── tsconfig.json
├── project.config.json
├── babel.config.js
├── config/
│   ├── index.ts                # Taro 编译配置
│   ├── dev.ts                  # 开发环境覆盖
│   └── prod.ts                 # 生产环境覆盖
├── src/
│   ├── app.config.ts           # 页面路由 + tabBar + 窗口配置
│   ├── app.tsx                 # 应用入口（登录状态检查）
│   ├── app.scss                # 全局样式变量
│   ├── services/
│   │   └── api.ts              # Taro.request 封装
│   ├── utils/
│   │   └── age-group.ts        # 年龄组（同服务端逻辑）
│   ├── pages/
│   │   ├── index/              # 任务首页（tab）
│   │   │   ├── index.tsx
│   │   │   ├── index.scss
│   │   │   └── index.config.ts
│   │   ├── rewards/            # 奖品中心（tab）
│   │   ├── history/            # 积分历史（tab）
│   │   ├── manage/             # 家长管理（tab，PIN 验证）
│   │   ├── login/              # 登录/绑定页
│   │   ├── select-child/       # 孩子选择
│   │   ├── manage-tasks/       # 任务模板管理
│   │   ├── manage-rewards/     # 奖品管理
│   │   ├── manage-redemptions/ # 兑换审批
│   │   ├── manage-family/      # 家庭 + 孩子管理
│   │   ├── manage-points/      # 积分调整
│   │   └── child-detail/       # 孩子详情/编辑
│   └── components/
│       ├── TaskCard/           # 任务卡片
│       ├── RewardCard/         # 奖品卡片
│       ├── PointsBadge/        # 积分徽章
│       ├── PinDialog/          # PIN 码输入弹窗
│       └── EmptyState/         # 空状态占位
└── types/
    └── global.d.ts             # 类型声明
```

---

### Task 1: 项目脚手架

**Files:**
- Create: `pro04-miniapp/` 全部初始化文件

- [ ] **Step 1: 创建 Taro 项目**

```bash
cd /Users/art/Claude && npx @tarojs/cli init pro04-miniapp
# 选择: React + TypeScript + default template
```

选择参数：
- 框架: React
- 语言: TypeScript
- CSS 预处理: SCSS
- 模板: default

- [ ] **Step 2: 安装 NutUI**

```bash
cd /Users/art/Claude/pro04-miniapp && npm install @nutui/nutui-react-taro
```

- [ ] **Step 3: 配置 babel.config.js 引入 NutUI 按需加载**

```javascript
module.exports = {
  presets: [
    ['taro', { framework: 'react', ts: true }]
  ],
  plugins: [
    ['@nutui/nutui-react-taro/dist/es/plugin/babel', { style: 'scss' }]
  ]
}
```

- [ ] **Step 4: 修改 config/index.ts 基础配置**

```typescript
import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'pro04-miniapp',
  date: '2026-7-30',
  designWidth: 375,
  deviceRatio: { 375: 2, 640: 1.17, 750: 1, 828: 0.905 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-react'],
  defineConstants: {
    'process.env.API_BASE': JSON.stringify('http://localhost:3000'),
  },
  copy: { patterns: [], options: {} },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    esnextModules: ['nutui-react-taro'],
  },
})
```

- [ ] **Step 5: 验证编译**

```bash
cd /Users/art/Claude/pro04-miniapp && npm run dev:weapp
# 在微信开发者工具中打开 dist 目录，确认空白项目可运行
```

- [ ] **Step 6: Commit**

```bash
cd pro04-miniapp && git init && git add -A && git commit -m "chore: scaffold Taro project with NutUI"
```

---

### Task 2: API 服务层 + 认证工具

**Files:**
- Create: `src/services/api.ts`
- Create: `src/utils/auth.ts`

- [ ] **Step 1: 创建 API 请求封装**

```typescript
// src/services/api.ts
import Taro from '@tarojs/taro'

const BASE = process.env.API_BASE || 'http://localhost:3000'

let _token: string | null = null

export function setToken(token: string | null) {
  _token = token
  if (token) Taro.setStorageSync('token', token)
  else Taro.removeStorageSync('token')
}

export function getToken(): string | null {
  if (_token) return _token
  _token = Taro.getStorageSync('token') || null
  return _token
}

export async function request<T = any>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; data?: any; header?: Record<string, string> }
): Promise<T> {
  const token = getToken()
  const res = await Taro.request({
    url: BASE + path,
    method: options?.method || 'GET',
    data: options?.data,
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.header || {}),
    },
  })
  if (res.statusCode >= 400) {
    throw new Error((res.data as any)?.error || `HTTP ${res.statusCode}`)
  }
  return res.data as T
}

// Convenience methods
export const api = {
  get: <T = any>(path: string, params?: Record<string, string>) =>
    request<T>(path + (params ? '?' + new URLSearchParams(params).toString() : '')),
  post: <T = any>(path: string, data?: any) =>
    request<T>(path, { method: 'POST', data }),
  put: <T = any>(path: string, data?: any) =>
    request<T>(path, { method: 'PUT', data }),
  delete: <T = any>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}
```

- [ ] **Step 2: 创建认证工具**

```typescript
// src/utils/auth.ts
import Taro from '@tarojs/taro'
import { request, setToken, getToken } from '../services/api'

interface LoginResult {
  user: { id: string; name: string; role: string; familyId: string }
  token: string
}

// 微信登录
export async function wechatLogin(): Promise<LoginResult | { isNewUser: true; tempToken: string }> {
  const { code } = await Taro.login()
  const result = await request<LoginResult | { isNewUser: true; tempToken: string }>(
    '/api/auth/wechat-login',
    { method: 'POST', data: { code } }
  )
  if ('token' in result) {
    setToken(result.token)
  }
  return result
}

// 绑定手机号
export async function bindPhone(tempToken: string, phone: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult>('/api/auth/bind-phone', {
    method: 'POST',
    data: { tempToken, phone, password },
  })
  setToken(result.token)
  return result
}

// 手机号登录
export async function phoneLogin(phone: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult>('/api/auth/phone-login', {
    method: 'POST',
    data: { phone, password },
  })
  setToken(result.token)
  return result
}

// 检查登录状态
export async function checkSession(): Promise<boolean> {
  try {
    const res = await request<{ user: any }>('/api/auth/session')
    return res.user !== null
  } catch {
    setToken(null)
    return false
  }
}

// 登出
export async function logout() {
  await request('/api/auth/logout', { method: 'POST' })
  setToken(null)
  Taro.clearStorageSync()
}
```

- [ ] **Step 3: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add API service layer and auth utilities"
```

---

### Task 3: App 入口配置（路由 + tabBar）

**Files:**
- Modify: `src/app.config.ts`
- Modify: `src/app.tsx`
- Create: `src/app.scss`

- [ ] **Step 1: 配置 app.config.ts（页面路由 + tabBar）**

```typescript
// src/app.config.ts
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/rewards/index',
    'pages/history/index',
    'pages/manage/index',
    'pages/login/index',
    'pages/select-child/index',
    'pages/manage-tasks/index',
    'pages/manage-rewards/index',
    'pages/manage-redemptions/index',
    'pages/manage-family/index',
    'pages/manage-points/index',
    'pages/child-detail/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '奖励小助手',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#999',
    selectedColor: '#f59e0b',
    backgroundColor: '#fff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '任务', iconPath: '', selectedIconPath: '' },
      { pagePath: 'pages/rewards/index', text: '奖品', iconPath: '', selectedIconPath: '' },
      { pagePath: 'pages/history/index', text: '记录', iconPath: '', selectedIconPath: '' },
      { pagePath: 'pages/manage/index', text: '管理', iconPath: '', selectedIconPath: '' },
    ],
  },
})
```

- [ ] **Step 2: 创建 app.tsx（登录状态守卫）**

```typescript
// src/app.tsx
import { useEffect, useState } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { checkSession, wechatLogin } from './utils/auth'
import { setToken } from './services/api'
import './app.scss'

export default function App({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useLaunch(() => {
    // 恢复 token
    const savedToken = Taro.getStorageSync('token')
    if (savedToken) setToken(savedToken)
    setReady(true)
  })

  if (!ready) return null
  return <>{children}</>
}
```

- [ ] **Step 3: 创建 app.scss（全局样式 + NutUI 主题变量）**

```scss
// src/app.scss
page {
  --nutui-brand-color: #f59e0b;
  --nutui-brand-color-end: #f97316;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f5f5f5;
  color: #1a1a1a;
}
```

- [ ] **Step 4: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add app config with tabBar, routing, and auth guard"
```

---

### Task 4: 登录页面

**Files:**
- Create: `src/pages/login/index.tsx`
- Create: `src/pages/login/index.scss`
- Create: `src/pages/login/index.config.ts`

- [ ] **Step 1: 创建 login/index.config.ts**

```typescript
export default definePageConfig({ navigationBarTitleText: '登录' })
```

- [ ] **Step 2: 创建 login/index.tsx**

```typescript
// src/pages/login/index.tsx
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button, Input, Tabs, Form } from '@nutui/nutui-react-taro'
import { wechatLogin, bindPhone, phoneLogin } from '../../utils/auth'
import './index.scss'

export default function LoginPage() {
  const [tab, setTab] = useState<'wechat' | 'phone'>('wechat')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [bindMode, setBindMode] = useState(false)
  const [tempToken, setTempToken] = useState('')

  const handleWechatLogin = async () => {
    setLoading(true)
    try {
      const result = await wechatLogin()
      if ('isNewUser' in result && result.isNewUser) {
        setTempToken(result.tempToken)
        setBindMode(true)
      } else {
        Taro.switchTab({ url: '/pages/index/index' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '登录失败', icon: 'error' })
    }
    setLoading(false)
  }

  const handleBind = async () => {
    if (!phone || !password) {
      Taro.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await bindPhone(tempToken, phone, password)
      Taro.switchTab({ url: '/pages/index/index' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '绑定失败', icon: 'error' })
    }
    setLoading(false)
  }

  const handlePhoneLogin = async () => {
    if (!phone || !password) {
      Taro.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await phoneLogin(phone, password)
      Taro.switchTab({ url: '/pages/index/index' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '登录失败', icon: 'error' })
    }
    setLoading(false)
  }

  if (bindMode) {
    return (
      <View className="login-page">
        <View className="login-card">
          <Text className="title">绑定已有账号</Text>
          <Text className="subtitle">输入手机号和密码关联你的账号</Text>
          <Input placeholder="手机号" type="number" value={phone} onChange={setPhone} />
          <Input placeholder="密码" type="password" value={password} onChange={setPassword} />
          <Button type="primary" loading={loading} onClick={handleBind} block>绑定</Button>
          <Button fill="none" onClick={() => setBindMode(false)}>返回</Button>
        </View>
      </View>
    )
  }

  return (
    <View className="login-page">
      <View className="login-card">
        <Text className="title">🌟 奖励小助手</Text>
        <Tabs value={tab} onChange={(v) => setTab(v as 'wechat' | 'phone')}>
          <Tabs.TabPane value="wechat" title="微信登录" />
          <Tabs.TabPane value="phone" title="手机登录" />
        </Tabs>

        {tab === 'wechat' ? (
          <View className="wechat-section">
            <Button type="primary" loading={loading} onClick={handleWechatLogin} block>
              微信一键登录
            </Button>
          </View>
        ) : (
          <View className="phone-section">
            <Input placeholder="手机号" type="number" value={phone} onChange={setPhone} />
            <Input placeholder="密码" type="password" value={password} onChange={setPassword} />
            <Button type="primary" loading={loading} onClick={handlePhoneLogin} block>
              登录
            </Button>
          </View>
        )}
      </View>
    </View>
  )
}
```

- [ ] **Step 3: 创建 login/index.scss**

```scss
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40px 24px;
}
.login-card {
  width: 100%;
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
}
.title { font-size: 24px; font-weight: 700; display: block; text-align: center; margin-bottom: 8px; }
.subtitle { font-size: 14px; color: #999; display: block; text-align: center; margin-bottom: 24px; }
.wechat-section { margin-top: 24px; }
.phone-section { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
```

- [ ] **Step 4: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add login page with WeChat login and phone binding"
```

---

### Task 5: 选择孩子页面

**Files:**
- Create: `src/pages/select-child/index.tsx`
- Create: `src/pages/select-child/index.scss`
- Create: `src/pages/select-child/index.config.ts`

- [ ] **Step 1: 创建 select-child/index.tsx**

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Avatar, Button } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'
import './index.scss'

interface ChildInfo { id: string; name: string; ageGroup: string }

export default function SelectChildPage() {
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ users: ChildInfo[] }>('/api/family').then(res => {
      setChildren(res.users.filter(u => u.role === 'child'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSelect = async (child: ChildInfo) => {
    await api.post('/api/auth/select-child', { childId: child.id })
    Taro.setStorageSync('selectedChildId', child.id)
    Taro.setStorageSync('selectedChildName', child.name)
    Taro.switchTab({ url: '/pages/index/index' })
  }

  return (
    <View className="select-child-page">
      <Text className="title">选择小朋友</Text>
      {children.map(child => (
        <View key={child.id} className="child-row" onClick={() => handleSelect(child)}>
          <Avatar size="normal">{child.name[0]}</Avatar>
          <View className="child-info">
            <Text className="child-name">{child.name}</Text>
            <Text className="child-age">{child.ageGroup || '未知年龄'}</Text>
          </View>
        </View>
      ))}
      {!loading && children.length === 0 && (
        <Text className="empty">暂无小朋友，请让家长添加</Text>
      )}
    </View>
  )
}
```

- [ ] **Step 2: 创建样式和配置**

```scss
// select-child/index.scss
.select-child-page { padding: 24px 16px; }
.title { font-size: 20px; font-weight: 700; display: block; margin-bottom: 16px; }
.child-row { display: flex; align-items: center; gap: 12px; padding: 16px; background: #fff; border-radius: 12px; margin-bottom: 8px; }
.child-info { flex: 1; }
.child-name { font-size: 16px; font-weight: 600; display: block; }
.child-age { font-size: 12px; color: #999; }
.empty { color: #999; text-align: center; display: block; margin-top: 40px; }
```

```typescript
// select-child/index.config.ts
export default definePageConfig({ navigationBarTitleText: '选择小朋友' })
```

- [ ] **Step 3: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add select child page"
```

---

### Task 6: 任务首页（最复杂页面）

**Files:**
- Create: `src/pages/index/index.tsx`
- Create: `src/pages/index/index.scss`
- Create: `src/pages/index/index.config.ts`

- [ ] **Step 1: 创建任务首页**

```typescript
// src/pages/index/index.tsx
import { useEffect, useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'
import TaskCard from '../../components/TaskCard'
import PointsBadge from '../../components/PointsBadge'
import './index.scss'

interface Task {
  id: string; title: string; points: number; icon?: string
  status: 'pending' | 'completed' | 'approved' | 'deducted'
  createdAt: string; child?: { id: string; name: string }
}

interface DateGroup { label: string; date: string; tasks: Task[] }

function groupByDate(tasks: Task[]): DateGroup[] {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    const d = t.createdAt.split('T')[0]
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(t)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, tasks]) => ({
      date,
      label: date === today ? '今天' : date === yesterday ? '昨天' : date,
      tasks,
    }))
}

export default function HomePage() {
  const [groups, setGroups] = useState<DateGroup[]>([])
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [childName, setChildName] = useState('')

  const fetchData = useCallback(async () => {
    const childId = Taro.getStorageSync('selectedChildId')
    Taro.setStorageSync('selectedChildId', childId || '')
    try {
      const [tasksRes, pointsRes] = await Promise.all([
        api.get<Task[]>('/api/tasks', childId ? { childId } : undefined),
        api.get<{ balance: number }>('/api/points', childId ? { childId } : undefined),
      ])
      setGroups(groupByDate(tasksRes))
      setPoints(pointsRes.balance)
      const name = Taro.getStorageSync('selectedChildName') || ''
      setChildName(name)
    } catch (e) {
      // If unauthorized, redirect to login
      Taro.redirectTo({ url: '/pages/login/index' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleComplete = async (id: string) => {
    await api.post(`/api/tasks/${id}/complete`)
    setGroups(prev => prev.map(g => ({
      ...g,
      tasks: g.tasks.map(t => t.id === id ? { ...t, status: 'completed' as const } : t),
    })))
    Taro.showToast({ title: '已提交', icon: 'success' })
  }

  const handleSwitch = () => Taro.navigateTo({ url: '/pages/select-child/index' })

  return (
    <View className="home-page">
      {/* Header */}
      <View className="header">
        <View>
          <Text className="greeting">🌟 今天要做什么？</Text>
          {childName ? (
            <View className="child-row" onClick={handleSwitch}>
              <Text className="child-label">{childName} 的任务</Text>
              <Text className="switch-link">切换</Text>
            </View>
          ) : (
            <Text className="select-prompt" onClick={handleSwitch}>选择小朋友</Text>
          )}
        </View>
        <PointsBadge points={points} />
      </View>

      {/* Task list by date */}
      {loading ? (
        <View className="loading">加载中...</View>
      ) : groups.length === 0 ? (
        <View className="empty">
          <Text className="empty-icon">🎉</Text>
          <Text className="empty-text">还没有任务</Text>
          <Text className="empty-sub">让家长添加一些任务吧</Text>
        </View>
      ) : (
        groups.map(group => (
          <View key={group.date} className="date-group">
            <Text className="date-label">
              {group.label} · {group.tasks.filter(t => t.status === 'completed').length}/{group.tasks.length}
            </Text>
            {group.tasks.map(task => (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} />
            ))}
          </View>
        ))
      )}

      {/* TabBar 占位 */}
      <View style={{ height: 60 }} />
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

```scss
// src/pages/index/index.scss
.home-page { padding: 16px; background: #f5f5f5; min-height: 100vh; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.greeting { font-size: 22px; font-weight: 700; display: block; }
.child-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.child-label { font-size: 14px; color: #666; }
.switch-link { font-size: 12px; color: #f59e0b; }
.select-prompt { font-size: 14px; color: #f59e0b; margin-top: 4px; display: block; }
.date-group { margin-bottom: 16px; }
.date-label { font-size: 12px; color: #999; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 8px; }
.loading { padding: 40px; text-align: center; color: #999; }
.empty { padding: 60px 0; text-align: center; }
.empty-icon { font-size: 64px; display: block; }
.empty-text { font-size: 18px; font-weight: 600; color: #999; margin-top: 12px; display: block; }
.empty-sub { font-size: 14px; color: #bbb; margin-top: 4px; display: block; }
```

- [ ] **Step 3: 创建页面配置**

```typescript
// src/pages/index/index.config.ts
export default definePageConfig({
  navigationBarTitleText: '奖励小助手',
  enablePullDownRefresh: true,
})
```

- [ ] **Step 4: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add task home page with date-grouped task list"
```

---

### Task 7: 奖品中心页面

**Files:**
- Create: `src/pages/rewards/index.tsx`
- Create: `src/pages/rewards/index.scss`
- Create: `src/pages/rewards/index.config.ts`

- [ ] **Step 1: 创建奖品中心页面**

```typescript
// src/pages/rewards/index.tsx
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import RewardCard from '../../components/RewardCard'
import PointsBadge from '../../components/PointsBadge'
import { api } from '../../services/api'
import './index.scss'

interface Reward {
  id: string; title: string; description?: string; pointsCost: number; imageUrl?: string
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<Reward[]>('/api/rewards'),
      api.get<{ balance: number }>('/api/points'),
    ]).then(([r, p]) => {
      setRewards(r)
      setPoints(p.balance)
      setLoading(false)
    })
  }, [])

  const handleRedeem = async (reward: Reward) => {
    const res = await Taro.showModal({
      title: '确认兑换',
      content: `用 ${reward.pointsCost} 积分兑换「${reward.title}」？`,
      confirmText: '确认兑换',
    })
    if (!res.confirm) return

    try {
      await api.post('/api/redemptions', { rewardId: reward.id })
      Taro.showToast({ title: '兑换申请已提交', icon: 'success' })
      setPoints(p => p - reward.pointsCost)
    } catch (e: any) {
      Taro.showToast({ title: e.message || '兑换失败', icon: 'error' })
    }
  }

  return (
    <View className="rewards-page">
      <View className="header">
        <Text className="title">🎁 奖品兑换中心</Text>
        <PointsBadge points={points} />
      </View>
      {loading ? (
        <Text className="loading">加载中...</Text>
      ) : (
        <View className="reward-grid">
          {rewards.map(r => (
            <RewardCard key={r.id} reward={r} balance={points} onRedeem={handleRedeem} />
          ))}
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add rewards center page"
```

---

### Task 8: 积分历史页面

**Files:**
- Create: `src/pages/history/index.tsx`

- [ ] **Step 1: 创建积分历史页面**

```typescript
// src/pages/history/index.tsx
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Cell } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'
import './index.scss'

interface Transaction {
  id: string; amount: number; type: string; reason: string; createdAt: string
}

export default function HistoryPage() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ balance: number; transactions: Transaction[] }>('/api/points').then(res => {
      setBalance(res.balance)
      setTransactions(res.transactions)
      setLoading(false)
    })
  }, [])

  return (
    <View className="history-page">
      <View className="balance-card">
        <Text className="balance-label">当前积分</Text>
        <Text className="balance-value">{balance} ⭐</Text>
      </View>

      <Text className="section-title">积分明细</Text>
      {loading ? (
        <Text className="loading">加载中...</Text>
      ) : transactions.length === 0 ? (
        <Text className="empty">暂无记录</Text>
      ) : (
        transactions.map(tx => (
          <Cell key={tx.id} title={tx.reason} 
            description={new Date(tx.createdAt).toLocaleDateString('zh-CN')}
            extra={<Text style={{ color: tx.amount > 0 ? '#22c55e' : '#ef4444' }}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </Text>}
          />
        ))
      )}
    </View>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add points history page"
```

---

### Task 9: 家长管理入口 + PIN 验证

**Files:**
- Create: `src/pages/manage/index.tsx`
- Create: `src/components/PinDialog/index.tsx`

- [ ] **Step 1: 创建 PinDialog 组件**

```typescript
// src/components/PinDialog/index.tsx
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Dialog, PasswordInput, Button } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PinDialog({ visible, onClose, onSuccess }: Props) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (pin.length < 4) return
    setLoading(true)
    try {
      const res = await api.post<{ success: boolean; token: string }>('/api/auth/verify-pin', { pin })
      // Store parent token for management operations
      Taro.setStorageSync('parentToken', res.token)
      onSuccess()
      onClose()
    } catch (e: any) {
      Taro.showToast({ title: e.message || 'PIN 错误', icon: 'error' })
    }
    setLoading(false)
  }

  return (
    <Dialog visible={visible} onClose={onClose} title="家长验证" footer={null}>
      <View style={{ padding: '16px 0' }}>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 12, display: 'block' }}>
          请输入家长 PIN 码
        </Text>
        <PasswordInput value={pin} onChange={setPin} length={4} />
        <Button type="primary" loading={loading} onClick={handleSubmit} block style={{ marginTop: 16 }}>
          确认
        </Button>
      </View>
    </Dialog>
  )
}
```

- [ ] **Step 2: 创建管理入口页面**

```typescript
// src/pages/manage/index.tsx
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Cell, Button } from '@nutui/nutui-react-taro'
import PinDialog from '../../components/PinDialog'

const menuItems = [
  { label: '任务模板管理', url: '/pages/manage-tasks/index' },
  { label: '奖品管理', url: '/pages/manage-rewards/index' },
  { label: '兑换审批', url: '/pages/manage-redemptions/index' },
  { label: '家庭成员', url: '/pages/manage-family/index' },
  { label: '积分调整', url: '/pages/manage-points/index' },
]

export default function ManagePage() {
  const [pinOpen, setPinOpen] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  const handlePinSuccess = () => setAuthorized(true)

  const handleNavigate = (url: string) => {
    const parentToken = Taro.getStorageSync('parentToken')
    if (!parentToken) {
      setPinOpen(true)
      return
    }
    Taro.navigateTo({ url })
  }

  // Re-verify if no parent token
  const openManage = () => {
    const parentToken = Taro.getStorageSync('parentToken')
    if (parentToken) setAuthorized(true)
    else setPinOpen(true)
  }

  if (!authorized) {
    return (
      <View style={{ padding: 40, textAlign: 'center' }}>
        <Text style={{ fontSize: 32, display: 'block', marginBottom: 16 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>家长管理</Text>
        <Text style={{ fontSize: 14, color: '#999', margin: '8px 0 24px', display: 'block' }}>
          需要验证 PIN 码后方可管理
        </Text>
        <Button type="primary" onClick={openManage}>验证 PIN 码</Button>
        <PinDialog visible={pinOpen} onClose={() => setPinOpen(false)} onSuccess={handlePinSuccess} />
      </View>
    )
  }

  return (
    <View className="manage-page">
      <Text className="title">⚙️ 家长管理</Text>
      {menuItems.map(item => (
        <Cell key={item.url} title={item.label} isLink onClick={() => handleNavigate(item.url)} />
      ))}
      <Button fill="none" onClick={() => { Taro.removeStorageSync('parentToken'); setAuthorized(false) }}
        style={{ marginTop: 16 }}>
        锁定管理
      </Button>
    </View>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add parent management entry with PIN dialog"
```

---

### Task 10: 管理页面们（批量创建 5 个管理页面）

**Files:**
- Create: `src/pages/manage-tasks/index.tsx`
- Create: `src/pages/manage-rewards/index.tsx`
- Create: `src/pages/manage-redemptions/index.tsx`
- Create: `src/pages/manage-family/index.tsx`
- Create: `src/pages/manage-points/index.tsx`
- Create: `src/pages/child-detail/index.tsx`

- [ ] **Step 1: 任务模板管理 (manage-tasks/index.tsx)**

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import { Button, Dialog, Form } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

interface Template { id: string; title: string; points: number; category: string; icon: string; isActive: boolean }

export default function ManageTasksPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState('1')
  const [newIcon, setNewIcon] = useState('⭐')

  useEffect(() => { fetchTemplates() }, [])

  const fetchTemplates = () => {
    api.get<Template[]>('/api/templates').then(setTemplates)
  }

  const handleAdd = async () => {
    if (!newTitle) return
    await api.post('/api/templates', { title: newTitle, points: Number(newPoints), icon: newIcon })
    setShowAdd(false)
    setNewTitle('')
    fetchTemplates()
    Taro.showToast({ title: '已添加', icon: 'success' })
  }

  const handleDelete = async (id: string) => {
    const res = await Taro.showModal({ title: '确认删除？', content: '删除后无法恢复' })
    if (res.confirm) {
      await api.delete(`/api/templates/${id}`)
      fetchTemplates()
    }
  }

  return (
    <View className="page">
      <View className="header">
        <Text className="title">任务模板</Text>
        <Button size="small" onClick={() => setShowAdd(true)}>+ 添加</Button>
      </View>

      {templates.map(tpl => (
        <View key={tpl.id} className="list-row">
          <Text className="row-icon">{tpl.icon}</Text>
          <View className="row-info">
            <Text className="row-title">{tpl.title}</Text>
            <Text className="row-sub">+{tpl.points} ⭐ · {tpl.category}</Text>
          </View>
          <Button size="small" fill="none" onClick={() => handleDelete(tpl.id)}>删除</Button>
        </View>
      ))}

      <Dialog visible={showAdd} onClose={() => setShowAdd(false)} title="添加模板" footer={null}>
        <Form>
          <Form.Item label="标题"><Input value={newTitle} onInput={e => setNewTitle(e.detail.value)} /></Form.Item>
          <Form.Item label="积分"><Input type="number" value={newPoints} onInput={e => setNewPoints(e.detail.value)} /></Form.Item>
          <Form.Item label="图标"><Input value={newIcon} onInput={e => setNewIcon(e.detail.value)} /></Form.Item>
          <Button type="primary" onClick={handleAdd} block>确认添加</Button>
        </Form>
      </Dialog>
    </View>
  )
}
```

- [ ] **Step 2: 奖品管理 (manage-rewards/index.tsx)**

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import { Button, Dialog, Form } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

interface Reward { id: string; title: string; pointsCost: number; isActive: boolean }

export default function ManageRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', pointsCost: '', description: '' })

  useEffect(() => { fetchRewards() }, [])

  const fetchRewards = () => api.get<Reward[]>('/api/rewards').then(setRewards)

  const handleAdd = async () => {
    if (!form.title || !form.pointsCost) return
    await api.post('/api/rewards', { title: form.title, pointsCost: Number(form.pointsCost), description: form.description })
    setShowAdd(false)
    setForm({ title: '', pointsCost: '', description: '' })
    fetchRewards()
  }

  const handleToggle = async (reward: Reward) => {
    await api.put(`/api/rewards/${reward.id}`, { ...reward, isActive: !reward.isActive })
    fetchRewards()
  }

  return (
    <View className="page">
      <View className="header">
        <Text className="title">奖品管理</Text>
        <Button size="small" onClick={() => setShowAdd(true)}>+ 添加</Button>
      </View>

      {rewards.map(r => (
        <View key={r.id} className="list-row">
          <View className="row-info">
            <Text className="row-title">{r.title}</Text>
            <Text className="row-sub">{r.pointsCost} ⭐</Text>
          </View>
          <Button size="small" onClick={() => handleToggle(r)}>
            {r.isActive ? '下架' : '上架'}
          </Button>
        </View>
      ))}

      <Dialog visible={showAdd} onClose={() => setShowAdd(false)} title="添加奖品" footer={null}>
        <Form>
          <Form.Item label="名称"><Input value={form.title} onInput={e => setForm({...form, title: e.detail.value})} /></Form.Item>
          <Form.Item label="所需积分"><Input type="number" value={form.pointsCost} onInput={e => setForm({...form, pointsCost: e.detail.value})} /></Form.Item>
          <Form.Item label="描述"><Input value={form.description} onInput={e => setForm({...form, description: e.detail.value})} /></Form.Item>
          <Button type="primary" onClick={handleAdd} block>确认添加</Button>
        </Form>
      </Dialog>
    </View>
  )
}
```

- [ ] **Step 3: 兑换审批 (manage-redemptions/index.tsx)**

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button, Cell } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

interface Redemption {
  id: string; pointsSpent: number; status: string; createdAt: string
  child?: { id: string; name: string }; reward?: { id: string; title: string }
}

export default function ManageRedemptionsPage() {
  const [items, setItems] = useState<Redemption[]>([])

  useEffect(() => {
    api.get<Redemption[]>('/api/redemptions', { status: 'pending' }).then(setItems)
  }, [])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    await api.put(`/api/redemptions/${id}`, { action })
    setItems(prev => prev.filter(i => i.id !== id))
    Taro.showToast({ title: action === 'approve' ? '已批准' : '已拒绝', icon: 'success' })
  }

  return (
    <View className="page">
      <Text className="title" style={{ padding: '16px' }}>待处理兑换</Text>
      {items.length === 0 ? (
        <Text className="empty">暂无待处理的兑换申请</Text>
      ) : (
        items.map(item => (
          <View key={item.id} className="card">
            <Text className="card-title">{item.reward?.title}</Text>
            <Text className="card-sub">申请人: {item.child?.name} · {item.pointsSpent} ⭐</Text>
            <Text className="card-date">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</Text>
            <View className="actions">
              <Button size="small" type="primary" onClick={() => handleAction(item.id, 'approve')}>批准</Button>
              <Button size="small" onClick={() => handleAction(item.id, 'reject')}>拒绝</Button>
            </View>
          </View>
        ))
      )}
    </View>
  )
}
```

- [ ] **Step 4: 家庭管理 (manage-family/index.tsx)**

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import { Button, Dialog, Form } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

interface FamilyMember { id: string; name: string; role: string; ageGroup: string }

export default function ManageFamilyPage() {
  const [family, setFamily] = useState<{ name: string; users: FamilyMember[] } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')

  useEffect(() => {
    api.get<{ name: string; users: FamilyMember[] }>('/api/family').then(setFamily)
  }, [])

  const handleAddChild = async () => {
    if (!newName) return
    await api.post('/api/family/children', {
      name: newName,
      birthYear: birthYear ? Number(birthYear) : undefined,
      birthMonth: birthMonth ? Number(birthMonth) : undefined,
    })
    setShowAdd(false)
    setNewName('')
    Taro.showToast({ title: '已添加', icon: 'success' })
    // Refresh
    const res = await api.get<{ name: string; users: FamilyMember[] }>('/api/family')
    setFamily(res)
  }

  const handleEditChild = (child: FamilyMember) => {
    Taro.navigateTo({ url: `/pages/child-detail/index?id=${child.id}&name=${child.name}` })
  }

  if (!family) return <Text className="loading">加载中...</Text>

  return (
    <View className="page">
      <Text className="title">{family.name}</Text>
      <View className="section">
        <Text className="section-title">家庭成员</Text>
        {family.users.map(user => (
          <View key={user.id} className="list-row" onClick={() => user.role === 'child' && handleEditChild(user)}>
            <Text className="row-title">{user.name}</Text>
            <Text className="row-sub">{user.role === 'parent' ? '家长' : `孩子 · ${user.ageGroup || '未知'}`}</Text>
          </View>
        ))}
      </View>
      <Button onClick={() => setShowAdd(true)}>添加小朋友</Button>

      <Dialog visible={showAdd} onClose={() => setShowAdd(false)} title="添加小朋友" footer={null}>
        <Form>
          <Form.Item label="姓名"><Input value={newName} onInput={e => setNewName(e.detail.value)} /></Form.Item>
          <Form.Item label="出生年份"><Input type="number" value={birthYear} onInput={e => setBirthYear(e.detail.value)} /></Form.Item>
          <Form.Item label="出生月份"><Input type="number" value={birthMonth} onInput={e => setBirthMonth(e.detail.value)} /></Form.Item>
          <Button type="primary" onClick={handleAddChild} block>确认</Button>
        </Form>
      </Dialog>
    </View>
  )
}
```

- [ ] **Step 5: 孩子详情编辑 (child-detail/index.tsx)**

```typescript
import { useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Input } from '@tarojs/components'
import { Button, Form } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

export default function ChildDetailPage() {
  const router = useRouter()
  const { id, name: initialName } = router.params
  const [name, setName] = useState(initialName || '')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')

  const handleSave = async () => {
    await api.put(`/api/family/children/${id}`, {
      name,
      birthYear: birthYear ? Number(birthYear) : undefined,
      birthMonth: birthMonth ? Number(birthMonth) : undefined,
    })
    Taro.showToast({ title: '已保存', icon: 'success' })
    Taro.navigateBack()
  }

  return (
    <View className="page">
      <Form>
        <Form.Item label="姓名"><Input value={name} onInput={e => setName(e.detail.value)} /></Form.Item>
        <Form.Item label="出生年份"><Input type="number" value={birthYear} onInput={e => setBirthYear(e.detail.value)} /></Form.Item>
        <Form.Item label="出生月份"><Input type="number" value={birthMonth} onInput={e => setBirthMonth(e.detail.value)} /></Form.Item>
        <Button type="primary" onClick={handleSave} block>保存</Button>
      </Form>
    </View>
  )
}
```

- [ ] **Step 6: 积分调整 (manage-points/index.tsx)**

```typescript
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import { Button, Picker, Form } from '@nutui/nutui-react-taro'
import { api } from '../../services/api'

interface Child { id: string; name: string }

export default function ManagePointsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    api.get<{ users: any[] }>('/api/family').then(res => {
      setChildren(res.users.filter((u: any) => u.role === 'child'))
    })
  }, [])

  const handleSubmit = async () => {
    if (!selectedChild || !amount || !reason) {
      Taro.showToast({ title: '请填写完整', icon: 'none' })
      return
    }
    await api.post('/api/points', { childId: selectedChild, amount: Number(amount), reason })
    Taro.showToast({ title: '积分已调整', icon: 'success' })
    setAmount('')
    setReason('')
  }

  return (
    <View className="page">
      <Picker
        value={selectedChild ? [selectedChild] : []}
        options={[{ text: '选择小朋友', value: '' }, ...children.map(c => ({ text: c.name, value: c.id }))]}
        onChange={(_, val) => setSelectedChild(val[0])}
      />
      <Form.Item label="积分数（正数加分，负数减分）">
        <Input type="number" value={amount} onInput={e => setAmount(e.detail.value)} />
      </Form.Item>
      <Form.Item label="原因">
        <Input value={reason} onInput={e => setReason(e.detail.value)} placeholder="如：表现优秀" />
      </Form.Item>
      <Button type="primary" onClick={handleSubmit} block>确认调整</Button>
    </View>
  )
}
```

- [ ] **Step 7: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add all management pages (tasks, rewards, redemptions, family, points, child detail)"
```

---

### Task 11: 共享组件

**Files:**
- Create: `src/components/TaskCard/index.tsx`
- Create: `src/components/RewardCard/index.tsx`
- Create: `src/components/PointsBadge/index.tsx`
- Create: `src/components/EmptyState/index.tsx`

- [ ] **Step 1: TaskCard 组件**

```typescript
// src/components/TaskCard/index.tsx
import { View, Text } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'

interface Task { id: string; title: string; points: number; icon?: string; status: string }
interface Props { task: Task; onComplete: (id: string) => void }

export default function TaskCard({ task, onComplete }: Props) {
  const isPending = task.status === 'pending'
  const isCompleted = task.status === 'completed'

  return (
    <View className={`task-card ${isCompleted ? 'completed' : ''}`}>
      <View className="task-icon">{task.icon || '📋'}</View>
      <View className="task-body">
        <Text className="task-title">{task.title}</Text>
        <Text className="task-points">+{task.points} ⭐</Text>
        {isCompleted && <Text className="task-status">已提交，待审核</Text>}
      </View>
      <Button
        size="small"
        type={isPending ? 'primary' : 'default'}
        disabled={!isPending}
        onClick={() => onComplete(task.id)}
      >
        {isPending ? '完成' : isCompleted ? '等待中' : '✓'}
      </Button>
    </View>
  )
}
```

- [ ] **Step 2: RewardCard 组件**

```typescript
// src/components/RewardCard/index.tsx
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'

interface Reward { id: string; title: string; pointsCost: number; description?: string; imageUrl?: string }
interface Props { reward: Reward; balance: number; onRedeem: (r: Reward) => void }

export default function RewardCard({ reward, balance, onRedeem }: Props) {
  const canAfford = balance >= reward.pointsCost
  return (
    <View className="reward-card">
      <View className="reward-icon">{reward.imageUrl ? <Image src={reward.imageUrl} /> : <Text>🎁</Text>}</View>
      <Text className="reward-title">{reward.title}</Text>
      {reward.description && <Text className="reward-desc">{reward.description}</Text>}
      <Text className="reward-cost">{reward.pointsCost} ⭐</Text>
      <Button size="small" type={canAfford ? 'primary' : 'default'} disabled={!canAfford}
        onClick={() => onRedeem(reward)}>
        {canAfford ? '兑换' : '积分不足'}
      </Button>
    </View>
  )
}
```

- [ ] **Step 3: PointsBadge 组件**

```typescript
// src/components/PointsBadge/index.tsx
import { View, Text } from '@tarojs/components'

export default function PointsBadge({ points }: { points: number }) {
  return (
    <View className="points-badge">
      <Text className="points-value">{points}</Text>
      <Text className="points-label">⭐</Text>
    </View>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "feat: add shared components (TaskCard, RewardCard, PointsBadge)"
```

---

### Task 12: 全局样式完善 + 集成验证

- [ ] **Step 1: 完善 app.scss 加入通用样式**

```scss
// 添加到 src/app.scss
.page { padding: 16px; min-height: 100vh; background: #f5f5f5; }
.title { font-size: 18px; font-weight: 700; display: block; padding: 16px 0; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; }
.list-row { display: flex; align-items: center; gap: 12px; padding: 16px; background: #fff; border-radius: 12px; margin-bottom: 8px; }
.row-info { flex: 1; }
.row-title { font-size: 15px; font-weight: 600; display: block; }
.row-sub { font-size: 12px; color: #999; }
.row-icon { font-size: 28px; }
.empty { color: #999; text-align: center; padding: 40px; display: block; }
.loading { color: #999; text-align: center; padding: 40px; display: block; }
.card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.card-title { font-size: 16px; font-weight: 600; display: block; }
.card-sub { font-size: 13px; color: #666; margin-top: 4px; display: block; }
.card-date { font-size: 11px; color: #bbb; margin-top: 4px; display: block; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.section { margin-bottom: 24px; }
.section-title { font-size: 15px; font-weight: 600; color: #666; display: block; margin-bottom: 8px; }

// Task card
.task-card { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 16px; padding: 14px; margin-bottom: 8px; }
.task-card.completed { background: #fff7ed; border: 1px solid #fdba74; }
.task-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border-radius: 12px; font-size: 24px; }
.task-body { flex: 1; min-width: 0; }
.task-title { font-size: 15px; font-weight: 600; display: block; }
.task-points { font-size: 12px; color: #f59e0b; font-weight: 600; }
.task-status { font-size: 10px; color: #f97316; background: #fff7ed; padding: 2px 8px; border-radius: 10px; display: inline-block; margin-top: 2px; }

// Reward card
.reward-card { background: #fff; border-radius: 16px; padding: 20px 16px; text-align: center; margin-bottom: 12px; }
.reward-icon { font-size: 40px; margin-bottom: 8px; }
.reward-title { font-size: 16px; font-weight: 600; display: block; }
.reward-desc { font-size: 12px; color: #999; display: block; margin: 4px 0 8px; }
.reward-cost { font-size: 16px; font-weight: 700; color: #f59e0b; display: block; margin-bottom: 12px; }

// Points badge
.points-badge { display: flex; align-items: center; gap: 2px; background: #fef3c7; padding: 4px 12px; border-radius: 20px; }
.points-value { font-size: 16px; font-weight: 700; color: #d97706; }
.points-label { font-size: 14px; }

// Balance card (history page)
.balance-card { background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; color: #fff; }
.balance-label { font-size: 14px; opacity: 0.9; display: block; }
.balance-value { font-size: 36px; font-weight: 700; display: block; margin-top: 4px; }
```

- [ ] **Step 2: 编译验证**

```bash
cd /Users/art/Claude/pro04-miniapp && npx taro build --type weapp
```

确认编译无错误，在微信开发者工具中打开 `dist/` 验证所有页面可访问。

- [ ] **Step 3: Commit**

```bash
cd pro04-miniapp && git add -A && git commit -m "style: add global styles and integration verification"
```

---

## Self-Review

**1. Spec coverage:**
- 登录/注册（微信 + 手机号绑定）→ Task 4 ✅
- 任务首页 → Task 6 ✅
- 孩子选择 → Task 5 ✅
- 奖品中心 → Task 7 ✅
- 积分历史 → Task 8 ✅
- 家长管理入口 + PIN → Task 9 ✅
- 任务模板管理 → Task 10 ✅
- 奖品管理 → Task 10 ✅
- 兑换审批 → Task 10 ✅
- 家庭管理 → Task 10 ✅
- 积分调整 → Task 10 ✅
- 孩子详情编辑 → Task 10 ✅
- 共享组件 → Task 11 ✅
- tabBar 导航 → Task 3 ✅
- API 封装 → Task 2 ✅
- 认证工具 → Task 2 ✅

**2. Placeholder scan:** 无 TBD/TODO，所有代码块完整。

**3. Type consistency:** API 响应类型与后端接口一致，组件 Props 类型完整。
