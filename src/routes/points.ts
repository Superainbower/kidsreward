import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db"
import { genId } from "../lib/id"
import { adjustPointsSchema } from "../schemas/index"
import { settleDueDays } from "../lib/routine"

export async function pointsRoutes(app: FastifyInstance) {

  app.get("/api/points", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    await settleDueDays(req.user.familyId)

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
