import type { FastifyInstance } from "fastify"
import { query, execute } from "../lib/db"
import { genId } from "../lib/id"
import { todayStr, settleDueDays } from "../lib/routine"
import {
  routineTemplateSchema, routineCategorySchema, routineSubtaskCreateSchema,
  routineSubtaskUpdateSchema, routineAssignSchema, routineCompleteSchema,
} from "../schemas/index"

interface TemplateRow { id: string; title: string }
interface CategoryRow { id: string; templateId: string; name: string; sortOrder: number }
interface SubtaskRow {
  id: string; categoryId: string; name: string; points: number
  quantity: number; choiceGroup: string | null; sortOrder: number
}

async function loadTemplates(familyId: string, templateId?: string) {
  const templates = templateId
    ? await query<TemplateRow>(
        `SELECT id, title FROM TaskTemplate WHERE familyId = ? AND isRoutine = 1 AND isActive = 1 AND id = ?`,
        [familyId, templateId]
      )
    : await query<TemplateRow>(
        `SELECT id, title FROM TaskTemplate WHERE familyId = ? AND isRoutine = 1 AND isActive = 1 ORDER BY createdAt ASC`,
        [familyId]
      )
  if (templates.length === 0) return []

  const ids = templates.map(t => t.id)
  const categories = await query<CategoryRow>(
    `SELECT id, templateId, name, sortOrder FROM TemplateCategory WHERE templateId IN (${ids.map(() => "?").join(",")}) ORDER BY sortOrder ASC, createdAt ASC`,
    ids
  )
  const catIds = categories.map(c => c.id)
  const subtasks = catIds.length
    ? await query<SubtaskRow>(
        `SELECT id, categoryId, name, points, quantity, choiceGroup, sortOrder FROM TemplateSubtask WHERE categoryId IN (${catIds.map(() => "?").join(",")}) ORDER BY sortOrder ASC, createdAt ASC`,
        catIds
      )
    : []

  return templates.map(t => ({
    id: t.id,
    name: t.title,
    categories: categories
      .filter(c => c.templateId === t.id)
      .map(c => ({
        id: c.id,
        name: c.name,
        subtasks: subtasks
          .filter(s => s.categoryId === c.id)
          .map(s => ({
            id: s.id, name: s.name, points: s.points,
            quantity: s.quantity, choiceGroup: s.choiceGroup,
          })),
      })),
  }))
}

async function categoryOwned(id: string, familyId: string) {
  const rows = await query<{ id: string }>(
    `SELECT c.id FROM TemplateCategory c JOIN TaskTemplate t ON t.id = c.templateId WHERE c.id = ? AND t.familyId = ? LIMIT 1`,
    [id, familyId]
  )
  return rows.length > 0
}

async function subtaskOwned(id: string, familyId: string) {
  const rows = await query<{ id: string }>(
    `SELECT s.id FROM TemplateSubtask s JOIN TemplateCategory c ON c.id = s.categoryId JOIN TaskTemplate t ON t.id = c.templateId WHERE s.id = ? AND t.familyId = ? LIMIT 1`,
    [id, familyId]
  )
  return rows.length > 0
}

export async function routineRoutes(app: FastifyInstance) {

  // GET /api/routine/templates — 模板列表（含大类与子任务）
  app.get("/api/routine/templates", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    return reply.send(await loadTemplates(req.user.familyId))
  })

  // POST /api/routine/templates — 新建模板
  app.post("/api/routine/templates", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    const { name } = routineTemplateSchema.parse(req.body)
    const id = genId()
    const now = new Date()
    await execute(
      `INSERT INTO TaskTemplate (id, familyId, title, description, points, category, icon, isActive, isRoutine, updatedAt) VALUES (?, ?, ?, NULL, 0, 'routine', '📋', 1, 1, ?)`,
      [id, req.user.familyId, name, now]
    )
    return reply.send({ id, name, categories: [] })
  })

  // PUT /api/routine/templates/:id — 模板改名
  app.put("/api/routine/templates/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    const { name } = routineTemplateSchema.parse(req.body)
    await execute(
      `UPDATE TaskTemplate SET title = ?, updatedAt = ? WHERE id = ? AND familyId = ? AND isRoutine = 1`,
      [name, new Date(), req.params.id, req.user.familyId]
    )
    return reply.send({ success: true })
  })

  // DELETE /api/routine/templates/:id — 删除模板
  app.delete("/api/routine/templates/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    await execute(`DELETE FROM ChildTemplateAssignment WHERE templateId = ?`, [req.params.id])
    await execute(
      `UPDATE TaskTemplate SET isActive = 0, updatedAt = ? WHERE id = ? AND familyId = ? AND isRoutine = 1`,
      [new Date(), req.params.id, req.user.familyId]
    )
    return reply.send({ success: true })
  })

  // POST /api/routine/templates/:id/categories — 新增大类
  app.post("/api/routine/templates/:id/categories", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    const { name } = routineCategorySchema.parse(req.body)
    const templates = await query<{ id: string }>(
      `SELECT id FROM TaskTemplate WHERE id = ? AND familyId = ? AND isRoutine = 1 LIMIT 1`,
      [req.params.id, req.user.familyId]
    )
    if (!templates[0]) return reply.status(404).send({ error: "模板不存在" })

    const maxRows = await query<{ maxOrder: number | null }>(
      `SELECT MAX(sortOrder) AS maxOrder FROM TemplateCategory WHERE templateId = ?`,
      [req.params.id]
    )
    const id = genId()
    await execute(
      `INSERT INTO TemplateCategory (id, templateId, name, sortOrder) VALUES (?, ?, ?, ?)`,
      [id, req.params.id, name, (maxRows[0]?.maxOrder ?? -1) + 1]
    )
    return reply.send({ id, name, subtasks: [] })
  })

  // PUT /api/routine/categories/:id — 大类改名
  app.put("/api/routine/categories/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    if (!(await categoryOwned(req.params.id, req.user.familyId))) return reply.status(404).send({ error: "大类不存在" })
    const { name } = routineCategorySchema.parse(req.body)
    await execute(`UPDATE TemplateCategory SET name = ? WHERE id = ?`, [name, req.params.id])
    return reply.send({ success: true })
  })

  // DELETE /api/routine/categories/:id — 删除大类（连同子任务）
  app.delete("/api/routine/categories/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    if (!(await categoryOwned(req.params.id, req.user.familyId))) return reply.status(404).send({ error: "大类不存在" })
    await execute(`DELETE FROM TemplateCategory WHERE id = ?`, [req.params.id])
    return reply.send({ success: true })
  })

  // POST /api/routine/categories/:id/subtasks — 新增子任务
  app.post("/api/routine/categories/:id/subtasks", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    if (!(await categoryOwned(req.params.id, req.user.familyId))) return reply.status(404).send({ error: "大类不存在" })
    const { name, points, quantity, choiceGroup } = routineSubtaskCreateSchema.parse(req.body)

    const maxRows = await query<{ maxOrder: number | null }>(
      `SELECT MAX(sortOrder) AS maxOrder FROM TemplateSubtask WHERE categoryId = ?`,
      [req.params.id]
    )
    const id = genId()
    await execute(
      `INSERT INTO TemplateSubtask (id, categoryId, name, points, quantity, choiceGroup, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, name, points, quantity, choiceGroup ?? null, (maxRows[0]?.maxOrder ?? -1) + 1]
    )
    return reply.send({ id, name, points, quantity, choiceGroup: choiceGroup ?? null })
  })

  // PUT /api/routine/subtasks/:id — 修改子任务
  app.put("/api/routine/subtasks/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    if (!(await subtaskOwned(req.params.id, req.user.familyId))) return reply.status(404).send({ error: "子任务不存在" })
    const { name, points, quantity, choiceGroup } = routineSubtaskUpdateSchema.parse(req.body)

    const rows = await query<{ name: string; points: number; quantity: number; choiceGroup: string | null }>(
      `SELECT name, points, quantity, choiceGroup FROM TemplateSubtask WHERE id = ? LIMIT 1`,
      [req.params.id]
    )
    const current = rows[0]
    await execute(
      `UPDATE TemplateSubtask SET name = ?, points = ?, quantity = ?, choiceGroup = ? WHERE id = ?`,
      [
        name ?? current.name,
        points ?? current.points,
        quantity ?? current.quantity,
        choiceGroup === undefined ? current.choiceGroup : choiceGroup,
        req.params.id,
      ]
    )
    return reply.send({ success: true })
  })

  // DELETE /api/routine/subtasks/:id — 删除子任务
  app.delete("/api/routine/subtasks/:id", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    if (!(await subtaskOwned(req.params.id, req.user.familyId))) return reply.status(404).send({ error: "子任务不存在" })
    await execute(`DELETE FROM TemplateSubtask WHERE id = ?`, [req.params.id])
    return reply.send({ success: true })
  })

  // GET /api/routine/assignments — 孩子与模板绑定情况
  app.get("/api/routine/assignments", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const children = await query<{ id: string; name: string; templateId: string | null }>(
      `SELECT u.id, u.name, a.templateId
         FROM User u
         LEFT JOIN ChildTemplateAssignment a ON a.childId = u.id
        WHERE u.familyId = ? AND u.role = 'child'
        ORDER BY u.createdAt ASC`,
      [req.user.familyId]
    )
    return reply.send(children)
  })

  // POST /api/routine/assign — 给小朋友绑定模板
  app.post("/api/routine/assign", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    if (req.user.role !== "parent") return reply.status(403).send({ error: "权限不足" })
    const { childId, templateId } = routineAssignSchema.parse(req.body)

    const children = await query<{ id: string }>(
      `SELECT id FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    if (!children[0]) return reply.status(404).send({ error: "小朋友不存在" })
    const templates = await query<{ id: string }>(
      `SELECT id FROM TaskTemplate WHERE id = ? AND familyId = ? AND isRoutine = 1 AND isActive = 1 LIMIT 1`,
      [templateId, req.user.familyId]
    )
    if (!templates[0]) return reply.status(404).send({ error: "模板不存在" })

    await execute(
      `INSERT INTO ChildTemplateAssignment (childId, templateId, updatedAt) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE templateId = VALUES(templateId), updatedAt = VALUES(updatedAt)`,
      [childId, templateId, new Date()]
    )
    return reply.send({ success: true })
  })

  // GET /api/routine/today — 今日任务（模板结构 + 今日进度）
  app.get("/api/routine/today", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    await settleDueDays(req.user.familyId)

    const { childId: queryChildId } = req.query as Record<string, string>
    const childId = queryChildId || (req.user.role === "child" ? req.user.sub : "")
    if (!childId) return reply.status(400).send({ error: "缺少 childId" })

    const children = await query<{ id: string; name: string }>(
      `SELECT id, name FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    const child = children[0]
    if (!child) return reply.status(404).send({ error: "小朋友不存在" })

    const date = todayStr()
    const assignments = await query<{ templateId: string }>(
      `SELECT templateId FROM ChildTemplateAssignment WHERE childId = ? LIMIT 1`,
      [childId]
    )
    const templateId = assignments[0]?.templateId
    if (!templateId) {
      return reply.send({ date, child, template: null, progress: { done: 0, total: 0 }, categories: [] })
    }

    const templates = await loadTemplates(req.user.familyId, templateId)
    const template = templates[0]
    if (!template) {
      return reply.send({ date, child, template: null, progress: { done: 0, total: 0 }, categories: [] })
    }

    const completions = await query<{ subtaskId: string; progress: number }>(
      `SELECT subtaskId, progress FROM SubtaskCompletion WHERE childId = ? AND completedDate = ?`,
      [childId, date]
    )
    const progressMap = new Map(completions.map(c => [c.subtaskId, Number(c.progress)]))
    const isDone = (s: { id: string; quantity: number }) => (progressMap.get(s.id) || 0) >= s.quantity

    let done = 0
    let total = 0
    const categories = template.categories.map(cat => {
      const countedGroups = new Set<string>()
      for (const s of cat.subtasks) {
        if (s.choiceGroup) {
          if (countedGroups.has(s.choiceGroup)) continue
          countedGroups.add(s.choiceGroup)
          total += 1
          if (cat.subtasks.some(o => o.choiceGroup === s.choiceGroup && isDone(o))) done += 1
        } else {
          total += 1
          if (isDone(s)) done += 1
        }
      }
      return {
        id: cat.id,
        name: cat.name,
        subtasks: cat.subtasks.map(s => {
          const progress = progressMap.get(s.id) || 0
          const completed = progress >= s.quantity
          const groupDone = s.choiceGroup
            ? cat.subtasks.some(o => o.choiceGroup === s.choiceGroup && isDone(o))
            : false
          return { ...s, progress, completed, locked: groupDone && !completed }
        }),
      }
    })

    return reply.send({
      date,
      child,
      template: { id: template.id, name: template.name },
      progress: { done, total },
      categories,
    })
  })

  // POST /api/routine/complete — 点击一次：进度 +1；已满再点则清零（取消）
  app.post("/api/routine/complete", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const parsed = routineCompleteSchema.parse(req.body)
    const childId = parsed.childId || (req.user.role === "child" ? req.user.sub : "")
    if (!childId) return reply.status(400).send({ error: "缺少 childId" })

    const children = await query<{ id: string }>(
      `SELECT id FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    if (!children[0]) return reply.status(404).send({ error: "小朋友不存在" })

    const assignments = await query<{ templateId: string }>(
      `SELECT templateId FROM ChildTemplateAssignment WHERE childId = ? LIMIT 1`,
      [childId]
    )
    const templateId = assignments[0]?.templateId
    if (!templateId) return reply.status(400).send({ error: "尚未分配任务模板" })

    const subtasks = await query<{ id: string; name: string; points: number; quantity: number; choiceGroup: string | null }>(
      `SELECT s.id, s.name, s.points, s.quantity, s.choiceGroup
         FROM TemplateSubtask s
         JOIN TemplateCategory c ON c.id = s.categoryId
        WHERE s.id = ? AND c.templateId = ?
        LIMIT 1`,
      [parsed.subtaskId, templateId]
    )
    const subtask = subtasks[0]
    if (!subtask) return reply.status(404).send({ error: "子任务不存在" })

    const date = todayStr()
    const rows = await query<{ id: string; progress: number }>(
      `SELECT id, progress FROM SubtaskCompletion WHERE childId = ? AND subtaskId = ? AND completedDate = ? LIMIT 1`,
      [childId, subtask.id, date]
    )
    const current = Number(rows[0]?.progress || 0)

    if (current >= subtask.quantity) {
      await execute(
        `DELETE FROM SubtaskCompletion WHERE childId = ? AND subtaskId = ? AND completedDate = ?`,
        [childId, subtask.id, date]
      )
      return reply.send({ success: true, progress: 0, quantity: subtask.quantity, completed: false })
    }

    const next = current + 1
    if (next >= subtask.quantity && subtask.choiceGroup) {
      const conflicts = await query<{ id: string }>(
        `SELECT sc.id
           FROM SubtaskCompletion sc
           JOIN TemplateSubtask s2 ON s2.id = sc.subtaskId
          WHERE sc.childId = ? AND sc.completedDate = ? AND s2.choiceGroup = ? AND s2.id <> ? AND sc.progress >= s2.quantity
          LIMIT 1`,
        [childId, date, subtask.choiceGroup, subtask.id]
      )
      if (conflicts[0]) return reply.status(400).send({ error: "该二选一任务已完成" })
    }

    if (rows[0]) {
      await execute(`UPDATE SubtaskCompletion SET progress = ?, pointsAwarded = 0 WHERE id = ?`, [next, rows[0].id])
    } else {
      await execute(
        `INSERT INTO SubtaskCompletion (id, familyId, childId, subtaskId, completedDate, progress, pointsAwarded, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [genId("sub"), req.user.familyId, childId, subtask.id, date, next, new Date()]
      )
    }

    return reply.send({
      success: true,
      progress: next,
      quantity: subtask.quantity,
      completed: next >= subtask.quantity,
    })
  })

  // POST /api/routine/uncomplete — 直接清零（保留给长按等操作）
  app.post("/api/routine/uncomplete", async (req: any, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: "未登录" }) }
    const parsed = routineCompleteSchema.parse(req.body)
    const childId = parsed.childId || (req.user.role === "child" ? req.user.sub : "")
    if (!childId) return reply.status(400).send({ error: "缺少 childId" })

    const children = await query<{ id: string }>(
      `SELECT id FROM User WHERE id = ? AND familyId = ? AND role = 'child' LIMIT 1`,
      [childId, req.user.familyId]
    )
    if (!children[0]) return reply.status(404).send({ error: "小朋友不存在" })

    await execute(
      `DELETE FROM SubtaskCompletion WHERE childId = ? AND subtaskId = ? AND completedDate = ?`,
      [childId, parsed.subtaskId, todayStr()]
    )
    return reply.send({ success: true, progress: 0, completed: false })
  })
}
