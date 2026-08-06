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
export const updateTemplateSchema = createTemplateSchema.extend({
  isActive: z.boolean().optional(),
})

// Rewards
export const createRewardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pointsCost: z.number().int().min(1),
  imageUrl: z.string().optional(),
  icon: z.string().optional(),
})
export const updateRewardSchema = createRewardSchema.extend({
  isActive: z.boolean().optional(),
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
