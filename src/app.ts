import Fastify from "fastify"
import fjwt from "@fastify/jwt"
import cors from "@fastify/cors"

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(fjwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  })

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: "未登录" })
    }
  })

  // Routes will be registered here in later tasks

  return app
}
