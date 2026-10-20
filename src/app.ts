import Fastify from "fastify"
import fjwt from "@fastify/jwt"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import { ZodError } from "zod"
import { authRoutes } from "./routes/auth"
import { taskRoutes } from "./routes/tasks"
import { templateRoutes } from "./routes/templates"
import { rewardRoutes } from "./routes/rewards"
import { redemptionRoutes } from "./routes/redemptions"
import { pointsRoutes } from "./routes/points"
import { familyRoutes } from "./routes/family"
import { routineRoutes } from "./routes/routine"

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" })

  await app.register(fjwt, {
    secret: process.env.JWT_SECRET!,
  })

  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof ZodError) {
      const first = error.issues[0]
      return reply.status(400).send({ error: first?.message || "参数不合法" })
    }
    const statusCode = (error as any).statusCode
    const status = typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : 500
    if (status === 500) request.log.error(error)
    return reply.status(status).send({ error: error.message || "服务器错误" })
  })

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: "未登录" })
    }
  })

  await app.register(authRoutes)
  await app.register(taskRoutes)
  await app.register(templateRoutes)
  await app.register(rewardRoutes)
  await app.register(redemptionRoutes)
  await app.register(pointsRoutes)
  await app.register(familyRoutes)
  await app.register(routineRoutes)

  return app
}
