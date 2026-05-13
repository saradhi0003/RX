import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.BOT_DB_PATH || path.join(process.cwd(), "bot-state.db");
let db: ReturnType<typeof Database>;

export function initDb() {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_workspace_mapping (
      chat_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      channel_connection_id TEXT,
      chat_title TEXT,
      registered_by TEXT,
      registered_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_setup (
      user_id TEXT PRIMARY KEY,
      step TEXT NOT NULL,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      chat_id TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (chat_id, bucket_hour)
    );
  `);
}

export function getWorkspaceForChat(chatId: string): { workspace_id: string; channel_connection_id?: string } | null {
  const row = db.prepare("SELECT workspace_id, channel_connection_id FROM chat_workspace_mapping WHERE chat_id = ?").get(chatId) as any;
  return row || null;
}

export function setWorkspaceForChat(
  chatId: string,
  workspaceId: string,
  opts: { connectionId?: string; chatTitle?: string; registeredBy?: string } = {}
) {
  db.prepare(
    `INSERT OR REPLACE INTO chat_workspace_mapping
     (chat_id, workspace_id, channel_connection_id, chat_title, registered_by, registered_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(chatId, workspaceId, opts.connectionId || null, opts.chatTitle || null, opts.registeredBy || null, Date.now());
}

export function removeChat(chatId: string) {
  db.prepare("DELETE FROM chat_workspace_mapping WHERE chat_id = ?").run(chatId);
}

export function listChats(): any[] {
  return db.prepare("SELECT * FROM chat_workspace_mapping").all() as any[];
}

export function getPendingSetup(userId: string): { step: string; data: unknown } | null {
  const row = db.prepare("SELECT * FROM pending_setup WHERE user_id = ?").get(userId) as any;
  if (!row) return null;
  return { step: row.step, data: JSON.parse(row.data || "{}") };
}

export function setPendingSetup(userId: string, step: string, data: unknown = {}) {
  db.prepare("INSERT OR REPLACE INTO pending_setup (user_id, step, data) VALUES (?, ?, ?)")
    .run(userId, step, JSON.stringify(data));
}

export function clearPendingSetup(userId: string) {
  db.prepare("DELETE FROM pending_setup WHERE user_id = ?").run(userId);
}

// Rate limit: max 100 forwards per chat per hour
const MAX_PER_HOUR = 100;

export function checkRateLimit(chatId: string): boolean {
  const bucketHour = Math.floor(Date.now() / (60 * 60 * 1000));
  const row = db.prepare("SELECT count FROM rate_limits WHERE chat_id = ? AND bucket_hour = ?")
    .get(chatId, bucketHour) as any;

  if (row && row.count >= MAX_PER_HOUR) return false;

  db.prepare(
    `INSERT INTO rate_limits (chat_id, bucket_hour, count) VALUES (?, ?, 1)
     ON CONFLICT(chat_id, bucket_hour) DO UPDATE SET count = count + 1`
  ).run(chatId, bucketHour);
  return true;
}

export function getForwardCount(chatId: string): number {
  const bucketHour = Math.floor(Date.now() / (60 * 60 * 1000));
  const row = db.prepare("SELECT count FROM rate_limits WHERE chat_id = ? AND bucket_hour = ?")
    .get(chatId, bucketHour) as any;
  return row?.count || 0;
}
