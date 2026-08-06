import type { FastifyInstance } from "fastify"
import bcrypt from "bcryptjs"
import { query, execute } from "../lib/db"
import { genId } from "../lib/id"
import { signToken, wxCode2Session } from "../lib/auth"
import {
  wechatLoginSchema, bindPhoneSchema, phoneLoginSchema,
  registerSchema, changePasswordSchema, verifyPinSchema, selectChildSchema,
} from "../schemas/index"

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/wechat-login
  app.post("/api/auth/wechat-login", async (req, reply) => {
    const { code } = wechatLoginSchema.parse(req.body)
    const { openid } = await wxCode2Session(code)

    const rows = await query<{ id: string; name: string; familyId: string; role: string }>(
      `SELECT id, name, familyId, role FROM User WHERE wxOpenid = ? LIMIT 1`, [openid]
    )
    const user = rows[0]

    if (user) {
      const token = signToken(app, { sub: user.id, familyId: user.familyId, role: user.role })
      return { user: { id: user.id, name: user.name, role: user.role, familyId: user.familyId }, token, isNewUser: false }
    }

    const tempToken = signToken(app, { openid, familyId: null, role: "tmp" })
    return { tempToken, isNewUser: true }
  })

  // POST /api/auth/bind-phone
  app.post("/api/auth/bind-phone", async (req, reply) => {
    const { tempToken, phone, password } = bindPhoneSchema.parse(req.body)

    let openid: string
    try {
      const decoded = app.jwt.verify(tempToken) as { openid: string }
      openid = decoded.openid
    } catch {
      return reply.status(401).send({ error: "临时 token 无效或已过期" })
    }

    const users = await query<{ id: string; passwordHash: string; familyId: string; role: string; name: string }>(
      `SELECT id, name, passwordHash, familyId, role FROM User WHERE phone = ? LIMIT 1`, [phone]
    )
    const existingUser = users[0]

    if (existingUser) {
      const valid = await bcrypt.compare(password, existingUser.passwordHash)
      if (!valid) return reply.status(401).send({ error: "密码错误" })

      await execute(`UPDATE User SET wxOpenid = ? WHERE id = ?`, [openid, existingUser.id])
      const token = signToken(app, { sub: existingUser.id, familyId: existingUser.familyId, role: existingUser.role })
      return { user: { id: existingUser.id, name: existingUser.name, role: existingUser.role, familyId: existingUser.familyId }, token }
    }

    // Create new WeChat user as child
    const id = genId()
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

  // POST /api/auth/phone-login
  app.post("/api/auth/phone-login", async (req, reply) => {
    const { phone, password } = phoneLoginSchema.parse(req.body)

    const rows = await query<{ id: string; name: string; passwordHash: string; familyId: string; role: string }>(
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

  // POST /api/auth/register
  app.post("/api/auth/register", async (req, reply) => {
    const { name, phone, password } = registerSchema.parse(req.body)

    const existing = await query<{ id: string }>(`SELECT id FROM User WHERE phone = ?`, [phone])
    if (existing.length > 0) {
      return reply.status(409).send({ error: "该手机号已注册" })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const pinCode = "1234"
    const pinHash = await bcrypt.hash(pinCode, 10)
    const familyId = genId()
    const userId = genId()
    const now = new Date()

    await execute(`INSERT INTO Family (id, name, createdAt) VALUES (?, ?, ?)`, [familyId, `${name}的家庭`, now])
    await execute(
      `INSERT INTO User (id, familyId, name, phone, passwordHash, pinCode, role, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'parent', ?)`,
      [userId, familyId, name, phone, passwordHash, pinHash, now]
    )

    // Default task templates
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

    // Default rewards
    const defaultRewards = [
      { title: "看动画片 30 分钟", pointsCost: 10, description: "可以看喜欢的动画片", icon: "📺" },
      { title: "冰淇淋一个", pointsCost: 20, description: "周末去便利店挑一个冰淇淋", icon: "🍦" },
      { title: "游戏 1 小时", pointsCost: 30, description: "周末可以玩游戏", icon: "🎮" },
      { title: "新玩具", pointsCost: 100, description: "去玩具店挑一个喜欢的玩具", icon: "🧸" },
      { title: "去游乐园", pointsCost: 200, description: "周末去游乐园玩一天", icon: "🎡" },
      { title: "选一部电影", pointsCost: 15, description: "选一部喜欢的电影全家一起看", icon: "🎬" },
    ]
    for (const r of defaultRewards) {
      await execute(
        `INSERT INTO Reward (id, familyId, title, icon, description, pointsCost, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [genId(), familyId, r.title, r.icon, r.description, r.pointsCost, now]
      )
    }

    const token = signToken(app, { sub: userId, familyId, role: "parent" })
    return { user: { id: userId, name, role: "parent", familyId }, token, pinCode }
  })

  // POST /api/auth/verify-pin
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

    const token = signToken(app, { ...req.user, viewMode: "parent" })
    return { success: true, token }
  })

  // PUT /api/auth/password
  app.put("/api/auth/password", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body)

    const rows = await query<{ passwordHash: string | null }>(
      `SELECT passwordHash FROM User WHERE id = ? LIMIT 1`,
      [req.user.sub]
    )
    const user = rows[0]
    if (!user) return reply.status(404).send({ error: "用户不存在" })
    if (!user.passwordHash) return reply.status(400).send({ error: "该账号未设置密码" })

    const valid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: "当前密码错误" })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await execute(`UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?`, [passwordHash, new Date(), req.user.sub])
    return { success: true }
  })

  // GET /api/auth/select-child
  app.get("/api/auth/select-child", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const childId = req.headers["x-selected-child-id"]
    if (!childId) return reply.send(null)

    const rows = await query<{ id: string; name: string; ageGroup: string }>(
      `SELECT id, name, ageGroup FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    return reply.send(rows[0] ?? null)
  })

  // POST /api/auth/select-child
  app.post("/api/auth/select-child", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const { childId } = selectChildSchema.parse(req.body)

    const rows = await query<{ id: string }>(
      `SELECT id FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    if (!rows[0]) return reply.status(404).send({ error: "小朋友不存在" })

    return reply.send({ success: true, childId })
  })

  // POST /api/auth/logout
  app.post("/api/auth/logout", async () => {
    return { success: true }
  })

  // GET /api/auth/session
  app.get("/api/auth/session", async (req: any) => {
    try {
      await req.jwtVerify()
      return { user: req.user }
    } catch {
      return { user: null }
    }
  })
}
