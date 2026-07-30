import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db"
import { genId } from "../lib/id"
import { createTemplateSchema, updateTemplateSchema } from "../schemas/index"

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
