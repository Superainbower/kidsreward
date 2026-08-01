import mysql from "mysql2/promise"

let _pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (_pool) return _pool

  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error("DATABASE_URL is not set")

  const parsed = new URL(raw)
  _pool = mysql.createPool({
    host: parsed.hostname,
    port: Number(parsed.port || "3306"),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "+00:00",
  })
  return _pool
}

function norm(params: unknown[]): unknown[] {
  return params.map(p => p === undefined ? null : p)
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params ? norm(params) : undefined)
  return rows as T[]
}

export async function execute(sql: string, params?: unknown[]) {
  return getPool().execute(sql, params ? norm(params) as any : undefined)
}

export function pool() {
  return getPool()
}

// 轻量幂等迁移：老库自动补齐 Reward.icon，避免手动执行 SQL
export async function ensureSchema() {
  const cols = await query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Reward' AND COLUMN_NAME = 'icon'`
  )
  if (cols.length > 0) return
  await execute(
    `ALTER TABLE \`Reward\` ADD COLUMN \`icon\` VARCHAR(191) NOT NULL DEFAULT '🎁' AFTER \`title\``
  )
}
