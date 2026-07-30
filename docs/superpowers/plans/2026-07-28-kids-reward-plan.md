# 小朋友学习奖励小程序 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建面向家庭的小朋友学习奖励 Web 应用 — 家长布置任务、小朋友打卡赚积分、积分兑换奖品。

**Architecture:** Next.js 16 App Router 全栈应用。Prisma + MySQL 做数据持久化，NextAuth.js 做认证，shadcn/ui 做组件库。双模式视图（儿童/家长）通过 session 中的 viewMode + PIN 切换实现，不做两套独立应用。

**Tech Stack:** Next.js 16, TypeScript, Prisma + MySQL, NextAuth.js, shadcn/ui (Tailwind CSS v4), bcryptjs

---

## 文件结构总览

```
pro04/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 儿童首页（今日任务）
│   │   ├── rewards/page.tsx        # 奖品商店
│   │   ├── history/page.tsx        # 积分历史
│   │   ├── login/page.tsx          # 登录/注册
│   │   ├── manage/
│   │   │   ├── page.tsx            # 家长看板
│   │   │   ├── tasks/page.tsx      # 任务管理
│   │   │   ├── rewards/page.tsx    # 奖品管理
│   │   │   ├── points/page.tsx     # 积分管理
│   │   │   ├── redemptions/page.tsx # 兑换审核
│   │   │   └── family/page.tsx     # 家庭设置
│   │   └── api/
│   │       ├── auth/register/route.ts
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── auth/session/route.ts
│   │       ├── auth/verify-pin/route.ts
│   │       ├── family/route.ts
│   │       ├── family/children/[id]/route.ts
│   │       ├── tasks/route.ts
│   │       ├── tasks/[id]/complete/route.ts
│   │       ├── tasks/[id]/approve/route.ts
│   │       ├── templates/route.ts
│   │       ├── templates/[id]/route.ts
│   │       ├── points/route.ts
│   │       ├── rewards/route.ts
│   │       ├── rewards/[id]/route.ts
│   │       ├── redemptions/route.ts
│   │       └── redemptions/[id]/route.ts
│   ├── components/
│   │   ├── ui/                     # shadcn 组件
│   │   ├── task-card.tsx
│   │   ├── reward-card.tsx
│   │   ├── points-badge.tsx
│   │   ├── pin-dialog.tsx
│   │   ├── bottom-nav.tsx
│   │   └── age-adaptive.tsx
│   ├── lib/
│   │   ├── utils.ts                # cn() helper
│   │   ├── auth.ts                 # NextAuth 配置
│   │   ├── prisma.ts               # Prisma 客户端单例
│   │   └── age-group.ts            # 年龄组计算
│   └── middleware.ts               # 路由保护
├── public/
│   └── manifest.json               # PWA
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── .env
```

---

### Task 1: 项目初始化

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env`

- [ ] **Step 1: 创建 Next.js 项目**

```bash
npx create-next-app@latest pro04 --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd /Users/art/Claude/pro04
```

- [ ] **Step 2: 安装依赖**

```bash
npm install prisma @prisma/client next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 3: 初始化 Prisma**

```bash
npx prisma init --datasource-provider mysql
```

- [ ] **Step 4: 初始化 shadcn/ui**

```bash
npx shadcn@latest init
# 选择: TypeScript, Neutral, CSS Variables: Yes
```

Expected: shadcn 在 `src/components/ui/` 下生成基础组件，`src/lib/utils.ts` 创建完成。

- [ ] **Step 5: 添加 shadcn 组件**

```bash
npx shadcn@latest add button input card dialog tabs badge label select avatar
```

- [ ] **Step 6: 设置 .env**

```env
DATABASE_URL="mysql://root:password@localhost:3306/kids_reward"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
```

```bash
openssl rand -base64 32
# 将输出填入 AUTH_SECRET
```

- [ ] **Step 7: 配置 Tailwind CSS v4**

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Prisma, shadcn/ui, NextAuth

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 数据库 Schema

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/age-group.ts`

- [ ] **Step 1: 编写 Prisma Schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Family {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  users     User[]
  tasks     Task[]
  templates TaskTemplate[]
  rewards   Reward[]
}

model User {
  id           String             @id @default(cuid())
  familyId     String
  family       Family             @relation(fields: [familyId], references: [id])
  name         String
  email        String?            @unique
  passwordHash String?
  role         String             @default("child") // "parent" | "child"
  ageGroup     String?            // "3-6" | "6-10" | "10-14"
  avatarUrl    String?
  pinCode      String?
  createdAt    DateTime           @default(now())
  tasks        Task[]             @relation("AssignedTasks")
  createdTasks Task[]             @relation("CreatedTasks")
  pointsTxs    PointsTransaction[]
  redemptions  Redemption[]
}

model TaskTemplate {
  id          String   @id @default(cuid())
  familyId    String
  family      Family   @relation(fields: [familyId], references: [id])
  title       String
  description String?
  points      Int      @default(1)
  category    String   @default("daily") // "daily" | "study" | "chore" | "other"
  icon        String   @default("⭐")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  tasks       Task[]
}

model Task {
  id          String       @id @default(cuid())
  familyId    String
  family      Family       @relation(fields: [familyId], references: [id])
  templateId  String?
  template    TaskTemplate? @relation(fields: [templateId], references: [id])
  title       String
  description String?
  points      Int          @default(1)
  type        String       @default("daily") // "daily" | "once"
  status      String       @default("pending") // "pending" | "completed" | "approved"
  assignedTo  String
  child       User         @relation("AssignedTasks", fields: [assignedTo], references: [id])
  createdBy   String
  parent      User         @relation("CreatedTasks", fields: [createdBy], references: [id])
  dueDate     DateTime?
  completedAt DateTime?
  createdAt   DateTime     @default(now())
}

model PointsTransaction {
  id          String   @id @default(cuid())
  familyId    String
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  amount      Int      // 正数为加, 负数为扣
  type        String   // "task_reward" | "manual_add" | "manual_sub" | "redeem"
  reason      String
  referenceId String?  // 关联的 Task 或 Redemption ID
  createdAt   DateTime @default(now())
}

model Reward {
  id          String       @id @default(cuid())
  familyId    String
  family      Family       @relation(fields: [familyId], references: [id])
  title       String
  description String?
  pointsCost  Int
  imageUrl    String?
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  redemptions Redemption[]
}

model Redemption {
  id          String    @id @default(cuid())
  familyId    String
  childId     String
  child       User      @relation(fields: [childId], references: [id])
  rewardId    String
  reward      Reward    @relation(fields: [rewardId], references: [id])
  pointsSpent Int
  status      String    @default("pending") // "pending" | "approved" | "rejected"
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
}
```

- [ ] **Step 2: 创建 Prisma 客户端单例**

`src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 3: 年龄组工具函数**

`src/lib/age-group.ts`:
```typescript
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

- [ ] **Step 4: 运行数据库迁移**

```bash
npx prisma db push
# Expected: Database synchronized
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/prisma.ts src/lib/age-group.ts
git commit -m "feat: add database schema with Prisma + MySQL

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: NextAuth 认证配置与会话类型

**Files:**
- Create: `src/lib/auth.ts`, `src/types/next-auth.d.ts`

- [ ] **Step 1: 编写 NextAuth 配置**

`src/lib/auth.ts`:
```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, passwordHash: true, name: true, familyId: true, role: true },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email ?? "",
          name: user.name,
          familyId: user.familyId,
          role: user.role as "parent" | "child",
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.familyId = (user as any).familyId
        token.role = (user as any).role
        token.viewMode = "child" // 默认儿童模式
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).familyId = token.familyId
        ;(session.user as any).role = token.role
        ;(session.user as any).viewMode = token.viewMode
      }
      return session
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
})
```

- [ ] **Step 2: 扩展 TypeScript 类型**

`src/types/next-auth.d.ts`:
```typescript
import "next-auth"

declare module "next-auth" {
  interface User {
    familyId: string
    role: "parent" | "child"
  }
  interface Session {
    user: {
      id: string
      name: string
      email: string
      familyId: string
      role: "parent" | "child"
      viewMode: "child" | "parent"
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    familyId: string
    role: "parent" | "child"
    viewMode: "child" | "parent"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts
git commit -m "feat: configure NextAuth with credentials provider and custom session

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 认证 API 路由 & 中间件

**Files:**
- Create: `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/session/route.ts`, `src/app/api/auth/verify-pin/route.ts`, `src/middleware.ts`

- [ ] **Step 1: 注册接口**

`src/app/api/auth/register/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少6位" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const family = await prisma.family.create({ data: { name: `${name}的家庭` } })

    const user = await prisma.user.create({
      data: {
        familyId: family.id,
        name,
        email,
        passwordHash,
        role: "parent",
      },
    })

    return NextResponse.json({ id: user.id, name: user.name, familyId: family.id })
  } catch {
    return NextResponse.json({ error: "注册失败" }, { status: 500 })
  }
}
```

- [ ] **Step 2: 登录接口**

先检查 `src/app/api/auth/` 下是否已有 NextAuth 生成的 `[...nextauth]/route.ts`。如果有，使用 NextAuth 内置的 signIn，无需单独写 login 路由。

```bash
# 创建 NextAuth 路由
mkdir -p src/app/api/auth/\[...nextauth\]
```

`src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

`src/app/api/auth/login/route.ts`:
```typescript
import { signIn } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 })
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 })
  }
}
```

- [ ] **Step 3: 登出接口**

`src/app/api/auth/logout/route.ts`:
```typescript
import { signOut } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST() {
  await signOut({ redirect: false })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: 当前会话接口**

`src/app/api/auth/session/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json(session)
}
```

- [ ] **Step 5: PIN 验证接口（切换到家长模式）**

`src/app/api/auth/verify-pin/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getToken } from "next-auth/jwt"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { pin } = await req.json()
  if (!pin) {
    return NextResponse.json({ error: "请输入 PIN 码" }, { status: 400 })
  }

  // 查找家庭中任意家长的 PIN（PIN 是家庭级别的）
  const parent = await prisma.user.findFirst({
    where: { familyId: session.user.familyId, role: "parent", pinCode: { not: null } },
    select: { pinCode: true },
  })

  if (!parent?.pinCode) {
    return NextResponse.json({ error: "尚未设置 PIN 码" }, { status: 400 })
  }

  const isValid = await bcrypt.compare(pin, parent.pinCode)
  if (!isValid) {
    return NextResponse.json({ error: "PIN 码错误" }, { status: 401 })
  }

  // 更新 JWT token 中的 viewMode
  const token = await getToken({ req, secret: process.env.AUTH_SECRET })
  if (token) {
    token.viewMode = "parent"
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: 全局中间件**

`src/middleware.ts`:
```typescript
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicPaths = ["/login", "/api/auth/register", "/api/auth/login"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // 公开路径直接放行
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 静态资源直接放行
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/auth/[...nextauth]")) {
    return NextResponse.next()
  }

  // 未登录重定向
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // /manage/* 需要家长模式
  if (pathname.startsWith("/manage") && (session.user as any).viewMode !== "parent") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth/ src/middleware.ts src/types/
git commit -m "feat: implement auth API routes and middleware

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 家庭 & 小朋友 API

**Files:**
- Create: `src/app/api/family/route.ts`, `src/app/api/family/children/[id]/route.ts`

- [ ] **Step 1: 家庭信息接口**

`src/app/api/family/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const family = await prisma.family.findUnique({
    where: { id: session.user.familyId },
    include: {
      users: { select: { id: true, name: true, role: true, ageGroup: true, avatarUrl: true, createdAt: true } },
    },
  })

  return NextResponse.json(family)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { name } = await req.json()

  const family = await prisma.family.update({
    where: { id: session.user.familyId },
    data: { name },
  })

  return NextResponse.json(family)
}
```

- [ ] **Step 2: 添加/编辑小朋友接口**

`src/app/api/family/children/[id]/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeAgeGroup } from "@/lib/age-group"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { id } = await params
  const { name, birthYear, birthMonth, avatarUrl } = await req.json()

  if (!name) {
    return NextResponse.json({ error: "请输入小朋友姓名" }, { status: 400 })
  }

  const ageGroup = birthYear && birthMonth ? computeAgeGroup(birthYear, birthMonth) : undefined

  const child = await prisma.user.update({
    where: { id, familyId: session.user.familyId },
    data: { name, ageGroup, avatarUrl },
  })

  return NextResponse.json(child)
}
```

- [ ] **Step 3: 添加小朋友（新建）**

`src/app/api/family/children/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeAgeGroup } from "@/lib/age-group"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { name, birthYear, birthMonth, avatarUrl } = await req.json()

  if (!name) {
    return NextResponse.json({ error: "请输入小朋友姓名" }, { status: 400 })
  }

  const ageGroup = birthYear && birthMonth ? computeAgeGroup(birthYear, birthMonth) : null

  const child = await prisma.user.create({
    data: {
      familyId: session.user.familyId,
      name,
      role: "child",
      ageGroup,
      avatarUrl,
    },
  })

  return NextResponse.json(child)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { pinCode } = await req.json()

  if (!pinCode || pinCode.length < 4) {
    return NextResponse.json({ error: "PIN 码至少4位" }, { status: 400 })
  }

  const hashedPin = await bcrypt.hash(pinCode, 10)

  await prisma.user.updateMany({
    where: { familyId: session.user.familyId, role: "parent" },
    data: { pinCode: hashedPin },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/family/
git commit -m "feat: implement family and children API routes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 任务 & 模板 API

**Files:**
- Create: `src/app/api/tasks/route.ts`, `src/app/api/tasks/[id]/complete/route.ts`, `src/app/api/tasks/[id]/approve/route.ts`, `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`

- [ ] **Step 1: 任务列表查询 + 创建**

`src/app/api/tasks/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const childId = searchParams.get("childId")
  const date = searchParams.get("date") // YYYY-MM-DD

  const where: any = { familyId: session.user.familyId }
  if (childId) where.assignedTo = childId
  if (date) {
    const start = new Date(date)
    const end = new Date(date)
    end.setDate(end.getDate() + 1)
    where.createdAt = { gte: start, lt: end }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      child: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { title, description, points, type, assignedTo, templateId, dueDate, category, icon } = await req.json()

  if (!title || !assignedTo) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      familyId: session.user.familyId,
      templateId: templateId || null,
      title,
      description,
      points: points ?? 1,
      type: type ?? "once",
      assignedTo,
      createdBy: session.user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  })

  return NextResponse.json(task)
}
```

- [ ] **Step 2: 小朋友完成打卡**

`src/app/api/tasks/[id]/complete/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { id } = await params

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task || task.familyId !== session.user.familyId) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 })
  }

  if (task.status !== "pending") {
    return NextResponse.json({ error: "任务已完成" }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 更新任务状态
    const t = await tx.task.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
    })

    // 创建积分流水
    await tx.pointsTransaction.create({
      data: {
        familyId: task.familyId,
        userId: task.assignedTo,
        amount: task.points,
        type: "task_reward",
        reason: `完成任务: ${task.title}`,
        referenceId: task.id,
      },
    })

    return t
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 3: 家长确认完成**

`src/app/api/tasks/[id]/approve/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { id } = await params

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task || task.familyId !== session.user.familyId) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 })
  }

  if (task.status !== "completed") {
    return NextResponse.json({ error: "任务尚未完成" }, { status: 400 })
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { status: "approved" },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: 任务模板 CRUD**

`src/app/api/templates/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const templates = await prisma.taskTemplate.findMany({
    where: { familyId: session.user.familyId, isActive: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { title, description, points, category, icon } = await req.json()
  if (!title) {
    return NextResponse.json({ error: "请输入任务标题" }, { status: 400 })
  }

  const template = await prisma.taskTemplate.create({
    data: {
      familyId: session.user.familyId,
      title,
      description,
      points: points ?? 1,
      category: category ?? "daily",
      icon: icon ?? "⭐",
    },
  })

  return NextResponse.json(template)
}
```

`src/app/api/templates/[id]/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { id } = await params
  const { title, description, points, category, icon, isActive } = await req.json()

  const template = await prisma.taskTemplate.update({
    where: { id, familyId: session.user.familyId },
    data: { title, description, points, category, icon, isActive },
  })

  return NextResponse.json(template)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { id } = await params

  // 软删除：设置 isActive = false
  await prisma.taskTemplate.update({
    where: { id, familyId: session.user.familyId },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/ src/app/api/templates/
git commit -m "feat: implement task and template API routes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 积分 & 奖品 & 兑换 API

**Files:**
- Create: `src/app/api/points/route.ts`, `src/app/api/rewards/route.ts`, `src/app/api/rewards/[id]/route.ts`, `src/app/api/redemptions/route.ts`, `src/app/api/redemptions/[id]/route.ts`

- [ ] **Step 1: 积分查询与手动调整**

`src/app/api/points/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const childId = searchParams.get("childId")

  const where: any = { familyId: session.user.familyId }
  if (childId) where.userId = childId
  else if (session.user.role === "child") where.userId = session.user.id

  // 计算余额
  const result = await prisma.pointsTransaction.aggregate({
    where,
    _sum: { amount: true },
  })
  const balance = result._sum.amount ?? 0

  // 查询流水
  const transactions = await prisma.pointsTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ balance, transactions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { childId, amount, reason } = await req.json()

  if (!childId || amount === undefined || !reason) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
  }

  if (typeof amount !== "number" || amount === 0) {
    return NextResponse.json({ error: "积分变动额无效" }, { status: 400 })
  }

  const tx = await prisma.pointsTransaction.create({
    data: {
      familyId: session.user.familyId,
      userId: childId,
      amount,
      type: amount > 0 ? "manual_add" : "manual_sub",
      reason,
    },
  })

  return NextResponse.json(tx)
}
```

- [ ] **Step 2: 奖品 CRUD**

`src/app/api/rewards/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const rewards = await prisma.reward.findMany({
    where: { familyId: session.user.familyId, isActive: true },
    orderBy: { pointsCost: "asc" },
  })

  return NextResponse.json(rewards)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { title, description, pointsCost, imageUrl } = await req.json()

  if (!title || !pointsCost) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
  }

  const reward = await prisma.reward.create({
    data: {
      familyId: session.user.familyId,
      title,
      description,
      pointsCost,
      imageUrl,
    },
  })

  return NextResponse.json(reward)
}
```

`src/app/api/rewards/[id]/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { id } = await params
  const { title, description, pointsCost, imageUrl, isActive } = await req.json()

  const reward = await prisma.reward.update({
    where: { id, familyId: session.user.familyId },
    data: { title, description, pointsCost, imageUrl, isActive },
  })

  return NextResponse.json(reward)
}
```

- [ ] **Step 3: 兑换接口**

`src/app/api/redemptions/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") // "pending" for parent review

  const where: any = { familyId: session.user.familyId }
  if (status) where.status = status
  if (session.user.role === "child") where.childId = session.user.id

  const redemptions = await prisma.redemption.findMany({
    where,
    include: {
      child: { select: { id: true, name: true } },
      reward: { select: { id: true, title: true, pointsCost: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(redemptions)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { rewardId } = await req.json()
  if (!rewardId) {
    return NextResponse.json({ error: "请选择奖品" }, { status: 400 })
  }

  const reward = await prisma.reward.findUnique({ where: { id: rewardId } })
  if (!reward || reward.familyId !== session.user.familyId) {
    return NextResponse.json({ error: "奖品不存在" }, { status: 404 })
  }

  // 确保是小朋友在兑换
  const childId = session.user.role === "child" ? session.user.id : (await req.json()).childId
  if (!childId) {
    return NextResponse.json({ error: "请选择小朋友" }, { status: 400 })
  }

  // 计算当前余额
  const result = await prisma.pointsTransaction.aggregate({
    where: { familyId: session.user.familyId, userId: childId },
    _sum: { amount: true },
  })
  const balance = result._sum.amount ?? 0

  if (balance < reward.pointsCost) {
    return NextResponse.json({ error: "积分不足" }, { status: 400 })
  }

  const redemption = await prisma.redemption.create({
    data: {
      familyId: session.user.familyId,
      childId,
      rewardId,
      pointsSpent: reward.pointsCost,
      status: "pending",
    },
  })

  return NextResponse.json(redemption)
}
```

- [ ] **Step 4: 兑换确认/拒绝**

`src/app/api/redemptions/[id]/route.ts`:
```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }

  const { id } = await params
  const { action } = await req.json() // "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "无效操作" }, { status: 400 })
  }

  const redemption = await prisma.redemption.findUnique({ where: { id } })
  if (!redemption || redemption.familyId !== session.user.familyId) {
    return NextResponse.json({ error: "兑换记录不存在" }, { status: 404 })
  }

  if (redemption.status !== "pending") {
    return NextResponse.json({ error: "该兑换已处理" }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.redemption.update({
      where: { id },
      data: { status: action === "approve" ? "approved" : "rejected", resolvedAt: new Date() },
    })

    if (action === "approve") {
      // 扣除积分
      await tx.pointsTransaction.create({
        data: {
          familyId: redemption.familyId,
          userId: redemption.childId,
          amount: -redemption.pointsSpent,
          type: "redeem",
          reason: `兑换: ${id}`,
          referenceId: id,
        },
      })
    }

    return r
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/points/ src/app/api/rewards/ src/app/api/redemptions/
git commit -m "feat: implement points, rewards, and redemption API routes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: UI 组件 — 儿童端

**Files:**
- Create: `src/components/task-card.tsx`, `src/components/reward-card.tsx`, `src/components/points-badge.tsx`, `src/components/pin-dialog.tsx`, `src/components/bottom-nav.tsx`, `src/components/age-adaptive.tsx`

- [ ] **Step 1: 积分徽章组件**

`src/components/points-badge.tsx`:
```typescript
"use client"

import { cn } from "@/lib/utils"

interface PointsBadgeProps {
  points: number
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PointsBadge({ points, size = "md", className }: PointsBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-yellow-100 font-bold text-yellow-800",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-lg",
        className
      )}
    >
      ⭐ {points}
    </div>
  )
}
```

- [ ] **Step 2: 任务卡片组件**

`src/components/task-card.tsx`:
```typescript
"use client"

import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface TaskCardProps {
  id: string
  title: string
  description?: string | null
  points: number
  icon?: string
  status: "pending" | "completed" | "approved"
  onComplete?: (id: string) => void
  disabled?: boolean
}

export function TaskCard({ id, title, description, points, icon, status, onComplete, disabled }: TaskCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-white p-4 transition-all",
        status === "completed" && "border-green-300 bg-green-50",
        status === "approved" && "border-green-400 bg-green-50/70"
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
        {icon || "📋"}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-semibold", status !== "pending" && "text-muted-foreground")}>
          {title}
        </span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
        <span className="mt-0.5 text-xs font-medium text-yellow-600">+{points} ⭐</span>
      </div>
      <button
        onClick={() => onComplete?.(id)}
        disabled={disabled || status !== "pending"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          status === "pending" && "border-input hover:border-green-400 hover:bg-green-100",
          status === "completed" && "border-green-500 bg-green-500 text-white",
          status === "approved" && "border-green-500 bg-green-500 text-white"
        )}
      >
        {status === "pending" ? "○" : "✓"}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 奖品卡片组件**

`src/components/reward-card.tsx`:
```typescript
"use client"

import { cn } from "@/lib/utils"

interface RewardCardProps {
  id: string
  title: string
  pointsCost: number
  imageUrl?: string | null
  affordable: boolean
  onRedeem?: (id: string) => void
  disabled?: boolean
}

export function RewardCard({ id, title, pointsCost, imageUrl, affordable, onRedeem, disabled }: RewardCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border bg-white p-4 text-center transition-all",
        !affordable && "opacity-50"
      )}
    >
      <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-3xl">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full rounded-xl object-cover" />
        ) : (
          "🎁"
        )}
      </div>
      <span className="text-sm font-semibold">{title}</span>
      <button
        onClick={() => onRedeem?.(id)}
        disabled={disabled || !affordable}
        className={cn(
          "mt-3 w-full rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
          affordable
            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 active:scale-95"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {affordable ? `${pointsCost} ⭐` : `🔒 ${pointsCost} ⭐`}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: PIN 码弹窗**

`src/components/pin-dialog.tsx`:
```typescript
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PinDialog({ open, onOpenChange, onSuccess }: PinDialogProps) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError("PIN 码至少4位")
      return
    }
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    })

    if (res.ok) {
      onSuccess()
      setPin("")
      onOpenChange(false)
    } else {
      const data = await res.json()
      setError(data.error || "验证失败")
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>🔒 家长验证</DialogTitle>
          <DialogDescription>输入 PIN 码进入管理模式</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="请输入 PIN 码"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "验证中..." : "确认"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: 底部导航**

`src/components/bottom-nav.tsx`:
```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "任务", icon: "📋" },
  { href: "/rewards", label: "奖品", icon: "🎁" },
  { href: "/history", label: "记录", icon: "🏆" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium transition-colors",
              pathname === item.href
                ? "text-green-600"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 6: 年龄自适应包装组件**

`src/components/age-adaptive.tsx`:
```typescript
"use client"

import { createContext, useContext, ReactNode } from "react"
import { AgeGroup, AgeGroupConfig, ageGroupConfigs } from "@/lib/age-group"

const AgeContext = createContext<AgeGroup>("6-10")

export function AgeProvider({ ageGroup, children }: { ageGroup: AgeGroup; children: ReactNode }) {
  return <AgeContext.Provider value={ageGroup}>{children}</AgeContext.Provider>
}

export function useAgeGroup(): AgeGroup {
  return useContext(AgeContext)
}

export function useAgeConfig(): AgeGroupConfig {
  const ageGroup = useAgeGroup()
  return ageGroupConfigs[ageGroup]
}

interface AdaptiveIconProps {
  icon: string
  className?: string
}

export function AdaptiveIcon({ icon, className }: AdaptiveIconProps) {
  const config = useAgeConfig()
  return (
    <span style={{ fontSize: config.iconSize }} className={className}>
      {icon}
    </span>
  )
}

interface AdaptiveTextProps {
  children: ReactNode
  className?: string
}

export function AdaptiveText({ children, className }: AdaptiveTextProps) {
  const config = useAgeConfig()
  if (!config.showText) return null
  return <span className={className}>{children}</span>
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: add child-mode UI components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: 登录/注册页面

**Files:**
- Create: `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 根布局**

`src/app/layout.tsx`:
```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "🌟 奖励小助手",
  description: "小朋友学习奖励打卡应用",
  manifest: "/manifest.json",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} min-h-screen bg-[#FEFCE8] text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 登录/注册页面**

`src/app/login/page.tsx`:
```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = new FormData(e.currentTarget)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    })

    if (res.ok) {
      router.push("/")
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || "登录失败")
    }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = new FormData(e.currentTarget)
    const password = form.get("password") as string
    const confirmPassword = form.get("confirmPassword") as string

    if (password !== confirmPassword) {
      setError("两次密码不一致")
      setLoading(false)
      return
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password,
      }),
    })

    if (res.ok) {
      // 注册成功后自动登录
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password }),
      })
      if (loginRes.ok) {
        router.push("/")
        router.refresh()
      }
    } else {
      const data = await res.json()
      setError(data.error || "注册失败")
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🌟 奖励小助手</CardTitle>
          <CardDescription>让好习惯闪闪发光</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <Input name="email" type="email" placeholder="邮箱" required />
                <Input name="password" type="password" placeholder="密码" required />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "登录中..." : "登录"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <Input name="name" placeholder="家长姓名" required />
                <Input name="email" type="email" placeholder="邮箱" required />
                <Input name="password" type="password" placeholder="密码 (至少6位)" required minLength={6} />
                <Input name="confirmPassword" type="password" placeholder="确认密码" required minLength={6} />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "注册中..." : "注册"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/ src/app/layout.tsx
git commit -m "feat: implement login/register page with tabs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 儿童端页面

**Files:**
- Create: `src/app/page.tsx`, `src/app/rewards/page.tsx`, `src/app/history/page.tsx`

- [ ] **Step 1: 儿童首页（今日任务）**

`src/app/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TaskCard } from "@/components/task-card"
import { PointsBadge } from "@/components/points-badge"
import { BottomNav } from "@/components/bottom-nav"
import { PinDialog } from "@/components/pin-dialog"

interface Task {
  id: string
  title: string
  description: string | null
  points: number
  status: "pending" | "completed" | "approved"
  type: string
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [points, setPoints] = useState(0)
  const [showPin, setShowPin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((data) => {
      if (!data.user) router.push("/login")
    })

    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/tasks?date=${today}`)
      .then((r) => r.json())
      .then(setTasks)

    fetch("/api/points")
      .then((r) => r.json())
      .then((data) => setPoints(data.balance))
  }, [router])

  const handleComplete = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}/complete`, { method: "POST" })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
      // 刷新积分
      fetch("/api/points")
        .then((r) => r.json())
        .then((data) => setPoints(data.balance))
    }
  }

  const handlePinSuccess = () => {
    router.push("/manage")
  }

  return (
    <div className="mx-auto max-w-lg pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6">
        <div>
          <h1 className="text-lg font-extrabold text-stone-700">🌟 今天要做什么？</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <button onClick={() => setShowPin(true)}>
          <PointsBadge points={points} size="md" />
        </button>
      </div>

      {/* Task list */}
      <div className="mt-4 space-y-3 px-4">
        {tasks.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            今天还没有任务哦～<br />请家长在管理模式中添加任务 📋
          </p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            id={task.id}
            title={task.title}
            description={task.description}
            points={task.points}
            status={task.status}
            onComplete={handleComplete}
          />
        ))}
      </div>

      <BottomNav />
      <PinDialog open={showPin} onOpenChange={setShowPin} onSuccess={handlePinSuccess} />
    </div>
  )
}
```

- [ ] **Step 2: 奖品商店页面**

`src/app/rewards/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import { RewardCard } from "@/components/reward-card"
import { PointsBadge } from "@/components/points-badge"
import { BottomNav } from "@/components/bottom-nav"

interface Reward {
  id: string
  title: string
  pointsCost: number
  imageUrl: string | null
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [points, setPoints] = useState(0)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/rewards").then((r) => r.json()).then(setRewards)
    fetch("/api/points").then((r) => r.json()).then((data) => setPoints(data.balance))
  }, [])

  const handleRedeem = async (rewardId: string) => {
    const res = await fetch("/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId }),
    })

    if (res.ok) {
      setMessage("🎉 兑换请求已提交，等家长确认！")
      setTimeout(() => setMessage(""), 3000)
    } else {
      const data = await res.json()
      setMessage(`❌ ${data.error}`)
      setTimeout(() => setMessage(""), 3000)
    }
  }

  return (
    <div className="mx-auto max-w-lg pb-20">
      <div className="flex items-center justify-between px-4 pt-6">
        <h1 className="text-lg font-extrabold text-stone-700">🎁 奖品商店</h1>
        <PointsBadge points={points} size="md" />
      </div>

      {message && (
        <div className="mx-4 mt-3 rounded-xl bg-yellow-50 px-4 py-2 text-center text-sm font-medium text-yellow-800">
          {message}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
        {rewards.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            还没有奖品哦～
          </p>
        )}
        {rewards.map((reward) => (
          <RewardCard
            key={reward.id}
            id={reward.id}
            title={reward.title}
            pointsCost={reward.pointsCost}
            imageUrl={reward.imageUrl}
            affordable={points >= reward.pointsCost}
            onRedeem={handleRedeem}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: 积分历史页面**

`src/app/history/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import { PointsBadge } from "@/components/points-badge"
import { BottomNav } from "@/components/bottom-nav"

interface Transaction {
  id: string
  amount: number
  type: string
  reason: string
  createdAt: string
}

const typeLabels: Record<string, string> = {
  task_reward: "✅ 任务奖励",
  manual_add: "⭐ 家长奖励",
  manual_sub: "💨 扣分",
  redeem: "🎁 兑换消耗",
}

export default function HistoryPage() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    fetch("/api/points")
      .then((r) => r.json())
      .then((data) => {
        setBalance(data.balance)
        setTransactions(data.transactions)
      })
  }, [])

  return (
    <div className="mx-auto max-w-lg pb-20">
      <div className="flex items-center justify-between px-4 pt-6">
        <h1 className="text-lg font-extrabold text-stone-700">🏆 积分记录</h1>
        <PointsBadge points={balance} size="lg" />
      </div>

      <div className="mt-6 space-y-2 px-4">
        {transactions.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">还没有积分记录</p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{typeLabels[tx.type] || tx.type}</span>
              <span className="text-xs text-muted-foreground">
                {tx.reason} · {new Date(tx.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
            <span className={`text-sm font-bold ${tx.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
              {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} ⭐
            </span>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/rewards/ src/app/history/
git commit -m "feat: implement child-mode pages (tasks, rewards, history)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: 家长管理页面

**Files:**
- Create: `src/app/manage/page.tsx`, `src/app/manage/tasks/page.tsx`, `src/app/manage/rewards/page.tsx`, `src/app/manage/points/page.tsx`, `src/app/manage/redemptions/page.tsx`, `src/app/manage/family/page.tsx`

- [ ] **Step 1: 家长看板首页**

`src/app/manage/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PointsBadge } from "@/components/points-badge"
import { Card } from "@/components/ui/card"

interface ChildInfo {
  id: string
  name: string
  ageGroup: string | null
  points: number
}

export default function ManagePage() {
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetch("/api/family")
      .then((r) => r.json())
      .then(async (family) => {
        const kids = await Promise.all(
          family.users
            .filter((u: any) => u.role === "child")
            .map(async (child: any) => {
              const res = await fetch(`/api/points?childId=${child.id}`)
              const data = await res.json()
              return { ...child, points: data.balance }
            })
        )
        setChildren(kids)
      })

    fetch("/api/redemptions?status=pending")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.length))
  }, [])

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-stone-700">📊 家庭看板</h1>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          🔒 管理模式
        </span>
      </div>

      {/* Kids summary */}
      {children.length === 0 ? (
        <Card className="mb-4 p-6 text-center text-sm text-muted-foreground">
          还没有添加小朋友，去
          <Link href="/manage/family" className="text-primary underline">家庭设置</Link>
          添加吧
        </Card>
      ) : (
        <div className="mb-4 flex gap-3">
          {children.map((child) => (
            <Card key={child.id} className="flex-1 p-4 text-center">
              <div className="text-2xl">{child.ageGroup === "3-6" ? "🧒" : child.ageGroup === "6-10" ? "👦" : "🧑‍🎓"}</div>
              <div className="mt-1 text-sm font-semibold">{child.name}</div>
              <PointsBadge points={child.points} size="sm" className="mt-1" />
            </Card>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/manage/tasks" className="rounded-2xl bg-white p-4 text-center text-sm font-semibold shadow-sm hover:bg-muted/50">
          📋 任务管理
        </Link>
        <Link href="/manage/rewards" className="rounded-2xl bg-white p-4 text-center text-sm font-semibold shadow-sm hover:bg-muted/50">
          🎁 奖品管理
        </Link>
        <Link href="/manage/points" className="rounded-2xl bg-white p-4 text-center text-sm font-semibold shadow-sm hover:bg-muted/50">
          ⭐ 积分调整
        </Link>
        <Link
          href="/manage/redemptions"
          className="relative rounded-2xl bg-white p-4 text-center text-sm font-semibold shadow-sm hover:bg-muted/50"
        >
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {pendingCount}
            </span>
          )}
          ⏳ 兑换审核
        </Link>
      </div>

      <Link
        href="/"
        className="mt-6 block w-full rounded-xl bg-muted py-3 text-center text-sm font-medium text-muted-foreground hover:bg-muted/70"
      >
        退出管理模式 →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: 任务管理页面**

`src/app/manage/tasks/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card } from "@/components/ui/card"

interface Template {
  id: string
  title: string
  points: number
  category: string
  icon: string
  isActive: boolean
}

interface Child {
  id: string
  name: string
}

export default function ManageTasksPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates)
    fetch("/api/family")
      .then((r) => r.json())
      .then((data) => setChildren(data.users.filter((u: any) => u.role === "child")))
  }, [])

  const handleGenerate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template || children.length === 0) return

    // 为每个小朋友生成今日任务
    for (const child of children) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.title,
          points: template.points,
          type: "daily",
          assignedTo: child.id,
          templateId,
        }),
      })
    }
    alert("已为所有小朋友生成今日任务")
  }

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        points: Number(form.get("points")) || 1,
        type: "once",
        assignedTo: form.get("childId"),
      }),
    })

    setShowForm(false)
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-stone-700">📋 任务管理</h1>
        <Link href="/manage" className="text-sm text-muted-foreground">← 返回</Link>
      </div>

      {/* 每日任务模板 */}
      <h2 className="mb-2 text-sm font-semibold">每日任务模板</h2>
      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{t.icon}</span>
              <div>
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">+{t.points} ⭐</div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleGenerate(t.id)}>
              今日生成
            </Button>
          </Card>
        ))}
      </div>

      {/* 一次性任务 */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">一次性任务</h2>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            + 新建
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateTask} className="space-y-3 rounded-xl bg-white p-4">
            <Input name="title" placeholder="任务标题" required />
            <Input name="points" type="number" placeholder="积分" defaultValue={1} min={1} />
            <select
              name="childId"
              required
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">选择小朋友</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button type="submit" className="w-full">创建任务</Button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 奖品管理页面**

`src/app/manage/rewards/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface Reward {
  id: string
  title: string
  pointsCost: number
  isActive: boolean
}

export default function ManageRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [showForm, setShowForm] = useState(false)

  const loadRewards = () => {
    fetch("/api/rewards").then((r) => r.json()).then(setRewards)
  }

  useEffect(() => { loadRewards() }, [])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await fetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        pointsCost: Number(form.get("pointsCost")) || 10,
        description: form.get("description"),
      }),
    })
    setShowForm(false)
    loadRewards()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-stone-700">🎁 奖品管理</h1>
        <Link href="/manage" className="text-sm text-muted-foreground">← 返回</Link>
      </div>

      <Button className="mb-4 w-full" variant="outline" onClick={() => setShowForm(!showForm)}>
        + 添加奖品
      </Button>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-xl bg-white p-4">
          <Input name="title" placeholder="奖品名称" required />
          <Input name="pointsCost" type="number" placeholder="所需积分" defaultValue={10} min={1} required />
          <Input name="description" placeholder="描述（可选）" />
          <Button type="submit" className="w-full">创建奖品</Button>
        </form>
      )}

      <div className="space-y-2">
        {rewards.map((r) => (
          <Card key={r.id} className="flex items-center justify-between p-3">
            <div>
              <div className="text-sm font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.pointsCost} ⭐</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 积分管理页面**

`src/app/manage/points/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { PointsBadge } from "@/components/points-badge"

interface Child {
  id: string
  name: string
  points: number
}

export default function ManagePointsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<string>("")

  const loadChildren = () => {
    fetch("/api/family")
      .then((r) => r.json())
      .then(async (family) => {
        const kids = await Promise.all(
          family.users
            .filter((u: any) => u.role === "child")
            .map(async (child: any) => {
              const res = await fetch(`/api/points?childId=${child.id}`)
              const data = await res.json()
              return { ...child, points: data.balance }
            })
        )
        setChildren(kids)
      })
  }

  useEffect(() => { loadChildren() }, [])

  const handleAdjust = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await fetch("/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: selectedChild,
        amount: Number(form.get("amount")),
        reason: form.get("reason"),
      }),
    })
    loadChildren()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-stone-700">⭐ 积分管理</h1>
        <Link href="/manage" className="text-sm text-muted-foreground">← 返回</Link>
      </div>

      {/* 小朋友积分总览 */}
      <div className="mb-6 flex gap-3">
        {children.map((child) => (
          <Card
            key={child.id}
            className={`flex-1 cursor-pointer p-3 text-center transition-all ${
              selectedChild === child.id ? "ring-2 ring-indigo-400" : ""
            }`}
            onClick={() => setSelectedChild(child.id)}
          >
            <div className="text-sm font-semibold">{child.name}</div>
            <PointsBadge points={child.points} size="sm" className="mt-1" />
          </Card>
        ))}
      </div>

      {/* 积分调整表单 */}
      {selectedChild && (
        <form onSubmit={handleAdjust} className="space-y-3 rounded-xl bg-white p-4">
          <p className="text-sm font-medium">
            调整 {children.find((c) => c.id === selectedChild)?.name} 的积分
          </p>
          <Input name="amount" type="number" placeholder="+ 加分 / - 扣分" required />
          <Input name="reason" placeholder="原因（如：主动帮做家务）" required />
          <Button type="submit" className="w-full">确认调整</Button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 兑换审核页面**

`src/app/manage/redemptions/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Redemption {
  id: string
  pointsSpent: number
  status: string
  createdAt: string
  child: { id: string; name: string }
  reward: { id: string; title: string; pointsCost: number }
}

export default function ManageRedemptionsPage() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([])

  const loadRedemptions = () => {
    fetch("/api/redemptions?status=pending")
      .then((r) => r.json())
      .then(setRedemptions)
  }

  useEffect(() => { loadRedemptions() }, [])

  const handleAction = async (id: string, action: "approve" | "reject") => {
    await fetch(`/api/redemptions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    loadRedemptions()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-stone-700">⏳ 兑换审核</h1>
        <Link href="/manage" className="text-sm text-muted-foreground">← 返回</Link>
      </div>

      {redemptions.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">没有待处理的兑换</p>
      ) : (
        <div className="space-y-3">
          {redemptions.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{r.reward.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.child.name} · {r.pointsSpent} ⭐ · {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleAction(r.id, "reject")}>
                    拒绝
                  </Button>
                  <Button size="sm" onClick={() => handleAction(r.id, "approve")}>
                    确认
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: 家庭设置页面**

`src/app/manage/family/page.tsx`:
```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface Child {
  id: string
  name: string
  ageGroup: string | null
}

export default function ManageFamilyPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [pin, setPin] = useState("")
  const [pinMsg, setPinMsg] = useState("")
  const [showAddChild, setShowAddChild] = useState(false)

  const loadFamily = () => {
    fetch("/api/family")
      .then((r) => r.json())
      .then((data) => setChildren(data.users.filter((u: any) => u.role === "child")))
  }

  useEffect(() => { loadFamily() }, [])

  const handleSetPin = async () => {
    const res = await fetch("/api/family/children", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinCode: pin }),
    })

    if (res.ok) {
      setPinMsg("PIN 码设置成功 ✅")
      setPin("")
    } else {
      const data = await res.json()
      setPinMsg(`❌ ${data.error}`)
    }
  }

  const handleAddChild = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = form.get("name") as string
    const birthYear = Number(form.get("birthYear"))
    const birthMonth = Number(form.get("birthMonth"))

    await fetch("/api/family/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birthYear, birthMonth }),
    })

    setShowAddChild(false)
    loadFamily()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-stone-700">👨‍👩‍👧 家庭设置</h1>
        <Link href="/manage" className="text-sm text-muted-foreground">← 返回</Link>
      </div>

      {/* 小朋友列表 */}
      <h2 className="mb-2 text-sm font-semibold">家庭成员</h2>
      <div className="mb-4 space-y-2">
        {children.map((child) => (
          <Card key={child.id} className="flex items-center justify-between p-3">
            <div>
              <div className="text-sm font-medium">{child.name}</div>
              <div className="text-xs text-muted-foreground">{child.ageGroup || "未设置年龄"}</div>
            </div>
          </Card>
        ))}
      </div>

      {showAddChild ? (
        <form onSubmit={handleAddChild} className="mb-4 space-y-3 rounded-xl bg-white p-4">
          <Input name="name" placeholder="小朋友姓名" required />
          <div className="flex gap-2">
            <Input name="birthYear" type="number" placeholder="出生年份" min={2015} max={2026} required />
            <Input name="birthMonth" type="number" placeholder="月份" min={1} max={12} required />
          </div>
          <Button type="submit" className="w-full">添加</Button>
        </form>
      ) : (
        <Button className="mb-6 w-full" variant="outline" onClick={() => setShowAddChild(true)}>
          + 添加小朋友
        </Button>
      )}

      {/* PIN 设置 */}
      <h2 className="mb-2 text-sm font-semibold">家长 PIN 码</h2>
      <div className="flex gap-2">
        <Input
          type="password"
          inputMode="numeric"
          placeholder="设置 4-6 位 PIN 码"
          maxLength={6}
          value={pin}
          onChange={(e) => { setPin(e.target.value); setPinMsg("") }}
        />
        <Button onClick={handleSetPin} variant="outline">保存</Button>
      </div>
      {pinMsg && <p className="mt-1 text-xs text-muted-foreground">{pinMsg}</p>}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/manage/
git commit -m "feat: implement parent management pages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: PWA & 移动端优化

**Files:**
- Create: `public/manifest.json`

- [ ] **Step 1: PWA manifest**

`public/manifest.json`:
```json
{
  "name": "🌟 奖励小助手",
  "short_name": "奖励助手",
  "description": "小朋友学习奖励打卡应用",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FEFCE8",
  "theme_color": "#FFD93D",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: 验证全局 CSS 定义了移动触控安全**

确认 `src/app/globals.css` 中有：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 48 100% 97%;
    --foreground: 34 30% 25%;
    --card: 0 0% 100%;
    --card-foreground: 34 30% 25%;
    --primary: 48 100% 62%;
    --primary-foreground: 34 30% 25%;
    --secondary: 34 20% 94%;
    --secondary-foreground: 34 30% 25%;
    --muted: 34 20% 94%;
    --muted-foreground: 34 10% 50%;
    --accent: 34 20% 94%;
    --accent-foreground: 34 30% 25%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 34 15% 88%;
    --input: 34 15% 88%;
    --ring: 48 100% 62%;
    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* 移动触控优化 */
@media (pointer: coarse) {
  button, a, input, select, textarea {
    min-height: 44px;
    min-width: 44px;
  }
}

/* 安全区域适配 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

- [ ] **Step 3: 验证 BottomNav 有安全区域适配**

更新 `src/components/bottom-nav.tsx`，在 nav 元素上添加 `pb-safe`:
```typescript
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-sm pb-safe">
```

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json src/app/globals.css src/components/bottom-nav.tsx
git commit -m "feat: add PWA manifest and mobile optimizations

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: 种子数据 & 最终验证

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: 种子数据脚本**

`prisma/seed.ts`:
```typescript
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // 清理
  await prisma.redemption.deleteMany()
  await prisma.pointsTransaction.deleteMany()
  await prisma.task.deleteMany()
  await prisma.taskTemplate.deleteMany()
  await prisma.reward.deleteMany()
  await prisma.user.deleteMany()
  await prisma.family.deleteMany()

  // 创建演示家庭
  const family = await prisma.family.create({
    data: { name: "小明的家庭" },
  })

  // 创建家长
  const passwordHash = await bcrypt.hash("123456", 12)
  const parent = await prisma.user.create({
    data: {
      familyId: family.id,
      name: "爸爸",
      email: "dad@test.com",
      passwordHash,
      role: "parent",
      pinCode: await bcrypt.hash("1234", 10),
    },
  })

  // 创建小朋友
  const child1 = await prisma.user.create({
    data: {
      familyId: family.id,
      name: "小明",
      role: "child",
      ageGroup: "6-10",
    },
  })

  const child2 = await prisma.user.create({
    data: {
      familyId: family.id,
      name: "小红",
      role: "child",
      ageGroup: "3-6",
    },
  })

  // 创建任务模板
  await prisma.taskTemplate.createMany({
    data: [
      { familyId: family.id, title: "练琴 30 分钟", points: 5, category: "study", icon: "🎹" },
      { familyId: family.id, title: "阅读 20 分钟", points: 3, category: "study", icon: "📖" },
      { familyId: family.id, title: "整理书包", points: 2, category: "daily", icon: "🎒" },
      { familyId: family.id, title: "刷牙洗脸", points: 1, category: "daily", icon: "🪥" },
      { familyId: family.id, title: "帮忙做家务", points: 4, category: "chore", icon: "🧹" },
    ],
  })

  // 创建奖品
  await prisma.reward.createMany({
    data: [
      { familyId: family.id, title: "看动画片 30 分钟", pointsCost: 10, description: "可以看喜欢的动画片" },
      { familyId: family.id, title: "冰淇淋一个", pointsCost: 20, description: "周末去便利店挑一个冰淇淋" },
      { familyId: family.id, title: "游戏 1 小时", pointsCost: 30, description: "周末可以玩游戏" },
      { familyId: family.id, title: "新玩具", pointsCost: 100, description: "去玩具店挑一个喜欢的玩具" },
    ],
  })

  console.log("✅ 种子数据创建完成")
  console.log(`   家长邮箱: dad@test.com  密码: 123456  PIN: 1234`)
  console.log(`   小朋友: ${child1.name} (${child1.ageGroup}), ${child2.name} (${child2.ageGroup})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: 配置 seed 脚本**

`package.json` 中添加：
```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 3: 运行种子数据**

```bash
npx prisma db seed
# Expected: ✅ 种子数据创建完成
```

- [ ] **Step 4: 启动开发服务器验证**

```bash
npm run dev
```

验证以下流程：
1. 打开 http://localhost:3000 → 自动跳转登录页
2. 使用 dad@test.com / 123456 登录 → 看到空任务列表（今日尚无任务）
3. 点击积分徽章 → PIN 对话框 → 输入 1234 → 进入家长看板
4. 任务管理 → 点击"今日生成" → 返回首页看到任务
5. 儿童首页 → 点击完成按钮 → 积分增加
6. 奖品商店 → 点击兑换 → 提示等待确认
7. 家长模式 → 兑换审核 → 确认兑换

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add seed data and final verification

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 计划自检

| 检查项 | 状态 |
|--------|------|
| 覆盖所有 spec 功能模块 | ✅ 家庭管理、任务系统、积分系统、奖品兑换 |
| 覆盖所有 API 路由 | ✅ 15+ 个路由端点 |
| 覆盖所有页面 | ✅ 3 个儿童页 + 6 个家长页 + 登录页 |
| 无 TBD/TODO 占位符 | ✅ |
| 类型一致性 | ✅ User/Task/Reward/Redemption 类型跨前后端一致 |
| 分龄 UI 实现 | ✅ age-group.ts + age-adaptive.tsx 组件 |
| 响应式适配 | ✅ Tailwind mobile-first + 触控安全 + 安全区域 |
| PWA 支持 | ✅ manifest.json + standalone 显示模式 |
| 种子数据 | ✅ 可用的演示数据 + 测试账号 |
