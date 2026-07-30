import Fastify from "fastify"
import fjwt from "@fastify/jwt"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import { authRoutes } from "./routes/auth"

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

  return app
}
