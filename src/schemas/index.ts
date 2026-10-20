import { z } from "zod"

// Auth
export const wechatLoginSchema = z.object({ code: z.string().min(1) })
export const bindPhoneSchema = z.object({
  tempToken: z.string(),
  phone: z.string().min(1),
  password: z.string().min(6),
})
export const phoneLoginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
})
export const registerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  password: z.string().min(6),
})
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(6, "新密码至少6位"),
})
export const verifyPinSchema = z.object({ pin: z.string().min(1) })
export const selectChildSchema = z.object({ childId: z.string().min(1) })

// Tasks
export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  points: z.number().int().optional(),
  type: z.string().optional(),
  assignedTo: z.string().min(1),
  templateId: z.string().optional(),
  dueDate: z.string().optional(),
})

// Templates
export const createTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  points: z.number().int().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
})
export const eggRewardSchema = z.object({
  type: z.enum(["points", "reward"]),
  title: z.string().min(1, "彩蛋奖励名称不能为空"),
  points: z.number().int().positive().optional(),
  weight: z.number().positive().default(0),
})
export const updateTemplateSchema = createTemplateSchema.extend({
  isActive: z.boolean().optional(),
  eggEnabled: z.boolean().optional(),
  eggRewards: z.array(eggRewardSchema).optional(),
}).superRefine((data, ctx) => {
  if (!data.eggEnabled || !data.eggRewards) return
  if (data.eggRewards.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eggRewards"], message: "开启彩蛋后至少需要一个彩蛋奖励" })
    return
  }
  data.eggRewards.forEach((r, i) => {
    if (r.weight <= 0 || r.weight > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eggRewards", i, "weight"], message: "单个权重需大于 0 且不超过 1" })
    }
    if (r.type === "points" && (!r.points || r.points <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eggRewards", i, "points"], message: "积分类彩蛋奖励需要填写大于 0 的积分" })
    }
  })
  const totalWeight = data.eggRewards.reduce((sum, r) => sum + r.weight, 0)
  if (Math.abs(totalWeight - 1) > 0.0001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eggRewards"], message: "所有彩蛋奖励权重之和需为 1" })
  }
})

// Rewards
export const lotteryItemSchema = z.object({
  label: z.string().min(1, "奖励内容不能为空"),
  type: z.enum(["points", "reward"]),
  points: z.number().int().positive().optional(),
  probability: z.number().positive().max(1),
  icon: z.string().optional(),
})

export const createRewardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pointsCost: z.number().int().min(1),
  imageUrl: z.string().optional(),
  icon: z.string().optional(),
  kind: z.enum(["normal", "lottery"]).default("normal"),
  lotteryItems: z.array(lotteryItemSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.kind !== "lottery") return
  const items = data.lotteryItems ?? []
  if (items.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lotteryItems"], message: "抽奖奖品至少需要配置一个奖项" })
    return
  }
  items.forEach((item, i) => {
    if (item.type === "points" && (!item.points || item.points <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lotteryItems", i, "points"], message: "积分奖项需要填写大于 0 的积分" })
    }
  })
  const total = items.reduce((sum, item) => sum + item.probability, 0)
  if (Math.abs(total - 1) > 0.0001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lotteryItems"], message: "所有奖项概率之和需为 1" })
  }
})

export const updateRewardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  pointsCost: z.number().int().min(1).optional(),
  imageUrl: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  kind: z.enum(["normal", "lottery"]).optional(),
  lotteryItems: z.array(lotteryItemSchema).optional(),
})

// Redemptions
export const createRedemptionSchema = z.object({
  rewardId: z.string().min(1),
  childId: z.string().optional(),
})
export const updateRedemptionSchema = z.object({
  action: z.enum(["approve", "reject"]),
})

// Points
export const adjustPointsSchema = z.object({
  childId: z.string().min(1),
  amount: z.number().int().refine(v => v !== 0, "积分变动额不能为 0"),
  reason: z.string().min(1),
})

// Family
export const createChildSchema = z.object({
  name: z.string().min(1),
  birthYear: z.number().int().optional(),
  birthMonth: z.number().int().optional(),
  avatarUrl: z.string().optional(),
})
export const updateChildSchema = createChildSchema
export const updateFamilySchema = z.object({ name: z.string().min(1) })
export const setPinSchema = z.object({
  pinCode: z.string().min(4, "PIN 码至少4位"),
})

// Routine templates (daily task templates)
export const routineTemplateSchema = z.object({ name: z.string().min(1, "模板名称不能为空") })
export const routineCategorySchema = z.object({ name: z.string().min(1, "大类名称不能为空") })
export const routineSubtaskCreateSchema = z.object({
  name: z.string().min(1, "子任务名称不能为空"),
  points: z.number().int().min(0).default(1),
  quantity: z.number().int().min(1).default(1),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  choiceGroup: z.string().nullable().optional(),
})
export const routineSubtaskUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  points: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).optional(),
  period: z.enum(["daily", "weekly", "monthly"]).optional(),
  choiceGroup: z.string().nullable().optional(),
})
export const routineAssignSchema = z.object({
  childId: z.string().min(1),
  templateId: z.string().min(1),
})
export const routineCompleteSchema = z.object({
  childId: z.string().min(1).optional(),
  subtaskId: z.string().min(1),
})
