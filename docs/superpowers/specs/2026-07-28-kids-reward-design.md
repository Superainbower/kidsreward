# 小朋友学习奖励小程序 — 设计文档

> 创建日期: 2026-07-28 | 状态: 设计完成

## 1. 产品概述

面向家庭的小朋友学习奖励应用。家长布置任务，小朋友完成打卡获得积分，积分可兑换奖品。家长可以手动加减积分。

## 2. 核心决策

| 维度 | 决策 |
|------|------|
| 平台 | Web 响应式应用（PWA 可安装到桌面） |
| 技术栈 | Next.js 16 App Router + shadcn/ui + Prisma + MySQL |
| 用户模型 | 单家庭起步，架构预留多家庭扩展（Family 实体做数据隔离） |
| 年龄段 | 3-14 岁全覆盖，同一套组件通过 variants 适配不同年龄 |
| 任务类型 | 每日习惯打卡 + 一次性临时任务 |
| 积分规则 | 模板预设 + 家长可调整的混合模式 |
| 积分消耗 | 小朋友兑换奖品 + 家长惩罚扣分 |
| 设备场景 | 共用设备 + 各自设备都支持 |
| 认证方案 | 家庭主账号 + PIN 码管理模式 + 可选子账号 |
| 存储 | 云端 MySQL，多设备同步 |

## 3. 功能模块

### 3.1 家庭管理
- 家长注册/登录（NextAuth.js）
- 设置 PIN 码，输入 PIN 后从儿童模式切换到家长管理模式
- 添加/编辑小朋友信息（姓名、出生年月）
- 根据出生年月自动匹配年龄组（3-6 / 6-10 / 10-14）

### 3.2 任务系统
- **每日习惯任务**: 从 TaskTemplate 每天自动生成 Task 实例
- **一次性临时任务**: 家长随时创建，完成后不重复
- **积分模板**: 按分类预设默认分值（如"生活习惯+2""学习任务+5"），家长可覆盖
- **任务打卡**: 小朋友点击"完成"按钮，任务状态变为 completed
- **家长确认**: 可选的确认流程，家长审核后积分到账

### 3.3 积分系统
- 完整流水记录（PointsTransaction），每笔积分变动可追溯
- 余额通过聚合流水计算，不单独存储
- 家长可手动加分/扣分，附带原因
- 积分历史查询，按小朋友筛选

### 3.4 奖品兑换
- 家长创建奖品库（名称、描述、积分价格、可选图片）
- 小朋友浏览奖品商店，选择兑换
- 兑换后状态为 pending，等待家长确认
- 家长确认后积分扣除，拒绝后积分退回

## 4. 数据模型

### 实体列表

**Family** — 家庭，数据隔离的顶层边界
- id, name, createdAt

**User** — 用户（家长/小朋友）
- id, familyId, name, email?, passwordHash?, role (parent|child)
- ageGroup? (child only), avatarUrl?, pinCode?
- createdAt

**TaskTemplate** — 每日任务模板
- id, familyId, title, description?, points, category, icon
- isActive, createdAt

**Task** — 任务实例
- id, familyId, templateId?, title, description?, points
- type (daily|once), status (pending|completed|approved)
- assignedTo (childId), createdBy (parentId)
- dueDate?, completedAt?, createdAt

**PointsTransaction** — 积分流水
- id, familyId, userId (child), amount (+/-)
- type (task_reward|manual_add|manual_sub|redeem)
- reason, referenceId?, createdAt

**Reward** — 奖品
- id, familyId, title, description?, pointsCost
- imageUrl?, isActive, createdAt

**Redemption** — 兑换记录
- id, familyId, childId, rewardId, pointsSpent
- status (pending|approved|rejected)
- createdAt, resolvedAt?

### 关键设计决策
- 所有表带 familyId，实现天然的多家庭数据隔离
- Task 与 TaskTemplate 分离：Template 定义模式，Task 是具体实例
- 积分不存余额字段，完整流水确保可追溯、可对账
- Redemption 需要确认流程，防止小朋友误操作

## 5. 页面结构

### 儿童模式（默认视图）

| 页面 | 路由 | 说明 |
|------|------|------|
| 今日任务 | `/` | 当日任务卡片列表，点击完成打卡，积分飞入动画 |
| 奖品商店 | `/rewards` | 网格展示可兑换奖品，按积分排序，点击兑换 |
| 积分记录 | `/history` | 个人积分流水、累计/已消耗统计 |

底部 Tab Bar 导航：📋 任务 | 🎁 奖品 | 🏆 记录

### 家长模式（PIN 解锁后）

| 页面 | 路由 | 说明 |
|------|------|------|
| 家庭看板 | `/manage` | 所有小朋友总览、快捷入口、待处理提醒 |
| 任务管理 | `/manage/tasks` | 模板管理、创建任务、分配、审核 |
| 奖品管理 | `/manage/rewards` | 创建/编辑奖品、上下架 |
| 积分管理 | `/manage/points` | 积分总览、手动加减分、流水查询 |
| 兑换审核 | `/manage/redemptions` | 待处理兑换列表、确认/拒绝 |
| 家庭设置 | `/manage/family` | 成员管理、PIN 修改、设置 |

## 6. API 路由

### 认证 `/api/auth/*`
- `POST /api/auth/register` — 家长注册
- `POST /api/auth/login` — 家长登录
- `POST /api/auth/logout` — 登出
- `GET /api/auth/session` — 获取当前会话
- `POST /api/auth/verify-pin` — 验证 PIN 切换到家长模式

### 家庭 `/api/family/*`
- `GET /api/family` — 获取家庭信息
- `PUT /api/family` — 更新设置
- `POST /api/family/children` — 添加小朋友
- `PUT /api/family/children/[id]` — 编辑小朋友

### 任务 `/api/tasks/*` `/api/templates/*`
- `GET /api/tasks?childId=&date=` — 查询任务
- `POST /api/tasks` — 创建任务（家长）
- `POST /api/tasks/[id]/complete` — 小朋友打卡
- `POST /api/tasks/[id]/approve` — 家长确认
- `GET/POST/PUT/DELETE /api/templates/*` — 模板 CRUD

### 积分 `/api/points/*`
- `GET /api/points?childId=` — 积分余额 + 流水
- `POST /api/points` — 手动加减分（家长）

### 奖品 `/api/rewards/*` `/api/redemptions/*`
- `GET/POST/PUT /api/rewards/*` — 奖品 CRUD
- `POST /api/redemptions` — 小朋友发起兑换
- `PUT /api/redemptions/[id]` — 家长确认/拒绝

## 7. 认证流程

```
家长注册 → 自动创建 Family → 登录 → 设置 PIN → 添加小朋友
                                              ↓
                        日常: 儿童模式(默认) ←→ 输入 PIN → 家长管理模式
```

Session 结构: `{ userId, familyId, role, viewMode: 'child' | 'parent' }`
- 所有 API 以 `familyId` 做数据隔离
- 写操作以 `viewMode === 'parent'` + `role === 'parent'` 做权限控制
- PIN 码哈希存储，session 级别切换，不持久化到设备

## 8. 响应式适配

### 断点策略（mobile-first，Tailwind）

| 断点 | 宽度 | 布局 |
|------|------|------|
| 默认 | < 640px | 单列，全宽卡片，底部 Tab |
| `sm:` | ≥ 640px | 单列，卡片变宽 |
| `md:` | ≥ 768px | 双列网格，家长模式侧边导航 |
| `lg:` | ≥ 1024px | 三列网格（奖品商店），最大宽度约束 |

### 触控安全
- 所有可点击元素最小尺寸 44×44px（Apple HIG）
- 卡片间距 ≥ 16px，防止误触

## 9. 分龄 UI 策略

| 年龄组 | 特征 |
|--------|------|
| 3-6 岁 | 全图形化，大 Emoji 代替文字，全屏动画反馈，积分用 ⭐ 可视化 |
| 6-10 岁 | 图文混合，进度条 + 数字积分，可理解连续打卡概念 |
| 10-14 岁 | 接近成人 UI，支持数据统计和趋势，简洁反馈 |

**实现**: 同一套组件，通过 props/variants 控制图标大小、文字显示、动画强度、色彩饱和度。不做三套独立 UI。

## 10. 视觉风格

- **色彩**: 五色方案 — 阳光黄 #FFD93D (积分)、嫩绿 #6BCB77 (完成)、天空蓝 #4D96FF (按钮)、柔和红 #FF8B8B (提醒)、淡紫 #C4B5FD (成就)
- **背景**: 暖白/暖灰调（#FEFCE8 / #F5F0E8），文字用深棕灰
- **设计语言**: 大面积圆角 (≥12px)、Emoji 优先图标、克制动效（撒花/飞入用于奖励时刻）
- **组件库**: shadcn/ui (Radix + Tailwind)，使用 `cn()` 合并类名，`cva` 管理变体

## 11. 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 App Router |
| 语言 | TypeScript |
| UI | shadcn/ui (Radix UI + Tailwind CSS v4) |
| 认证 | NextAuth.js |
| ORM | Prisma |
| 数据库 | MySQL |
| 部署 | Vercel |
