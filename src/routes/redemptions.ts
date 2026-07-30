import type { FastifyInstance } from "fastify"
import { query, execute, pool } from "../lib/db"
import { genId } from "../lib/id"
import { createRedemptionSchema, updateRedemptionSchema } from "../schemas/index"

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
