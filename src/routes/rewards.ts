import type { FastifyInstance } from "fastify"
import { query, execute, pool } from "../lib/db"
import { genId } from "../lib/id"
import { createRewardSchema, updateRewardSchema } from "../schemas/index"

interface LotteryItem {
  label: string
  type: "points" | "reward"
  points?: number
  probability: number
  icon?: string
}

interface RewardRow {
  id: string
  familyId: string
  title: string
  icon: string
  description: string | null
  pointsCost: number
  kind: string | null
  lotteryItems: string | null
  imageUrl: string | null
  isActive: number | boolean
}

function parseItems(raw: unknown): LotteryItem[] {
  if (typeof raw !== "string" || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((it: any) => it && typeof it.label === "string")
      .map((it: any) => ({
        label: String(it.label),
        type: it.type === "points" ? "points" as const : "reward" as const,
        points: it.type === "points" ? Number(it.points) || 0 : undefined,
        probability: Number(it.probability) || 0,
        icon: typeof it.icon === "string" ? it.icon : undefined,
      }))
  } catch {
    return []
  }
}

function toReward(row: RewardRow) {
  return {
    ...row,
    kind: row.kind || "normal",
    lotteryItems: parseItems(row.lotteryItems),
  }
}

function checkLottery(kind: string, items: LotteryItem[]): string | null {
  if (kind !== "lottery") return null
  if (items.length === 0) return "抽奖奖品至少需要配置一个奖项"
  for (const item of items) {
    if (!item.label.trim()) return "奖项内容不能为空"
    if (!(Number(item.probability) > 0)) return "每个奖项的概率需大于 0"
    if (item.type === "points" && !(Number(item.points) > 0)) return "积分奖项需要填写大于 0 的积分"
  }
  const total = items.reduce((sum, item) => sum + Number(item.probability), 0)
  if (Math.abs(total - 1) > 0.0001) return "所有奖项概率之和需为 1"
  return null
}

export async function rewardRoutes(app: FastifyInstance) {

  app.get("/api/rewards", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const rewards = await query<RewardRow>(
      `SELECT * FROM Reward WHERE familyId = ? AND isActive = 1 ORDER BY pointsCost ASC`,
      [req.user.familyId]
    )
    return reply.send(rewards.map(toReward))
  })

  app.post("/api/rewards", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const data = createRewardSchema.parse(req.body)
    const kind = data.kind || "normal"
    const items = (data.lotteryItems ?? []) as LotteryItem[]
    const configError = checkLottery(kind, items)
    if (configError) return reply.status(400).send({ error: configError })

    const id = genId()
    const now = new Date()
    await execute(
      `INSERT INTO Reward (id, familyId, title, icon, description, pointsCost, kind, lotteryItems, imageUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.user.familyId, data.title, data.icon ?? "🎁", data.description ?? null,
        data.pointsCost, kind, kind === "lottery" ? JSON.stringify(items) : null,
        data.imageUrl ?? null, now,
      ]
    )
    const rows = await query<RewardRow>(`SELECT * FROM Reward WHERE id = ?`, [id])
    return reply.send(toReward(rows[0]))
  })

  app.put("/api/rewards/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })

    const { id } = req.params
    const data = updateRewardSchema.parse(req.body)
    const rows = await query<RewardRow>(
      `SELECT * FROM Reward WHERE id = ? AND familyId = ?`,
      [id, req.user.familyId]
    )
    const existing = rows[0]
    if (!existing) return reply.status(404).send({ error: "奖品不存在" })

    const kind = data.kind ?? existing.kind ?? "normal"
    const items = (data.lotteryItems ?? parseItems(existing.lotteryItems)) as LotteryItem[]
    const configError = checkLottery(kind, items)
    if (configError) return reply.status(400).send({ error: configError })

    await execute(
      `UPDATE Reward SET title = ?, icon = ?, description = ?, pointsCost = ?, kind = ?, lotteryItems = ?, imageUrl = ?, isActive = ?, updatedAt = ? WHERE id = ? AND familyId = ?`,
      [
        data.title ?? existing.title,
        data.icon ?? existing.icon ?? "🎁",
        data.description === undefined ? existing.description : data.description,
        data.pointsCost ?? existing.pointsCost,
        kind,
        kind === "lottery" ? JSON.stringify(items) : (existing.lotteryItems ?? null),
        data.imageUrl === undefined ? existing.imageUrl : data.imageUrl,
        data.isActive === undefined ? Boolean(existing.isActive) : data.isActive,
        new Date(),
        id,
        req.user.familyId,
      ]
    )
    const updated = await query<RewardRow>(`SELECT * FROM Reward WHERE id = ?`, [id])
    return reply.send(toReward(updated[0]))
  })

  // POST /api/rewards/:id/draw — 抽奖：扣积分，按概率开奖，中奖积分直接入账
  app.post("/api/rewards/:id/draw", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }

    const body = (req.body ?? {}) as { childId?: string }
    const actualChildId = req.user.role === "child"
      ? req.user.sub
      : (body.childId || req.headers["x-selected-child-id"])
    if (!actualChildId) return reply.status(400).send({ error: "请选择小朋友" })

    const children = await query<{ id: string }>(
      `SELECT id FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [actualChildId, req.user.familyId]
    )
    if (!children[0]) return reply.status(404).send({ error: "小朋友不存在" })

    const rewards = await query<RewardRow>(
      `SELECT * FROM Reward WHERE id = ? AND familyId = ? AND isActive = 1 LIMIT 1`,
      [req.params.id, req.user.familyId]
    )
    const reward = rewards[0]
    if (!reward) return reply.status(404).send({ error: "奖品不存在或已下架" })
    if ((reward.kind || "normal") !== "lottery") return reply.status(400).send({ error: "该奖品不是抽奖奖品" })

    const items = parseItems(reward.lotteryItems)
    const configError = checkLottery("lottery", items)
    if (configError) return reply.status(400).send({ error: configError })

    const cost = Number(reward.pointsCost)
    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()

      const [balanceRows] = await conn.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM PointsTransaction WHERE familyId = ? AND userId = ?`,
        [req.user.familyId, actualChildId]
      )
      const balance = Number((balanceRows as any[])[0]?.total || 0)
      if (balance < cost) {
        await conn.rollback()
        return reply.status(400).send({ error: "积分不足" })
      }

      // 按配置概率随机抽取
      const roll = Math.random()
      let accumulated = 0
      let index = items.length - 1
      for (let i = 0; i < items.length; i++) {
        accumulated += Number(items[i].probability)
        if (roll < accumulated) { index = i; break }
      }
      const prize = items[index]

      const now = new Date()
      await conn.execute(
        `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'lottery_draw', ?, ?, ?)`,
        [genId("pts"), req.user.familyId, actualChildId, -cost, `抽奖消耗: ${reward.title}`, reward.id, now]
      )
      const winAmount = prize.type === "points" ? Number(prize.points) : 0
      await conn.execute(
        `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'lottery_win', ?, ?, ?)`,
        [
          genId("pts"), req.user.familyId, actualChildId, winAmount,
          prize.type === "points" ? `抽奖奖励: ${prize.label}` : `抽奖获得: ${prize.label}`,
          reward.id, now,
        ]
      )
      await conn.commit()

      const totals = await query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM PointsTransaction WHERE familyId = ? AND userId = ?`,
        [req.user.familyId, actualChildId]
      )
      return reply.send({
        result: prize,
        index,
        balance: Number(totals[0]?.total || 0),
      })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  })
}
