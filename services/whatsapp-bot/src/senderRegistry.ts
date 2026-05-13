import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "whatsapp-data.db");
let db: ReturnType<typeof Database>;

export function initDb() {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      phone_number TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      channel_connection_id TEXT NOT NULL,
      registered_at INTEGER NOT NULL
    );
  `);
}

export function lookupSender(phone: string): { workspace_id: string; channel_connection_id: string } | null {
  const row = db
    .prepare("SELECT workspace_id, channel_connection_id FROM registrations WHERE phone_number = ?")
    .get(phone) as any;
  return row || null;
}

export function registerSender(phone: string, workspaceId: string, connectionId: string) {
  db.prepare(
    "INSERT OR REPLACE INTO registrations (phone_number, workspace_id, channel_connection_id, registered_at) VALUES (?, ?, ?, ?)"
  ).run(phone, workspaceId, connectionId, Date.now());
}

export function unregisterSender(phone: string) {
  db.prepare("DELETE FROM registrations WHERE phone_number = ?").run(phone);
}
