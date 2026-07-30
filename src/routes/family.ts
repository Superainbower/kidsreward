import type { FastifyInstance } from "fastify"
import bcrypt from "bcryptjs"
import { query, execute } from "../lib/db"
import { genId } from "../lib/id"
import { computeAgeGroup } from "../lib/age-group"
import { updateFamilySchema, createChildSchema, updateChildSchema, setPinSchema } from "../schemas/index"

export async function familyRoutes(app: FastifyInstance) {

  app.get("/api/family", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const families = await query<{ id: string; name: string; createdAt: string }>(
      `SELECT * FROM Family WHERE id = ?`, [req.user.familyId]
    )
    const family = families[0]
    if (!family) return reply.status(404).send({ error: "家庭不存在" })

    const users = await query<{ id: string; name: string; role: string; ageGroup: string; avatarUrl: string; createdAt: string }>(
      `SELECT id, name, role, ageGroup, avatarUrl, createdAt FROM User WHERE familyId = ?`, [req.user.familyId]
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

  app.put("/api/family/children", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    const { pinCode } = setPinSchema.parse(req.body)
    const hashedPin = await bcrypt.hash(pinCode, 10)
    await execute(`UPDATE User SET pinCode = ? WHERE familyId = ? AND role = 'parent'`, [hashedPin, req.user.familyId])
    return reply.send({ success: true })
  })

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
