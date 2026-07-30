# pro04-server — Fastify API 后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 Next.js API Routes 拆出为独立的 Fastify v5 API 服务，新增微信登录，保留所有现有接口。

**Architecture:** Fastify v5 + mysql2 + @fastify/jwt + Zod。认证从 NextAuth 迁移到 JWT 自签，路由层从 NextRequest/NextResponse 改为 Fastify request/reply，SQL 逻辑从现有代码平移。

**Tech Stack:** TypeScript, Fastify v5, mysql2, @fastify/jwt, @fastify/cors, bcryptjs, Zod

---

## 文件结构

```
pro04-server/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── db/
│   └── init.sql                 # 从 prisma/migrations/init.sql 拷贝
├── src/
│   ├── server.ts                # 入口，启动 Fastify
│   ├── app.ts                   # Fastify 实例 + 插件注册
│   ├── lib/
│   │   ├── db.ts                # mysql2 连接池 + query/execute 助手
│   │   ├── auth.ts              # JWT 签发/验证，wx.code2Session
│   │   ├── age-group.ts         # 年龄组计算（从现有项目拷贝）
│   │   └── id.ts                # 生成 ID 的工具函数
│   ├── schemas/
│   │   └── index.ts             # 所有 Zod 校验 schema
│   └── routes/
│       ├── auth.ts              # 微信登录/手机登录/注册/验证PIN/选择孩子/登出
│       ├── tasks.ts             # 任务的 CRUD + complete/approve/deduct
│       ├── templates.ts         # 任务模板 CRUD
│       ├── rewards.ts           # 奖品 CRUD
│       ├── redemptions.ts       # 兑换 CRUD + approve/reject
│       ├── points.ts            # 积分查询 + 手动调整
│       └── family.ts            # 家庭信息 + 孩子管理
```

---

### Task 1: 项目脚手架

**Files:**
- Create: `pro04-server/package.json`
- Create: `pro04-server/tsconfig.json`
- Create: `pro04-server/.env.example`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "pro04-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/cors": "^10.0.0",
    "bcryptjs": "^3.0.3",
    "mysql2": "^3.23.2",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.0.0",
    "tsx": "^4.23.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 .env.example**

```
DATABASE_URL=mysql://root:password@localhost:3306/kids_reward
JWT_SECRET=change-me-to-random-string
WECHAT_APPID=your-wechat-appid
WECHAT_SECRET=your-wechat-secret
```

- [ ] **Step 4: 安装依赖并验证**

Run: `cd pro04-server && npm install`
Expected: 依赖安装成功，无错误

- [ ] **Step 5: Commit**

```bash
cd pro04-server && git init && git add -A && git commit -m "chore: scaffold Fastify project"
```

---

### Task 2: 数据库连接层

**Files:**
- Create: `pro04-server/src/lib/db.ts`
- Create: `pro04-server/src/lib/id.ts`

- [ ] **Step 1: 创建 ID 生成工具**

```typescript
// src/lib/id.ts
export function genId(prefix = "c"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
```

- [ ] **Step 2: 创建 db.ts（从现有项目平移）**

```typescript
// src/lib/db.ts
import mysql from "mysql2/promise"

let _pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (_pool) return _pool

  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error("DATABASE_URL is not set")

  const parsed = new URL(raw)
  _pool = mysql.createPool({
    host: parsed.hostname,
    port: Number(parsed.port || "3306"),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "+00:00",
  })
  return _pool
}

function norm(params: unknown[]): unknown[] {
  return params.map(p => p === undefined ? null : p)
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params ? norm(params) : undefined)
  return rows as T[]
}

export async function execute(sql: string, params?: unknown[]) {
  return getPool().execute(sql, params ? norm(params) as any : undefined)
}

export function pool() {
  return getPool()
}
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add db connection layer and id generator"
```

---

### Task 3: Fastify 应用入口

**Files:**
- Create: `pro04-server/src/app.ts`
- Create: `pro04-server/src/server.ts`

- [ ] **Step 1: 创建 app.ts**

```typescript
// src/app.ts
import Fastify from "fastify"
import fjwt from "@fastify/jwt"
import cors from "@fastify/cors"

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(fjwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  })

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: "未登录" })
    }
  })

  return app
}
```

- [ ] **Step 2: 创建 server.ts**

```typescript
// src/server.ts
import { buildApp } from "./app.js"

async function main() {
  const app = await buildApp()

  // 健康检查
  app.get("/api/health", async () => ({ status: "ok" }))

  // 路由将在后续 tasks 中注册

  const port = Number(process.env.PORT) || 3000
  await app.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening on port ${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: 启动确认**

Run: `cd pro04-server && npx tsx src/server.ts`
Expected: Server 启动，访问 `http://localhost:3000/api/health` 返回 `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add Fastify app entry with JWT and CORS"
```

---

### Task 4: 认证工具库

**Files:**
- Create: `pro04-server/src/lib/auth.ts`

- [ ] **Step 1: 创建 auth.ts**

```typescript
// src/lib/auth.ts
import type { FastifyInstance } from "fastify"

// 微信 code2Session 换取 openid
export async function wxCode2Session(code: string): Promise<{ openid: string }> {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) throw new Error("WECHAT_APPID/WECHAT_SECRET not set")

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
  const res = await fetch(url)
  const data = await res.json() as any
  if (data.errcode || !data.openid) {
    throw new Error(`wx.code2Session failed: ${data.errmsg || "unknown"}`)
  }
  return { openid: data.openid }
}

// 签发 JWT
export function signToken(app: FastifyInstance, payload: Record<string, unknown>) {
  return app.jwt.sign(payload, { expiresIn: "7d" })
}

// 扩展 Fastify 类型声明
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add auth utilities (JWT sign + wechat code2Session)"
```

---

### Task 5: Zod 校验 Schema

**Files:**
- Create: `pro04-server/src/schemas/index.ts`

- [ ] **Step 1: 创建所有 Zod schema**

```typescript
// src/schemas/index.ts
import { z } from "zod"

// Auth
export const wechatLoginSchema = z.object({ code: z.string().min(1) })
export const bindPhoneSchema = z.object({
  tempToken: z.string(),
  phone: z.string().min(1),
  password: z.string().min(6),
})
export const phoneLoginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
})
export const registerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  password: z.string().min(6),
})
export const verifyPinSchema = z.object({ pin: z.string().min(1) })
export const selectChildSchema = z.object({ childId: z.string().min(1) })

// Tasks
export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  points: z.number().int().optional(),
  type: z.string().optional(),
  assignedTo: z.string().min(1),
  templateId: z.string().optional(),
  dueDate: z.string().optional(),
})

// Templates
export const createTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  points: z.number().int().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
})
export const updateTemplateSchema = createTemplateSchema.extend({
  isActive: z.boolean().optional(),
})

// Rewards
export const createRewardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pointsCost: z.number().int().min(1),
  imageUrl: z.string().optional(),
})
export const updateRewardSchema = createRewardSchema.extend({
  isActive: z.boolean().optional(),
})

// Redemptions
export const createRedemptionSchema = z.object({
  rewardId: z.string().min(1),
  childId: z.string().optional(),
})
export const updateRedemptionSchema = z.object({
  action: z.enum(["approve", "reject"]),
})

// Points
export const adjustPointsSchema = z.object({
  childId: z.string().min(1),
  amount: z.number().int().refine(v => v !== 0, "积分变动额不能为 0"),
  reason: z.string().min(1),
})

// Family
export const createChildSchema = z.object({
  name: z.string().min(1),
  birthYear: z.number().int().optional(),
  birthMonth: z.number().int().optional(),
  avatarUrl: z.string().optional(),
})
export const updateChildSchema = createChildSchema
export const updateFamilySchema = z.object({ name: z.string().min(1) })
export const setPinSchema = z.object({
  pinCode: z.string().min(4, "PIN 码至少4位"),
})
```

- [ ] **Step 2: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add Zod validation schemas for all routes"
```

---

### Task 6: 认证路由 (auth.ts)

**Files:**
- Create: `pro04-server/src/routes/auth.ts`

- [ ] **Step 1: 创建 auth 路由**

```typescript
// src/routes/auth.ts
import type { FastifyInstance } from "fastify"
import bcrypt from "bcryptjs"
import { query, execute } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { signToken, wxCode2Session } from "../lib/auth.js"
import {
  wechatLoginSchema, bindPhoneSchema, phoneLoginSchema,
  registerSchema, verifyPinSchema, selectChildSchema,
} from "../schemas/index.js"

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/wechat-login — 微信登录
  app.post("/api/auth/wechat-login", async (req, reply) => {
    const { code } = wechatLoginSchema.parse(req.body)
    const { openid } = await wxCode2Session(code)

    const rows = await query<{ id: string; name: string; familyId: string; role: string; phone?: string }>(
      `SELECT id, name, familyId, role, phone FROM User WHERE wxOpenid = ? LIMIT 1`, [openid]
    )
    const user = rows[0]

    if (user) {
      const token = signToken(app, { sub: user.id, familyId: user.familyId, role: user.role })
      return { user: { id: user.id, name: user.name, role: user.role, familyId: user.familyId }, token, isNewUser: false }
    }

    // 新微信用户，签发临时 token（只能用于绑定手机号）
    const tempToken = signToken(app, { openid, familyId: null, role: "tmp" })
    return { tempToken, isNewUser: true }
  })

  // POST /api/auth/bind-phone — 微信用户绑定已有账号或创建新账号
  app.post("/api/auth/bind-phone", async (req, reply) => {
    const { tempToken, phone, password } = bindPhoneSchema.parse(req.body)

    // 验证临时 token
    let openid: string
    try {
      const decoded = app.jwt.verify(tempToken) as { openid: string }
      openid = decoded.openid
    } catch {
      return reply.status(401).send({ error: "临时 token 无效或已过期" })
    }

    // 查找手机号是否有已有账号
    const users = await query<{ id: string; passwordHash: string; familyId: string; role: string; name: string }>(
      `SELECT id, name, passwordHash, familyId, role FROM User WHERE phone = ? LIMIT 1`, [phone]
    )
    const existingUser = users[0]

    if (existingUser) {
      // 已有账号：验证密码，绑定微信
      const valid = await bcrypt.compare(password, existingUser.passwordHash)
      if (!valid) return reply.status(401).send({ error: "密码错误" })

      await execute(`UPDATE User SET wxOpenid = ? WHERE id = ?`, [openid, existingUser.id])

      const token = signToken(app, { sub: existingUser.id, familyId: existingUser.familyId, role: existingUser.role })
      return { user: { id: existingUser.id, name: existingUser.name, role: existingUser.role, familyId: existingUser.familyId }, token }
    }

    // 没有账号：创建新微信用户（本质上等同于注册一个新孩子／家长由注册流程决定）
    // 纯微信用户：创建 minimal 记录，后续可在设置中补充信息
    const id = genId()
    // 微信用户默认作为"孩子"创建，需要一个 family
    const familyId = genId()
    const now = new Date()
    await execute(`INSERT INTO Family (id, name, createdAt) VALUES (?, ?, ?)`, [familyId, "我的家庭", now])
    await execute(
      `INSERT INTO User (id, familyId, name, wxOpenid, role, updatedAt) VALUES (?, ?, ?, ?, 'child', ?)`,
      [id, familyId, "小朋友", openid, now]
    )

    const token = signToken(app, { sub: id, familyId, role: "child" })
    return { user: { id, name: "小朋友", role: "child", familyId }, token }
  })

  // POST /api/auth/phone-login — 手机号+密码登录（家长用）
  app.post("/api/auth/phone-login", async (req, reply) => {
    const { phone, password } = phoneLoginSchema.parse(req.body)

    const rows = await query<{ id: string; name: string; phone: string; passwordHash: string; familyId: string; role: string }>(
      `SELECT id, phone, passwordHash, name, familyId, role FROM User WHERE phone = ? LIMIT 1`, [phone]
    )
    const user = rows[0]
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: "手机号或密码错误" })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: "手机号或密码错误" })

    const token = signToken(app, { sub: user.id, familyId: user.familyId, role: user.role })
    return { user: { id: user.id, name: user.name, role: user.role, familyId: user.familyId }, token }
  })

  // POST /api/auth/register — 注册（家长）
  app.post("/api/auth/register", async (req, reply) => {
    const { name, phone, password } = registerSchema.parse(req.body)

    const existing = await query<{ id: string }>(`SELECT id FROM User WHERE phone = ?`, [phone])
    if (existing.length > 0) {
      return reply.status(409).send({ error: "该手机号已注册" })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const pinHash = await bcrypt.hash("1234", 10)
    const familyId = genId()
    const userId = genId()
    const now = new Date()

    await execute(`INSERT INTO Family (id, name, createdAt) VALUES (?, ?, ?)`, [familyId, `${name}的家庭`, now])
    await execute(
      `INSERT INTO User (id, familyId, name, phone, passwordHash, pinCode, role, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'parent', ?)`,
      [userId, familyId, name, phone, passwordHash, pinHash, now]
    )

    // 默认任务模板
    const defaultTemplates = [
      { title: "练琴 30 分钟", points: 5, category: "study", icon: "🎹" },
      { title: "阅读 20 分钟", points: 3, category: "study", icon: "📖" },
      { title: "整理书包", points: 2, category: "daily", icon: "🎒" },
      { title: "刷牙洗脸", points: 1, category: "daily", icon: "🪥" },
      { title: "帮忙做家务", points: 4, category: "chore", icon: "🧹" },
      { title: "扫地", points: 2, category: "chore", icon: "🧹" },
      { title: "写作业", points: 3, category: "study", icon: "✏️" },
      { title: "运动 30 分钟", points: 3, category: "daily", icon: "⚽" },
    ]
    for (const tpl of defaultTemplates) {
      await execute(
        `INSERT INTO TaskTemplate (id, familyId, title, points, category, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [genId(), familyId, tpl.title, tpl.points, tpl.category, tpl.icon, now]
      )
    }

    // 默认奖品
    const defaultRewards = [
      { title: "看动画片 30 分钟", pointsCost: 10, description: "可以看喜欢的动画片" },
      { title: "冰淇淋一个", pointsCost: 20, description: "周末去便利店挑一个冰淇淋" },
      { title: "游戏 1 小时", pointsCost: 30, description: "周末可以玩游戏" },
      { title: "新玩具", pointsCost: 100, description: "去玩具店挑一个喜欢的玩具" },
      { title: "去游乐园", pointsCost: 200, description: "周末去游乐园玩一天" },
      { title: "选一部电影", pointsCost: 15, description: "选一部喜欢的电影全家一起看" },
    ]
    for (const r of defaultRewards) {
      await execute(
        `INSERT INTO Reward (id, familyId, title, description, pointsCost, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [genId(), familyId, r.title, r.description, r.pointsCost, now]
      )
    }

    const token = signToken(app, { sub: userId, familyId, role: "parent" })
    return { user: { id: userId, name, role: "parent", familyId }, token }
  })

  // POST /api/auth/verify-pin — PIN 码验证
  app.post("/api/auth/verify-pin", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const { pin } = verifyPinSchema.parse(req.body)

    const rows = await query<{ pinCode: string }>(
      `SELECT pinCode FROM User WHERE familyId = ? AND role = 'parent' AND pinCode IS NOT NULL LIMIT 1`,
      [req.user.familyId]
    )
    const parent = rows[0]
    if (!parent?.pinCode) return reply.status(400).send({ error: "尚未设置 PIN 码" })

    const valid = await bcrypt.compare(pin, parent.pinCode)
    if (!valid) return reply.status(401).send({ error: "PIN 码错误" })

    // 签发一个带 viewMode=parent 的 token（30分钟有效）
    const token = signToken(app, { ...req.user, viewMode: "parent" })
    return { success: true, token }
  })

  // GET /api/auth/select-child — 获取选中孩子
  app.get("/api/auth/select-child", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    // 小程序端通过 header 传 selectedChildId，不再用 cookie
    const childId = req.headers["x-selected-child-id"]
    if (!childId) return reply.send(null)

    const rows = await query<{ id: string; name: string; ageGroup: string }>(
      `SELECT id, name, ageGroup FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    return reply.send(rows[0] ?? null)
  })

  // POST /api/auth/select-child — 设置选中孩子
  app.post("/api/auth/select-child", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const { childId } = selectChildSchema.parse(req.body)

    const rows = await query<{ id: string }>(
      `SELECT id FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    if (!rows[0]) return reply.status(404).send({ error: "小朋友不存在" })

    // 小程序端：直接返回 success + childId 让客户端自己存储
    return reply.send({ success: true, childId })
  })

  // POST /api/auth/logout — 登出
  app.post("/api/auth/logout", async () => {
    return { success: true }
  })

  // GET /api/auth/session — 获取当前 session
  app.get("/api/auth/session", async (req: any) => {
    try {
      await req.jwtVerify()
      return { user: req.user }
    } catch {
      return { user: null }
    }
  })
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

修改 `src/app.ts`，在 `return app` 前添加：
```typescript
import { authRoutes } from "./routes/auth.js"
// ...
await app.register(authRoutes)
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add auth routes (wechat login, phone login, register, pin, select child)"
```

---

### Task 7: 年龄组工具 + Task 路由

**Files:**
- Create: `pro04-server/src/lib/age-group.ts`（从现有项目拷贝）
- Create: `pro04-server/src/routes/tasks.ts`

- [ ] **Step 1: 拷贝 age-group.ts（内容不变）**

```typescript
// src/lib/age-group.ts — 直接从当前项目 src/lib/age-group.ts 拷贝
export type AgeGroup = "3-6" | "6-10" | "10-14"

export function computeAgeGroup(birthYear: number, birthMonth: number): AgeGroup {
  const now = new Date()
  const age = now.getFullYear() - birthYear - (now.getMonth() + 1 < birthMonth ? 1 : 0)
  if (age <= 6) return "3-6"
  if (age <= 10) return "6-10"
  return "10-14"
}

export type AgeGroupConfig = {
  iconSize: number
  showText: boolean
  animationIntensity: "high" | "medium" | "low"
  colorSaturation: "full" | "muted"
}

export const ageGroupConfigs: Record<AgeGroup, AgeGroupConfig> = {
  "3-6":  { iconSize: 40, showText: false, animationIntensity: "high",   colorSaturation: "full" },
  "6-10": { iconSize: 32, showText: true,  animationIntensity: "medium", colorSaturation: "full" },
  "10-14":{ iconSize: 24, showText: true,  animationIntensity: "low",    colorSaturation: "muted" },
}
```

- [ ] **Step 2: 创建 tasks 路由**

```typescript
// src/routes/tasks.ts
import type { FastifyInstance } from "fastify"
import { query, execute, pool } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { createTaskSchema } from "../schemas/index.js"

export async function taskRoutes(app: FastifyInstance) {

  // GET /api/tasks
  app.get("/api/tasks", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const { childId, date } = req.query as Record<string, string>
    const selectedChildId = childId || req.headers["x-selected-child-id"]

    let sql = `SELECT t.* FROM Task t WHERE t.familyId = ? AND t.status NOT IN ('approved', 'deducted', 'deleted')`
    const params: unknown[] = [req.user.familyId]

    if (selectedChildId) { sql += ` AND t.assignedTo = ?`; params.push(selectedChildId) }

    if (date) {
      const start = new Date(date)
      const end = new Date(date)
      end.setDate(end.getDate() + 1)
      sql += ` AND t.createdAt >= ? AND t.createdAt < ?`
      params.push(start, end)
    } else {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      sql += ` AND t.createdAt >= ?`
      params.push(weekAgo)
    }

    sql += ` ORDER BY t.createdAt DESC`
    const tasks = await query<{ assignedTo: string }>(sql, params)

    const enriched = await Promise.all(
      tasks.map(async (t) => {
        const users = await query<{ id: string; name: string }>(
          `SELECT id, name FROM User WHERE id = ?`, [t.assignedTo]
        )
        return { ...t, child: users[0] ?? null }
      })
    )
    return reply.send(enriched)
  })

  // POST /api/tasks — 创建任务（家长）
  app.post("/api/tasks", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { title, description, points, type, assignedTo, templateId, dueDate } = createTaskSchema.parse(req.body)
    const id = genId()
    const now = new Date()
    await execute(
      `INSERT INTO Task (id, familyId, templateId, title, description, points, type, status, assignedTo, createdBy, dueDate, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, req.user.familyId, templateId ?? null, title, description ?? null, points ?? 1, type ?? "once", assignedTo, req.user.sub, dueDate ? new Date(dueDate) : null, now]
    )
    const rows = await query(`SELECT * FROM Task WHERE id = ?`, [id])
    return reply.send(rows[0])
  })

  // DELETE /api/tasks/:id
  app.delete("/api/tasks/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const rows = await query<{ id: string; status: string }>(
      `SELECT id, status FROM Task WHERE id = ? AND familyId = ? LIMIT 1`, [id, req.user.familyId]
    )
    const task = rows[0]
    if (!task) return reply.status(404).send({ error: "任务不存在" })
    if (task.status === "approved" || task.status === "deducted") {
      return reply.status(400).send({ error: "已处理的任务不能删除" })
    }
    await execute(`UPDATE Task SET status = 'deleted' WHERE id = ?`, [id])
    return reply.send({ success: true })
  })

  // POST /api/tasks/:id/complete — 完成任务
  app.post("/api/tasks/:id/complete", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const { id } = req.params

    const rows = await query<{ id: string; familyId: string; status: string }>(
      `SELECT * FROM Task WHERE id = ?`, [id]
    )
    const task = rows[0]
    if (!task || task.familyId !== req.user.familyId) return reply.status(404).send({ error: "任务不存在" })
    if (task.status !== "pending") return reply.status(400).send({ error: "任务已完成" })

    const now = new Date()
    await execute(`UPDATE Task SET status = 'completed', completedAt = ?, updatedAt = ? WHERE id = ?`, [now, now, id])
    const updated = await query(`SELECT * FROM Task WHERE id = ?`, [id])
    return reply.send(updated[0])
  })

  // POST /api/tasks/:id/approve — 审核通过
  app.post("/api/tasks/:id/approve", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const rows = await query<{ id: string; familyId: string; assignedTo: string; points: number; title: string; status: string }>(
      `SELECT * FROM Task WHERE id = ?`, [id]
    )
    const task = rows[0]
    if (!task || task.familyId !== req.user.familyId) return reply.status(404).send({ error: "任务不存在" })
    if (task.status !== "completed") return reply.status(400).send({ error: "任务尚未完成" })

    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()
      const now = new Date()
      await conn.execute(`UPDATE Task SET status = 'approved', updatedAt = ? WHERE id = ?`, [now, id])
      await conn.execute(
        `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'task_reward', ?, ?, ?)`,
        [genId("pts"), task.familyId, task.assignedTo, task.points, `完成任务: ${task.title}`, task.id, now]
      )
      await conn.commit()
      const updated = await query(`SELECT * FROM Task WHERE id = ?`, [id])
      return reply.send(updated[0])
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  })

  // POST /api/tasks/:id/deduct — 扣除积分
  app.post("/api/tasks/:id/deduct", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const rows = await query<{ id: string; familyId: string; assignedTo: string; points: number; title: string; status: string }>(
      `SELECT * FROM Task WHERE id = ?`, [id]
    )
    const task = rows[0]
    if (!task || task.familyId !== req.user.familyId) return reply.status(404).send({ error: "任务不存在" })
    if (task.status !== "pending") return reply.status(400).send({ error: "该任务无需扣分" })

    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()
      const now = new Date()
      await conn.execute(
        `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'manual_sub', ?, ?, ?)`,
        [genId("pts"), task.familyId, task.assignedTo, -task.points, `未完成任务: ${task.title}`, task.id, now]
      )
      await conn.execute(`UPDATE Task SET status = 'deducted', updatedAt = ? WHERE id = ?`, [now, id])
      await conn.commit()
      const updated = await query(`SELECT * FROM Task WHERE id = ?`, [id])
      return reply.send(updated[0])
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  })

  // GET /api/tasks/review — 审核列表
  app.get("/api/tasks/review", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { childId } = req.query as Record<string, string>
    if (!childId) return reply.status(400).send({ error: "缺少 childId" })

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const allTasks = await query(
      `SELECT id, title, points, type, status, completedAt, createdAt FROM Task WHERE familyId = ? AND assignedTo = ? AND createdAt >= ? AND status IN ('pending', 'completed') ORDER BY createdAt DESC`,
      [req.user.familyId, childId, weekAgo]
    )
    const childRows = await query<{ id: string; name: string; ageGroup: string }>(
      `SELECT id, name, ageGroup FROM User WHERE id = ? LIMIT 1`, [childId]
    )
    return reply.send({ child: childRows[0] ?? null, tasks: allTasks })
  })
}
```

- [ ] **Step 3: 在 app.ts 中注册路由**

```typescript
import { taskRoutes } from "./routes/tasks.js"
// ...
await app.register(taskRoutes)
```

- [ ] **Step 4: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add task routes (CRUD + complete/approve/deduct/review)"
```

---

### Task 8: 模板路由

**Files:**
- Create: `pro04-server/src/routes/templates.ts`

- [ ] **Step 1: 创建 templates 路由**

```typescript
// src/routes/templates.ts
import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { createTemplateSchema, updateTemplateSchema } from "../schemas/index.js"

export async function templateRoutes(app: FastifyInstance) {

  app.get("/api/templates", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const templates = await query(
      `SELECT * FROM TaskTemplate WHERE familyId = ? AND isActive = 1 ORDER BY createdAt ASC`,
      [req.user.familyId]
    )
    return reply.send(templates)
  })

  app.post("/api/templates", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { title, description, points, category, icon } = createTemplateSchema.parse(req.body)
    const id = genId()
    const now = new Date()
    await execute(
      `INSERT INTO TaskTemplate (id, familyId, title, description, points, category, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.familyId, title, description ?? null, points ?? 1, category ?? "daily", icon ?? "⭐", now]
    )
    const rows = await query(`SELECT * FROM TaskTemplate WHERE id = ?`, [id])
    return reply.send(rows[0])
  })

  app.put("/api/templates/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const { title, description, points, category, icon, isActive } = updateTemplateSchema.parse(req.body)
    const now = new Date()
    await execute(
      `UPDATE TaskTemplate SET title = ?, description = ?, points = ?, category = ?, icon = ?, isActive = ?, updatedAt = ? WHERE id = ? AND familyId = ?`,
      [title, description, points, category, icon, isActive, now, id, req.user.familyId]
    )
    const rows = await query(`SELECT * FROM TaskTemplate WHERE id = ?`, [id])
    return reply.send(rows[0])
  })

  app.delete("/api/templates/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    await execute(`UPDATE TaskTemplate SET isActive = 0 WHERE id = ? AND familyId = ?`, [req.params.id, req.user.familyId])
    return reply.send({ success: true })
  })
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

```typescript
import { templateRoutes } from "./routes/templates.js"
await app.register(templateRoutes)
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add template routes (CRUD)"
```

---

### Task 9: 奖品路由

**Files:**
- Create: `pro04-server/src/routes/rewards.ts`

- [ ] **Step 1: 创建 rewards 路由**

```typescript
// src/routes/rewards.ts
import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { createRewardSchema, updateRewardSchema } from "../schemas/index.js"

export async function rewardRoutes(app: FastifyInstance) {

  app.get("/api/rewards", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const rewards = await query(
      `SELECT * FROM Reward WHERE familyId = ? AND isActive = 1 ORDER BY pointsCost ASC`,
      [req.user.familyId]
    )
    return reply.send(rewards)
  })

  app.post("/api/rewards", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { title, description, pointsCost, imageUrl } = createRewardSchema.parse(req.body)
    const id = genId()
    const now = new Date()
    await execute(
      `INSERT INTO Reward (id, familyId, title, description, pointsCost, imageUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.familyId, title, description ?? null, pointsCost, imageUrl ?? null, now]
    )
    const rows = await query(`SELECT * FROM Reward WHERE id = ?`, [id])
    return reply.send(rows[0])
  })

  app.put("/api/rewards/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const { title, description, pointsCost, imageUrl, isActive } = updateRewardSchema.parse(req.body)
    const now = new Date()
    await execute(
      `UPDATE Reward SET title = ?, description = ?, pointsCost = ?, imageUrl = ?, isActive = ?, updatedAt = ? WHERE id = ? AND familyId = ?`,
      [title, description, pointsCost, imageUrl, isActive, now, id, req.user.familyId]
    )
    const rows = await query(`SELECT * FROM Reward WHERE id = ?`, [id])
    return reply.send(rows[0])
  })
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

```typescript
import { rewardRoutes } from "./routes/rewards.js"
await app.register(rewardRoutes)
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add reward routes (CRUD)"
```

---

### Task 10: 兑换路由

**Files:**
- Create: `pro04-server/src/routes/redemptions.ts`

- [ ] **Step 1: 创建 redemptions 路由**

```typescript
// src/routes/redemptions.ts
import type { FastifyInstance } from "fastify"
import { query, execute, pool } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { createRedemptionSchema, updateRedemptionSchema } from "../schemas/index.js"

export async function redemptionRoutes(app: FastifyInstance) {

  app.get("/api/redemptions", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const { status } = req.query as Record<string, string>
    let sql = `SELECT r.* FROM Redemption r WHERE r.familyId = ?`
    const params: unknown[] = [req.user.familyId]

    if (status) { sql += ` AND r.status = ?`; params.push(status) }

    const childId = req.headers["x-selected-child-id"]
    if (req.user.role === "child") {
      sql += ` AND r.childId = ?`; params.push(req.user.sub)
    } else if (childId) {
      sql += ` AND r.childId = ?`; params.push(childId)
    }

    sql += ` ORDER BY r.createdAt DESC`
    const redemptions = await query<{ childId: string; rewardId: string }>(sql, params)

    const enriched = await Promise.all(
      redemptions.map(async (r) => {
        const [child, reward] = await Promise.all([
          query<{ id: string; name: string }>(`SELECT id, name FROM User WHERE id = ?`, [r.childId]),
          query<{ id: string; title: string; pointsCost: number }>(`SELECT id, title, pointsCost FROM Reward WHERE id = ?`, [r.rewardId]),
        ])
        return { ...r, child: child[0] ?? null, reward: reward[0] ?? null }
      })
    )
    return reply.send(enriched)
  })

  app.post("/api/redemptions", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const { rewardId, childId } = createRedemptionSchema.parse(req.body)

    const rewards = await query<{ id: string; familyId: string; pointsCost: number }>(
      `SELECT * FROM Reward WHERE id = ?`, [rewardId]
    )
    const reward = rewards[0]
    if (!reward || reward.familyId !== req.user.familyId) return reply.status(404).send({ error: "奖品不存在" })

    const actualChildId = req.user.role === "child"
      ? req.user.sub
      : (childId || req.headers["x-selected-child-id"])
    if (!actualChildId) return reply.status(400).send({ error: "请选择小朋友" })

    const balanceRows = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM PointsTransaction WHERE familyId = ? AND userId = ?`,
      [req.user.familyId, actualChildId]
    )
    if (Number(balanceRows[0].total) < reward.pointsCost) {
      return reply.status(400).send({ error: "积分不足" })
    }

    const id = genId()
    await execute(
      `INSERT INTO Redemption (id, familyId, childId, rewardId, pointsSpent, status, createdAt) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, req.user.familyId, actualChildId, rewardId, reward.pointsCost, new Date()]
    )
    const rows = await query(`SELECT * FROM Redemption WHERE id = ?`, [id])
    return reply.send(rows[0])
  })

  app.put("/api/redemptions/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const { action } = updateRedemptionSchema.parse(req.body)

    const rows = await query<{ id: string; familyId: string; childId: string; pointsSpent: number; status: string }>(
      `SELECT * FROM Redemption WHERE id = ?`, [id]
    )
    const redemption = rows[0]
    if (!redemption || redemption.familyId !== req.user.familyId) return reply.status(404).send({ error: "兑换记录不存在" })
    if (redemption.status !== "pending") return reply.status(400).send({ error: "该兑换已处理" })

    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()
      const now = new Date()
      const newStatus = action === "approve" ? "approved" : "rejected"
      await conn.execute(`UPDATE Redemption SET status = ?, resolvedAt = ? WHERE id = ?`, [newStatus, now, id])

      if (action === "approve") {
        await conn.execute(
          `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'redeem', ?, ?, ?)`,
          [genId("pts"), redemption.familyId, redemption.childId, -redemption.pointsSpent, `兑换: ${id}`, id, now]
        )
      }
      await conn.commit()
      const updated = await query(`SELECT * FROM Redemption WHERE id = ?`, [id])
      return reply.send(updated[0])
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  })
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

```typescript
import { redemptionRoutes } from "./routes/redemptions.js"
await app.register(redemptionRoutes)
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add redemption routes (list + create + approve/reject)"
```

---

### Task 11: 积分路由

**Files:**
- Create: `pro04-server/src/routes/points.ts`

- [ ] **Step 1: 创建 points 路由**

```typescript
// src/routes/points.ts
import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { adjustPointsSchema } from "../schemas/index.js"

export async function pointsRoutes(app: FastifyInstance) {

  app.get("/api/points", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const { childId } = req.query as Record<string, string>
    const selectedChildId = childId || req.headers["x-selected-child-id"]

    let userId: string
    if (selectedChildId) {
      userId = selectedChildId
    } else if (req.user.role === "child") {
      userId = req.user.sub
    } else {
      return reply.send({ balance: 0, transactions: [] })
    }

    const balanceRows = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM PointsTransaction WHERE familyId = ? AND userId = ?`,
      [req.user.familyId, userId]
    )

    const transactions = await query(
      `SELECT * FROM PointsTransaction WHERE familyId = ? AND userId = ? ORDER BY createdAt DESC LIMIT 50`,
      [req.user.familyId, userId]
    )

    return reply.send({ balance: Number(balanceRows[0].total), transactions })
  })

  app.post("/api/points", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { childId, amount, reason } = adjustPointsSchema.parse(req.body)
    const id = genId("pts")
    const type = amount > 0 ? "manual_add" : "manual_sub"

    await execute(
      `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.familyId, childId, amount, type, reason, new Date()]
    )
    const rows = await query(`SELECT * FROM PointsTransaction WHERE id = ?`, [id])
    return reply.send(rows[0])
  })
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

```typescript
import { pointsRoutes } from "./routes/points.js"
await app.register(pointsRoutes)
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add points routes (query + manual adjust)"
```

---

### Task 12: 家庭路由

**Files:**
- Create: `pro04-server/src/routes/family.ts`

- [ ] **Step 1: 创建 family 路由**

```typescript
// src/routes/family.ts
import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db.js"
import { genId } from "../lib/id.js"
import { computeAgeGroup } from "../lib/age-group.js"
import { updateFamilySchema, createChildSchema, updateChildSchema, setPinSchema } from "../schemas/index.js"
import bcrypt from "bcryptjs"

export async function familyRoutes(app: FastifyInstance) {

  app.get("/api/family", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const families = await query<{ id: string; name: string; createdAt: string }>(
      `SELECT * FROM Family WHERE id = ?`, [req.user.familyId]
    )
    const family = families[0]
    if (!family) return reply.status(404).send({ error: "家庭不存在" })

    const users = await query<{ id: string; name: string; role: string; ageGroup: string; avatarUrl: string; createdAt: string }>(
      `SELECT id, name, role, ageGroup, avatarUrl, createdAt FROM User WHERE familyId = ?`,
      [req.user.familyId]
    )
    return reply.send({ ...family, users })
  })

  app.put("/api/family", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { name } = updateFamilySchema.parse(req.body)
    await execute(`UPDATE Family SET name = ? WHERE id = ?`, [name, req.user.familyId])
    const rows = await query(`SELECT * FROM Family WHERE id = ?`, [req.user.familyId])
    return reply.send(rows[0])
  })

  // POST /api/family/children — 添加孩子
  app.post("/api/family/children", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { name, birthYear, birthMonth, avatarUrl } = createChildSchema.parse(req.body)
    const ageGroup = birthYear && birthMonth ? computeAgeGroup(birthYear, birthMonth) : null
    const id = genId()

    await execute(
      `INSERT INTO User (id, familyId, name, role, ageGroup, avatarUrl, updatedAt) VALUES (?, ?, ?, 'child', ?, ?, ?)`,
      [id, req.user.familyId, name, ageGroup, avatarUrl, new Date()]
    )
    return reply.send({ id, familyId: req.user.familyId, name, role: "child", ageGroup, avatarUrl })
  })

  // PUT /api/family/children — 设置 PIN 码
  app.put("/api/family/children", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { pinCode } = setPinSchema.parse(req.body)
    const hashedPin = await bcrypt.hash(pinCode, 10)
    await execute(`UPDATE User SET pinCode = ? WHERE familyId = ? AND role = 'parent'`, [hashedPin, req.user.familyId])
    return reply.send({ success: true })
  })

  // PUT /api/family/children/:id — 编辑孩子
  app.put("/api/family/children/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const { name, birthYear, birthMonth, avatarUrl } = updateChildSchema.parse(req.body)
    const ageGroup = birthYear && birthMonth ? computeAgeGroup(birthYear, birthMonth) : undefined
    const now = new Date()

    await execute(
      `UPDATE User SET name = ?, ageGroup = ?, avatarUrl = ?, updatedAt = ? WHERE id = ? AND familyId = ?`,
      [name, ageGroup ?? null, avatarUrl ?? null, now, id, req.user.familyId]
    )
    const rows = await query(`SELECT * FROM User WHERE id = ?`, [id])
    return reply.send(rows[0])
  })
}
```

- [ ] **Step 2: 在 app.ts 中注册所有路由**

完善后的 `src/app.ts` 应该是：
```typescript
import Fastify from "fastify"
import fjwt from "@fastify/jwt"
import cors from "@fastify/cors"
import { authRoutes } from "./routes/auth.js"
import { taskRoutes } from "./routes/tasks.js"
import { templateRoutes } from "./routes/templates.js"
import { rewardRoutes } from "./routes/rewards.js"
import { redemptionRoutes } from "./routes/redemptions.js"
import { pointsRoutes } from "./routes/points.js"
import { familyRoutes } from "./routes/family.js"

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(fjwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  })

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: "未登录" })
    }
  })

  await app.register(authRoutes)
  await app.register(taskRoutes)
  await app.register(templateRoutes)
  await app.register(rewardRoutes)
  await app.register(redemptionRoutes)
  await app.register(pointsRoutes)
  await app.register(familyRoutes)

  return app
}
```

- [ ] **Step 3: Commit**

```bash
cd pro04-server && git add -A && git commit -m "feat: add family routes (family + children CRUD + PIN)"
```

---

### Task 13: Docker + 数据库迁移

**Files:**
- Create: `pro04-server/Dockerfile`
- Create: `pro04-server/docker-compose.yml`
- Create: `pro04-server/db/init.sql`

- [ ] **Step 1: 拷贝数据库 DDL**

从现有项目 `pro04/prisma/migrations/init.sql` 完整拷贝到 `pro04-server/db/init.sql`，然后在文件末尾添加：

```sql
-- 微信小程序迁移：新增字段
ALTER TABLE User ADD COLUMN IF NOT EXISTS wxOpenid VARCHAR(191) NULL UNIQUE;
ALTER TABLE User MODIFY COLUMN phone VARCHAR(191) NULL;
ALTER TABLE User MODIFY COLUMN passwordHash VARCHAR(191) NULL;
```

- [ ] **Step 2: 创建 Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: 创建 docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://root:${DB_PASSWORD:-pro04pass}@db:3306/kids_reward
      - JWT_SECRET=${JWT_SECRET:-dev-secret-change-me}
      - WECHAT_APPID=${WECHAT_APPID:-}
      - WECHAT_SECRET=${WECHAT_SECRET:-}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD:-pro04pass}
      MYSQL_DATABASE: kids_reward
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./db/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_PASSWORD:-pro04pass}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  mysql_data:
```

- [ ] **Step 4: Commit**

```bash
cd pro04-server && git add -A && git commit -m "chore: add Dockerfile, docker-compose, and DB migration"
```

---

### Task 14: 集成验证

- [ ] **Step 1: 确保 .env 正确**

```bash
cp .env.example .env
# 编辑 .env 填入实际数据库连接和 JWT_SECRET
```

- [ ] **Step 2: 启动服务器并测试关键端点**

```bash
# 启动
npm run dev

# 健康检查
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}

# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","phone":"13800138000","password":"123456"}'
# Expected: { user: { ... }, token: "..." }

# 手机登录
curl -X POST http://localhost:3000/api/auth/phone-login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"123456"}'
# Expected: { user: { ... }, token: "..." }   ← 确认返回 token
```

- [ ] **Step 3: 用 jwtVerify 保护的路由测试**

```bash
TOKEN="<从上一步拿到的 token>"
curl http://localhost:3000/api/family \
  -H "Authorization: Bearer $TOKEN"
# Expected: { id: "...", name: "...的家庭", users: [...] }
```

- [ ] **Step 4: 修复发现的问题，确保所有端点可用**

- [ ] **Step 5: Commit**

```bash
cd pro04-server && git add -A && git commit -m "chore: integration verification and fixes"
```

---

## Self-Review

**1. Spec coverage:**
- 微信登录 (wechat-login) → Task 6 ✅
- 手机绑定 (bind-phone) → Task 6 ✅
- 手机登录 (phone-login) → Task 6 ✅
- 注册 (register) → Task 6 ✅
- 验证 PIN → Task 6 ✅
- 选择孩子 → Task 6 ✅
- 登出 → Task 6 ✅
- 所有任务端点 → Task 7 ✅
- 任务审核 (review) → Task 7 ✅
- 所有模板端点 → Task 8 ✅
- 所有奖品端点 → Task 9 ✅
- 所有兑换端点 → Task 10 ✅
- 积分查询+调整 → Task 11 ✅
- 家庭+孩子管理 → Task 12 ✅
- DB 字段变更 (wxOpenid) → Task 13 ✅
- Docker 部署 → Task 13 ✅

**2. Placeholder scan:** 无 TBD/TODO，每个步骤包含完整代码。

**3. Type consistency:**
- JWT payload 字段 `sub`, `familyId`, `role` 在各路由中一致使用 ✅
- `req.user` 结构在 auth middleware 中定义为 JWT payload ✅
- `genId()` 调用方式一致 ✅
- 所有 schema 的字段名与 SQL 查询参数匹配 ✅
