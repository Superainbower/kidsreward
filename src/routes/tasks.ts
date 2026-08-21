import type { FastifyInstance } from "fastify"
import { query, execute, pool } from "../lib/db"
import { genId } from "../lib/id"
import { createTaskSchema } from "../schemas/index"

export async function taskRoutes(app: FastifyInstance) {

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

  app.post("/api/tasks/:id/reveal-egg", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const { id } = req.params

    const rows = await query<{ id: string; familyId: string; status: string; templateId: string | null }>(
      `SELECT * FROM Task WHERE id = ?`, [id]
    )
    const task = rows[0]
    if (!task || task.familyId !== req.user.familyId) return reply.status(404).send({ error: "任务不存在" })
    if (task.status !== "pending") return reply.status(400).send({ error: "任务已提交" })
    if (!task.templateId) return reply.status(400).send({ error: "该任务未设置彩蛋" })

    const tplRows = await query<{ eggEnabled: number | boolean; eggRewards: string | null }>(
      `SELECT eggEnabled, eggRewards FROM TaskTemplate WHERE id = ? AND familyId = ?`, [task.templateId, req.user.familyId]
    )
    const tpl = tplRows[0]
    if (!tpl || !tpl.eggEnabled) return reply.status(400).send({ error: "该任务未设置彩蛋" })

    let rewards: { type: string; title: string; points?: number; weight?: number }[] = []
    try { rewards = JSON.parse(tpl.eggRewards || "[]") } catch { rewards = [] }
    if (!rewards.length) return reply.status(400).send({ error: "彩蛋奖励为空" })

    const totalWeight = rewards.reduce((sum, r) => sum + (r.weight || 1), 0)
    let rand = Math.random() * totalWeight
    let picked = rewards[0]
    for (const r of rewards) {
      rand -= r.weight || 1
      if (rand < 0) { picked = r; break }
    }

    const now = new Date()
    await execute(
      `UPDATE Task SET eggRewardType = ?, eggRewardValue = ?, eggRevealedAt = ?, updatedAt = ? WHERE id = ?`,
      [picked.type, JSON.stringify({ title: picked.title, points: picked.points ?? 0 }), now, now, id]
    )
    return reply.send({ reward: picked })
  })

  app.post("/api/tasks/:id/approve", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const rows = await query<any>(
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
      if (task.eggRewardType === "points") {
        let eggPoints = 0
        try { eggPoints = JSON.parse(task.eggRewardValue || "{}").points || 0 } catch { eggPoints = 0 }
        if (eggPoints > 0) {
          await conn.execute(
            `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'egg_reward', ?, ?, ?)`,
            [genId("pts"), task.familyId, task.assignedTo, eggPoints, `彩蛋奖励: ${task.title}`, task.id, now]
          )
        }
      }
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
