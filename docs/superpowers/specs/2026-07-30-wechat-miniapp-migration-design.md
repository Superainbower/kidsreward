# 微信小程序迁移 — 设计文档

> 日期: 2026-07-30 | 状态: 已确认

## 1. 概述

将「奖励小助手」（Next.js 16 Web 应用）迁移为微信小程序 + 独立 Fastify API 后端。

### 当前项目分析

| 维度 | 现状 |
|------|------|
| 技术栈 | Next.js 16 (App Router) + React 19 + TypeScript |
| 数据库 | MySQL 8.0，mysql2 原始 SQL |
| 认证 | NextAuth v5 (JWT)，手机号+密码登录 |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) |
| 部署 | Docker (docker-compose) |
| 数据模型 | Family → User (家长/孩子) → Task/TaskTemplate/Reward/PointsTransaction/Redemption |
| 页面 | 登录/注册、任务首页、奖品兑换、积分历史、家长管理、孩子选择 |

### 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 小程序框架 | **Taro 4.x (React)** | 复用 React 知识，hooks 可平移，多端编译能力 |
| 后端框架 | **Fastify v5** | 性能高、TS 原生、内置 JSON Schema、生态轻量 |
| 认证方案 | **微信登录 + 手机号绑定** | 新用户微信一键登录，已有用户绑定手机号关联 |
| 项目管理 | **分仓独立部署** | 小程序和后端各一个单独仓库 |

---

## 2. 后端设计 — Fastify API 服务 (pro04-server)

### 技术选型

| 项 | 选型 |
|---|---|
| 框架 | Fastify v5 |
| 数据库 | mysql2（现有连接池代码平移） |
| 认证 | `@fastify/jwt` + 微信 `wx.login` |
| 请求验证 | Zod |
| 部署 | Docker + docker-compose |
| 代码来源 | 从当前 Next.js 项目拆出 API Routes 逻辑 |

### API 路由（保留路径和响应格式）

#### 新增
```
POST   /api/auth/wechat-login      wx.login code 换 JWT token
POST   /api/auth/bind-phone        微信用户绑定已有手机号账号
```

#### 保留
```
POST   /api/auth/phone-login       手机号+密码登录
POST   /api/auth/register          家长注册
GET    /api/auth/select-child      获取当前选中的孩子
POST   /api/auth/verify-pin        验证家长 PIN
POST   /api/auth/logout            退出登录

GET    /api/tasks                  获取任务列表
POST   /api/tasks                  创建任务（家长）
POST   /api/tasks/:id/complete     完成任务（孩子）
POST   /api/tasks/:id/approve      审核通过（家长）
POST   /api/tasks/:id/deduct       扣除积分（家长）

GET    /api/rewards                获取奖品列表
POST   /api/rewards                创建奖品（家长）
PUT    /api/rewards/:id            编辑奖品

GET    /api/redemptions            获取兑换记录
POST   /api/redemptions            发起兑换（孩子）
PUT    /api/redemptions/:id        处理兑换（家长）

GET    /api/points                 获取积分余额

GET    /api/templates              获取任务模板
POST   /api/templates              创建模板（家长）
PUT    /api/templates/:id          编辑模板

GET    /api/family                 获取家庭信息
POST   /api/family/children        添加孩子
PUT    /api/family/children/:id    编辑孩子信息
```

### 认证中间件

两种认证方式共存：

```typescript
// token: JWT（微信登录后签发 或 手机号登录后签发）
fastify.decorate("authenticate", async (request) => {
  const token = request.headers.authorization?.replace("Bearer ", "")
  if (!token) throw new Error("未登录")
  return fastify.jwt.verify(token)
})
```

### 数据库变更

```sql
ALTER TABLE User ADD COLUMN wxOpenid VARCHAR(191) NULL UNIQUE;
ALTER TABLE User MODIFY COLUMN phone VARCHAR(191) NULL;
ALTER TABLE User MODIFY COLUMN passwordHash VARCHAR(191) NULL;
```

- `wxOpenid` — 微信小程序唯一标识
- `phone`/`passwordHash` 改为可选 — 纯微信用户不需要密码
- 家长注册时 phone 和 passwordHash 仍然必填

### 微信登录流程

```
wx.login() 获取 code
  → POST /api/auth/wechat-login { code }
  → 后端: code → wx API → openid
  → 查询 User.wxOpenid
     ├── 已存在 → 签发 JWT, isNewUser: false
     └── 不存在 → 创建临时 token, isNewUser: true
         → 客户端引导绑定手机号
            ├── A) 绑定已有账号（输入手机号+密码验证 → 写入 wxOpenid）
            └── B) 创建新账号（跳过，纯微信用户）
```

---

## 3. 前端设计 — Taro 微信小程序 (pro04-miniapp)

### 技术选型

| 项 | 选型 |
|---|---|
| 框架 | Taro 4.x + React 18 |
| UI 组件库 | NutUI React Taro |
| 样式 | SCSS Modules |
| HTTP 请求 | `Taro.request` 封装 |

### 页面映射

| 当前 Next.js 页面 | Taro 小程序页面 |
|---|---|
| `/login` | `pages/login/index` |
| `/` (首页) | `pages/index/index` |
| `/select-child` | `pages/select-child/index` |
| `/rewards` | `pages/rewards/index` |
| `/history` | `pages/history/index` |
| `/manage` | `pages/manage/index` (PIN 验证入口) |
| `/manage/tasks` | `pages/manage/tasks/index` |
| `/manage/rewards` | `pages/manage/rewards/index` |
| `/manage/redemptions` | `pages/manage/redemptions/index` |
| `/manage/family` | `pages/manage/family/index` |
| `/manage/points` | `pages/manage/points/index` |
| `/manage/children/[id]` | `pages/manage/children/detail/index` |

### 组件映射

| 当前 (shadcn/ui) | 小程序 (NutUI) |
|---|---|
| `Button` | `nut-button` |
| `Input` | `nut-input` |
| `Card` | `nut-cell` / `nut-card` |
| `Dialog` | `nut-dialog` |
| `Badge` | `nut-badge` |
| `Avatar` | `nut-avatar` |
| `Tabs` | `nut-tabs` |
| `Select` | `nut-picker` |
| `BottomNav` | `nut-tabbar` |
| `PointsBadge` | 自写组件 |
| `TaskCard` | 自写组件 |
| `RewardCard` | 自写组件 |
| `PinDialog` | `nut-dialog` + `nut-password-input` |

### 小程序登录流程

```
小程序启动
  → 检查本地 token 是否有效
  → 有效 → 直接进入首页
  → 无效 → wx.login() 获取 code
    → POST /api/auth/wechat-login { code }
    → 后端返回 { user, token, isNewUser }
    → isNewUser === false → 存储 token，进入首页
    → isNewUser === true → 显示绑定/创建页面
      → A) 绑定已有账号（输入手机号+密码）
      → B) 创建新微信账号（仅需要昵称）
      → 重新调用 login 获取正式 token
```

### API 调用封装

```typescript
// services/api.ts
const BASE = 'https://api.xxx.com'

async function request<T>(path: string, options?: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
}): Promise<T> {
  const res = await Taro.request({
    url: BASE + path,
    method: options?.method || 'GET',
    data: options?.data,
    header: {
      'Authorization': `Bearer ${Taro.getStorageSync('token')}`,
    },
  })
  return res.data as T
}
```

### 底部导航 (tabBar)

```json
{
  "list": [
    { "pagePath": "pages/index/index", "text": "任务", "iconPath": "..." },
    { "pagePath": "pages/rewards/index", "text": "奖品", "iconPath": "..." },
    { "pagePath": "pages/history/index", "text": "记录", "iconPath": "..." },
    { "pagePath": "pages/manage/index", "text": "管理", "iconPath": "..." }
  ]
}
```

---

## 4. 数据模型（不变）

```
Family -------< User (parent/child)
                  |
                  +--< Task (assignedTo)
                  |
                  +--< PointsTransaction (userId)
                  |
                  +--< Redemption (childId)

TaskTemplate --< Task (templateId)
Reward --------< Redemption (rewardId)
```

7 张表：Family, User, TaskTemplate, Task, PointsTransaction, Reward, Redemption

唯一变更：User 表新增 `wxOpenid`，`phone`/`passwordHash` 改为可选。

---

## 5. 迁移步骤

无需考虑服务中断，直接全新构建：

1. **创建 pro04-server** — 拆出后端，Fastify 重写路由层，复用 mysql2 和 SQL 逻辑
2. **创建 pro04-miniapp** — Taro 初始化，逐页面构建，对接后端 API
3. **数据库升级** — DDL 加 `wxOpenid` 字段

---

## 6. 边界

- 不迁移 Web 端（当前 Next.js 项目归档留存）
- 不新建 H5 版本（需要时 Taro 可编译输出）
- 不做离线缓存（第一版只做在线模式）
- 不做消息推送（小程序订阅消息后续迭代）

---

## 7. 附录：当前项目文件清单

### 前端层（将重写为 Taro 小程序）
- `src/app/page.tsx` — 任务首页
- `src/app/login/page.tsx` — 登录/注册
- `src/app/select-child/page.tsx` — 孩子选择
- `src/app/rewards/page.tsx` — 奖品中心
- `src/app/history/page.tsx` — 积分历史
- `src/app/manage/*.tsx` — 家长管理面板
- `src/components/bottom-nav.tsx`
- `src/components/pin-dialog.tsx`
- `src/components/age-adaptive.tsx`
- `src/components/task-card.tsx`
- `src/components/points-badge.tsx`
- `src/components/reward-card.tsx`
- `src/components/ui/*.tsx` — shadcn 组件

### 后端层（将迁移到 Fastify）
- `src/lib/db.ts` — mysql2 连接池
- `src/lib/auth.ts` — NextAuth 配置
- `src/lib/age-group.ts` — 年龄组工具
- `src/app/api/auth/` — 认证路由
- `src/app/api/tasks/` — 任务路由
- `src/app/api/rewards/` — 奖品路由
- `src/app/api/templates/` — 模板路由
- `src/app/api/redemptions/` — 兑换路由
- `src/app/api/points/` — 积分路由
- `src/app/api/family/` — 家庭路由

### 保留不变
- `prisma/migrations/init.sql` — 数据库 DDL
- `docker-compose.yml` — Docker 编排（调整后）
