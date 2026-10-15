import { query, execute, pool } from "./db"
import { genId } from "./id"

export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date())
}

/**
 * 每日结算：把今天之前、还没结算过的完成记录换算成积分。
 * 幂等，可重复调用；由读取今日任务 / 积分接口时顺带触发。
 */
export async function settleDueDays(familyId: string) {
  const today = todayStr()
  const pending = await query<{ childId: string; completedDate: string }>(
    `SELECT sc.childId, DATE_FORMAT(sc.completedDate, '%Y-%m-%d') AS completedDate
       FROM SubtaskCompletion sc
       LEFT JOIN RoutineSettlement rs
              ON rs.childId = sc.childId AND rs.settledDate = sc.completedDate
      WHERE sc.familyId = ? AND sc.completedDate < ? AND rs.id IS NULL
      GROUP BY sc.childId, sc.completedDate`,
    [familyId, today]
  )

  for (const row of pending) {
    const exists = await query<{ id: string }>(
      `SELECT id FROM RoutineSettlement WHERE childId = ? AND settledDate = ? LIMIT 1`,
      [row.childId, row.completedDate]
    )
    if (exists[0]) continue

    const sums = await query<{ points: number }>(
      `SELECT COALESCE(SUM(s.points), 0) AS points
         FROM SubtaskCompletion sc
         JOIN TemplateSubtask s ON s.id = sc.subtaskId
        WHERE sc.childId = ? AND sc.completedDate = ? AND sc.progress >= s.quantity`,
      [row.childId, row.completedDate]
    )
    const points = Number(sums[0]?.points || 0)

    const conn = await pool().getConnection()
    try {
      await conn.beginTransaction()
      const now = new Date()
      await conn.execute(
        `INSERT INTO RoutineSettlement (id, familyId, childId, settledDate, points, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [genId("stl"), familyId, row.childId, row.completedDate, points, now]
      )
      if (points > 0) {
        await conn.execute(
          `INSERT INTO PointsTransaction (id, familyId, userId, amount, type, reason, referenceId, createdAt) VALUES (?, ?, ?, ?, 'routine_settle', ?, NULL, ?)`,
          [genId("pts"), familyId, row.childId, points, `每日任务结算: ${row.completedDate}`, now]
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
