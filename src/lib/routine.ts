import { query, pool } from "./db"
import { genId } from "./id"

export type RoutinePeriod = "daily" | "weekly" | "monthly"

export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date())
}

function toUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** 子任务所属周期的起始日（也是完成记录、结算记录使用的日期键） */
export function periodStartStr(period: string, dateStr: string): string {
  const d = toUtcDate(dateStr)
  if (period === "weekly") {
    const day = d.getUTCDay() // 0 = 周日
    d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  } else if (period === "monthly") {
    d.setUTCDate(1)
  }
  return toStr(d)
}

/** 子任务所属周期的结束日（含当天） */
export function periodEndStr(period: string, startStr: string): string {
  const d = toUtcDate(startStr)
  if (period === "weekly") {
    d.setUTCDate(d.getUTCDate() + 6)
  } else if (period === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1, 0)
  }
  return toStr(d)
}

export function periodLabel(period: string): string {
  if (period === "weekly") return "每周"
  if (period === "monthly") return "每月"
  return "每日"
}

function settlementReason(period: string, start: string, end: string): string {
  if (period === "weekly") return `每周任务结算: ${start}~${end}`
  if (period === "monthly") return `每月任务结算: ${start.slice(0, 7)}`
  return `每日任务结算: ${start}`
}

/**
 * 按周期结算：只处理周期已经结束（结束日早于今天）、且完成进度达标、还没结算过的子任务。
 * 每个子任务每个周期只结算一次，幂等，可重复调用；由读取今日任务 / 积分接口时顺带触发。
 */
export async function settleDueDays(familyId: string) {
  const today = todayStr()

  const rows = await query<{
    childId: string; subtaskId: string; period: string
    quantity: number; points: number
    completedDate: string
  }>(
    `SELECT sc.childId, sc.subtaskId, s.period, s.quantity, s.points,
            DATE_FORMAT(sc.completedDate, '%Y-%m-%d') AS completedDate
       FROM SubtaskCompletion sc
       JOIN TemplateSubtask s ON s.id = sc.subtaskId
      WHERE sc.familyId = ? AND sc.progress >= s.quantity`,
    [familyId]
  )

  // 按（小朋友 + 子任务 + 周期起始日）归组，避免同周期多条记录重复加分
  const groups = new Map<string, {
    childId: string; subtaskId: string; period: string; start: string; points: number
  }>()
  for (const r of rows) {
    const start = periodStartStr(r.period, r.completedDate)
    if (periodEndStr(r.period, start) >= today) continue // 周期还没结束
    const key = `${r.childId}|${r.subtaskId}|${start}`
    if (groups.has(key)) continue
    groups.set(key, {
      childId: r.childId,
      subtaskId: r.subtaskId,
      period: r.period,
      start,
      points: Number(r.points) || 0,
    })
  }

  for (const group of groups.values()) {
    const exists = await query<{ id: string }>(
      `SELECT id FROM RoutineSettlement WHERE childId = ? AND subtaskId = ? AND settledDate = ? LIMIT 1`,
      [group.childId, group.subtaskId, group.start]
    )
    if (exists[0]) continue

    const end = periodEndStr(group.period, group.start)
    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()
      const now = new Date()
      await conn.execute(
        `INSERT INTO RoutineSettlement (id, familyId, childId, subtaskId, settledDate, points, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [genId("stl"), familyId, group.childId, group.subtaskId, group.start, group.points, now]
      )
      if (group.points > 0) {
        await conn.execute(
          `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'routine_settle', ?, ?, ?)`,
          [
            genId("pts"), familyId, group.childId, group.points,
            settlementReason(group.period, group.start, end), group.subtaskId, now,
          ]
        )
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}
