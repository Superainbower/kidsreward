import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db"
import { genId } from "../lib/id"
import { createRewardSchema, updateRewardSchema } from "../schemas/index"

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
