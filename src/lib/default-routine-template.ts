import { execute } from "./db"
import { genId } from "./id"

interface SeedSubtask {
  name: string
  points: number
  quantity?: number
  /** 周期：每日 / 每周 / 每月，默认每日 */
  period?: "daily" | "weekly" | "monthly"
  /** 同一大类内相同标记的子任务互为一组（二选一） */
  choice?: string
}

interface SeedCategory {
  name: string
  subtasks: SeedSubtask[]
}

export const DEFAULT_ROUTINE_NAME = "二年级每日打卡"

const DEFAULT_ROUTINE: SeedCategory[] = [
  {
    name: "早读 7:00-7:30",
    subtasks: [
      { name: "语文 读1篇古诗或美文", points: 1, choice: "早读" },
      { name: "英语 读5分钟课文或背3-5个单词", points: 5, choice: "早读" },
    ],
  },
  {
    name: "语文",
    subtasks: [
      { name: "学校作业&预习复习", points: 1 },
      { name: "阅读理解3篇", points: 1, quantity: 3 },
      { name: "听写字词", points: 1 },
    ],
  },
  {
    name: "数学",
    subtasks: [
      { name: "学校作业&预习复习", points: 1 },
      { name: "课外试卷", points: 1 },
    ],
  },
  {
    name: "英语",
    subtasks: [
      { name: "学校作业&预习复习", points: 1 },
      { name: "听力作业", points: 1 },
      { name: "阅读理解3篇", points: 1, quantity: 3 },
      { name: "单词听写", points: 1 },
    ],
  },
  {
    name: "其他任务",
    subtasks: [
      { name: "钢琴练习10分钟", points: 5 },
      { name: "运动10分钟", points: 5 },
    ],
  },
  {
    name: "每日小习惯",
    subtasks: [
      { name: "早餐一杯温开水", points: 2 },
    ],
  },
]

/** 为新家庭创建默认例程模版，返回模版 id */
export async function seedDefaultRoutine(familyId: string) {
  const templateId = genId()
  const now = new Date()
  await execute(
    `INSERT INTO TaskTemplate (id, familyId, title, description, points, category, icon, isActive, isRoutine, updatedAt) VALUES (?, ?, ?, NULL, 0, 'routine', '📋', 1, 1, ?)`,
    [templateId, familyId, DEFAULT_ROUTINE_NAME, now]
  )

  for (let ci = 0; ci < DEFAULT_ROUTINE.length; ci++) {
    const cat = DEFAULT_ROUTINE[ci]
    const categoryId = genId()
    await execute(
      `INSERT INTO TemplateCategory (id, templateId, name, sortOrder) VALUES (?, ?, ?, ?)`,
      [categoryId, templateId, cat.name, ci]
    )

    const groups = new Map<string, string>()
    for (let si = 0; si < cat.subtasks.length; si++) {
      const s = cat.subtasks[si]
      let choiceGroup: string | null = null
      if (s.choice) {
        if (!groups.has(s.choice)) groups.set(s.choice, `choice-${categoryId}-${genId()}`)
        choiceGroup = groups.get(s.choice)!
      }
      await execute(
        `INSERT INTO TemplateSubtask (id, categoryId, name, points, quantity, period, choiceGroup, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [genId(), categoryId, s.name, s.points, s.quantity ?? 1, s.period ?? "daily", choiceGroup, si]
      )
    }
  }

  return templateId
}
