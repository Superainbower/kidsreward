import { buildApp } from "./app.js"

async function main() {
  const app = await buildApp()

  // 健康检查
  app.get("/api/health", async () => ({ status: "ok" }))

  const port = Number(process.env.PORT) || 3000
  await app.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening on port ${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
