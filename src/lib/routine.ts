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

  // 按（小朋友 + 周期类型 + 周期起始日）归组：同一批结算在记录里只显示一条积分流水
  const batches = new Map<string, {
    childId: string; period: string; start: string; end: string
    bySubtask: Map<string, number>
  }>()
  for (const r of rows) {
    const start = periodStartStr(r.period, r.completedDate)
    const end = periodEndStr(r.period, start)
    if (end >= today) continue // 周期还没结束
    const key = `${r.childId}|${r.period}|${start}`
    let batch = batches.get(key)
    if (!batch) {
      batch = { childId: r.childId, period: r.period, start, end, bySubtask: new Map() }
      batches.set(key, batch)
    }
    if (!batch.bySubtask.has(r.subtaskId)) {
      batch.bySubtask.set(r.subtaskId, Number(r.points) || 0)
    }
  }

  for (const batch of batches.values()) {
    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()
      const now = new Date()
      let total = 0
      for (const [subtaskId, points] of batch.bySubtask) {
        // 每个子任务仍保留结算记录（用于幂等），积分流水则按批次合并
        const [result]: any = await conn.execute(
          `INSERT IGNORE INTO RoutineSettlement (id, familyId, childId, subtaskId, settledDate, points, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [genId("stl"), familyId, batch.childId, subtaskId, batch.start, points, now]
        )
        if (result.affectedRows > 0) total += points
      }
      if (total > 0) {
        await conn.execute(
          `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'routine_settle', ?, NULL, ?)`,
          [genId("pts"), familyId, batch.childId, total, settlementReason(batch.period, batch.start, batch.end), now]
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
