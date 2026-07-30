import Fastify from "fastify"
import fjwt from "@fastify/jwt"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import { authRoutes } from "./routes/auth"
import { taskRoutes } from "./routes/tasks"
import { templateRoutes } from "./routes/templates"
import { rewardRoutes } from "./routes/rewards"
import { redemptionRoutes } from "./routes/redemptions"
import { pointsRoutes } from "./routes/points"
import { familyRoutes } from "./routes/family"

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(rateLimit, { max: 30, timeWindow: "1 minute" })

  await app.register(fjwt, {
    secret: process.env.JWT_SECRET!,
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

  return app
}
