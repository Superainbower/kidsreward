// src/lib/auth.ts
import type { FastifyInstance } from "fastify"

// 微信 code2Session 换取 openid
export async function wxCode2Session(code: string): Promise<{ openid: string }> {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) throw new Error("WECHAT_APPID/WECHAT_SECRET not set")

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
  const res = await fetch(url)
  const data = await res.json() as any
  if (data.errcode || !data.openid) {
    throw new Error(`wx.code2Session failed: ${data.errmsg || "unknown"}`)
  }
  return { openid: data.openid }
}

// 签发 JWT
export function signToken(app: FastifyInstance, payload: Record<string, unknown>) {
  return app.jwt.sign(payload, { expiresIn: "7d" })
}

// 扩展 Fastify 类型声明
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}
