import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { getDatabase } from "@netlify/database";
import type {
  BootstrapPayload,
  Channel,
  ChannelType,
  Contact,
  DmConversation,
  Message,
  MessageMetadata,
  MessageType,
  PresenceStatus,
  ReactionGroup,
  Server,
  ServerMember,
  TargetType,
  User,
} from "@/types/chat";
import {
  emitRealtimeEvent,
  getServerVoiceParticipants,
  seedDefaultVoiceParticipants,
} from "./events";

type SqlParam = string | number | null;

interface DbAdapter {
  kind: "postgres" | "sqlite";
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParam[]
  ): Promise<T | undefined>;
  run(sql: string, params?: SqlParam[]): Promise<void>;
}

// Module-scope singleton client (per Netlify Database operational best practices)
const globalForAdapter = globalThis as unknown as {
  __comunicateAdapterPromise?: Promise<DbAdapter>;
};

function toPgPlaceholders(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

async function createAdapter(): Promise<DbAdapter> {
  // 1. Prefer Netlify Database (Postgres) when configured in environment
  const connStr = process.env.NETLIFY_DB_URL;
  if (connStr || process.env.NETLIFY === "true") {
    try {
      const pgClient = connStr
        ? getDatabase({ connectionString: connStr })
        : getDatabase();

      // Verify connectivity and ensure schema/seed exists
      await pgClient.sql`SELECT 1`;
      const adapter: DbAdapter = {
        kind: "postgres",
        async all<T = Record<string, unknown>>(
          sql: string,
          params: SqlParam[] = []
        ): Promise<T[]> {
          const rows = await pgClient.sql.unsafe(
            toPgPlaceholders(sql),
            params as unknown[]
          );
          return rows as unknown as T[];
        },
        async get<T = Record<string, unknown>>(
          sql: string,
          params: SqlParam[] = []
        ): Promise<T | undefined> {
          const rows = await pgClient.sql.unsafe(
            toPgPlaceholders(sql),
            params as unknown[]
          );
          return (rows as unknown as T[])[0];
        },
        async run(sql: string, params: SqlParam[] = []): Promise<void> {
          await pgClient.sql.unsafe(
            toPgPlaceholders(sql),
            params as unknown[]
          );
        },
      };

      await ensureSeedUsersAndFelipe(adapter);
      await purgeDemoPeople(adapter);
      await initializeOwnerPassword(adapter);
      return adapter;
    } catch {
      // Fall back cleanly if NETLIFY_DB_URL is not provisioned in this runtime
    }
  }

  // 2. Local / Fallback SQLite via dynamic import("node:sqlite")
  const sqliteMod = await import("node:sqlite");
  let dbPath: string;
  try {
    const dataDir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dataDir, { recursive: true });
    dbPath = path.join(dataDir, "comunicate.db");
    // Test write access
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch {
    const tmpDir = path.join(os.tmpdir(), "comunicate-data");
    fs.mkdirSync(tmpDir, { recursive: true });
    dbPath = path.join(tmpDir, "comunicate.db");
  }

  const sqlite = new sqliteMod.DatabaseSync(dbPath);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  initSqliteSchema(sqlite);

  const adapter: DbAdapter = {
    kind: "sqlite",
    async all<T = Record<string, unknown>>(
      sql: string,
      params: SqlParam[] = []
    ): Promise<T[]> {
      return sqlite.prepare(sql).all(...params) as unknown as T[];
    },
    async get<T = Record<string, unknown>>(
      sql: string,
      params: SqlParam[] = []
    ): Promise<T | undefined> {
      return sqlite.prepare(sql).get(...params) as unknown as T | undefined;
    },
    async run(sql: string, params: SqlParam[] = []): Promise<void> {
      sqlite.prepare(sql).run(...params);
    },
  };

  await seedIfEmpty(adapter);
  await ensureSeedUsersAndFelipe(adapter);
  await purgeDemoPeople(adapter);
  await initializeOwnerPassword(adapter);
  return adapter;
}

function getAdapter(): Promise<DbAdapter> {
  if (!globalForAdapter.__comunicateAdapterPromise) {
    globalForAdapter.__comunicateAdapterPromise = createAdapter();
  }
  return globalForAdapter.__comunicateAdapterPromise;
}

function initSqliteSchema(sqlite: {
  exec: (sql: string) => void;
  prepare: (sql: string) => { all: () => Array<Record<string, unknown>> };
}): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      handle TEXT NOT NULL,
      email TEXT,
      email_norm TEXT UNIQUE,
      phone TEXT,
      phone_norm TEXT UNIQUE,
      avatar_color TEXT NOT NULL,
      avatar_emoji TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'online',
      custom_status TEXT,
      is_bot INTEGER NOT NULL DEFAULT 0,
      is_placeholder INTEGER NOT NULL DEFAULT 0,
      session_token TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      contact_user_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(owner_id, contact_user_id)
    );

    CREATE TABLE IF NOT EXISTS dm_conversations (
      id TEXT PRIMARY KEY,
      is_group INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dm_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      gradient TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_members (
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      role_color TEXT NOT NULL DEFAULT '#a5b4fc',
      PRIMARY KEY (server_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'text',
      category TEXT NOT NULL DEFAULT 'CANALES DE TEXTO',
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      reply_to_id TEXT,
      metadata_json TEXT,
      read_by_json TEXT NOT NULL DEFAULT '[]',
      edited_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_target
      ON messages(target_type, target_id, created_at);

    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    );
  `);

  // Safe column migration for existing local SQLite databases
  const cols = sqlite.prepare("PRAGMA table_info(users)").all();
  const hasAvatarUrl = cols.some((c) => String(c.name) === "avatar_url");
  if (!hasAvatarUrl) {
    sqlite.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
  }
  const hasPassword = cols.some((c) => String(c.name) === "password_hash");
  if (!hasPassword) {
    sqlite.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
  }
}

const DEMO_PEOPLE = ["user_sofia", "user_mateo", "user_lucia", "user_nova"] as const;
const OWNER_ID = "user_nacho";
// SHA-256 fingerprint of the retired verifier, also used by the SQL migration.
const LEGACY_OWNER_VERIFIER_FINGERPRINT =
  "ad61bca307704672de33c841da3c9101b2251d54cc706704a7462d587b008074";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

async function initializeOwnerPassword(db: DbAdapter): Promise<void> {
  const owner = await db.get<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE id = ?",
    [OWNER_ID]
  );
  if (!owner) return;

  const current = owner.password_hash;
  const replacement = process.env.COMUNICATE_OWNER_INITIAL_PASSWORD;
  if (!current) {
    if (replacement) {
      await db.run(
        "UPDATE users SET password_hash = ? WHERE id = ? AND password_hash IS NULL",
        [hashPassword(replacement), OWNER_ID]
      );
    }
    return;
  }

  if (
    crypto.createHash("sha256").update(current).digest("hex") !==
    LEGACY_OWNER_VERIFIER_FINGERPRINT
  ) {
    return;
  }
  await db.run(
    "UPDATE users SET password_hash = ?, session_token = ? WHERE id = ? AND password_hash = ?",
    [
      replacement ? hashPassword(replacement) : null,
      `revoked_${crypto.randomUUID()}`,
      OWNER_ID,
      current,
    ]
  );
}

async function purgeDemoPeople(db: DbAdapter): Promise<void> {
  try {
  const people = DEMO_PEOPLE.map((id) => `'${id}'`).join(", ");
  const chats = [
    "dm_nacho_sofia",
    "dm_nacho_nova",
    "dm_nacho_mateo",
    "dm_nacho_lucia",
    "ch_design_welcome",
    "ch_design_showcase",
    "ch_design_ui",
    "ch_design_voice_creative",
    "ch_design_voice_lofi",
    "ch_devs_ann",
    "ch_devs_general",
    "ch_devs_realtime",
    "ch_devs_voice_standup",
    "ch_devs_voice_pair",
  ]
    .map((id) => `'${id}'`)
    .join(", ");
  await db.run(
    `DELETE FROM message_reactions WHERE user_id IN (${people}) OR message_id IN (SELECT id FROM messages WHERE sender_id IN (${people}) OR target_id IN (${chats}))`
  );
  await db.run(
    `DELETE FROM messages WHERE sender_id IN (${people}) OR target_id IN (${chats})`
  );
  await db.run(
    `DELETE FROM dm_participants WHERE user_id IN (${people}) OR conversation_id IN ('dm_nacho_sofia', 'dm_nacho_nova', 'dm_nacho_mateo', 'dm_nacho_lucia')`
  );
  await db.run(
    `DELETE FROM dm_conversations WHERE id IN ('dm_nacho_sofia', 'dm_nacho_nova', 'dm_nacho_mateo', 'dm_nacho_lucia')`
  );
  await db.run(
    `DELETE FROM contacts WHERE owner_id IN (${people}) OR contact_user_id IN (${people})`
  );
  await db.run(
    `DELETE FROM server_members WHERE user_id IN (${people}) OR server_id IN ('srv_design', 'srv_devs')`
  );
  await db.run(`DELETE FROM channels WHERE server_id IN ('srv_design', 'srv_devs')`);
  await db.run(`DELETE FROM servers WHERE id IN ('srv_design', 'srv_devs')`);
  await db.run(`DELETE FROM users WHERE id IN (${people})`);
  await db.run(
    `UPDATE users SET session_token = 'tok_login_required_nacho' WHERE id = 'user_nacho' AND session_token = 'tok_nacho_default'`
  );
  await db.run(
    `UPDATE users
     SET email = 'ignaciosergiodiaz@gmail.com',
         email_norm = 'ignaciosergiodiaz@gmail.com'
     WHERE id = 'user_nacho'
       AND NOT EXISTS (
         SELECT 1 FROM users u2
         WHERE u2.email_norm = 'ignaciosergiodiaz@gmail.com'
           AND u2.id <> 'user_nacho'
       )`
  );
  await db.run(
    `UPDATE contacts SET email = 'ignaciosergiodiaz@gmail.com' WHERE contact_user_id = 'user_nacho'`
  );
  await db.run(
    `UPDATE users SET session_token = 'tok_login_required_felipe' WHERE id = 'user_felipe' AND session_token = 'tok_felipe_invite'`
  );
  } catch (err) {
    console.error("No se pudieron quitar los contactos de prueba", err);
  }
}

const removedSender: User = {
  id: "user_removed",
  name: "Usuario",
  handle: "@usuario",
  email: null,
  phone: null,
  avatarColor: "from-slate-500 to-slate-700",
  avatarEmoji: "•",
  avatarUrl: null,
  bio: "",
  status: "offline",
  customStatus: null,
  isBot: false,
  isPlaceholder: false,
  createdAt: "",
};

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 6) return null;
  return `+${digits}`;
}

export function formatPhoneDisplay(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

export function normalizeEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || !cleaned.includes("@")) return null;
  return cleaned;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    handle: String(row.handle),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    avatarColor: String(row.avatar_color),
    avatarEmoji: String(row.avatar_emoji),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    bio: String(row.bio ?? ""),
    status: (row.status as PresenceStatus) || "online",
    customStatus: row.custom_status ? String(row.custom_status) : null,
    isBot: Number(row.is_bot) === 1,
    isPlaceholder: Number(row.is_placeholder) === 1,
    createdAt: String(row.created_at),
  };
}

async function ensureSeedUsersAndFelipe(db: DbAdapter): Promise<void> {
  // Ensure Felipe (+56 9 3904 2370) with his real portrait is present in both existing local DBs and cloud DBs
  const existingFelipe = await db.get<{ id: string }>(
    "SELECT id FROM users WHERE phone_norm = ?",
    ["+56939042370"]
  );

  const now = new Date().toISOString();

  if (!existingFelipe) {
    await db.run(
      `INSERT INTO users (
        id, name, handle, email, email_norm, phone, phone_norm,
        avatar_color, avatar_emoji, avatar_url, bio, status, custom_status,
        is_bot, is_placeholder, session_token, created_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, 'offline', ?, 0, 1, ?, ?)
      ON CONFLICT (id) DO NOTHING`,
      [
        "user_felipe",
        "Felipe",
        "@felipe",
        "+56 9 3904 2370",
        "+56939042370",
        "from-amber-500 via-orange-500 to-indigo-600",
        "🎸",
        "/avatars/felipe.png",
        "Músico & amigo invitado por WhatsApp (+56 9 3904 2370).",
        "Invitado vía WhatsApp · +56 9 3904 2370",
        "tok_felipe_invite",
        now,
      ]
    );

    await db.run(
      `INSERT INTO contacts (id, owner_id, contact_user_id, alias, phone, email, favorite, created_at)
       VALUES (?, 'user_nacho', 'user_felipe', 'Felipe', '+56 9 3904 2370', NULL, 1, ?)
       ON CONFLICT (id) DO NOTHING`,
      ["cnt_felipe", now]
    );
    await db.run(
      `INSERT INTO contacts (id, owner_id, contact_user_id, alias, phone, email, favorite, created_at)
       VALUES (?, 'user_felipe', 'user_nacho', 'Nacho', '+54 9 11 5555-0100', 'ignaciosergiodiaz@gmail.com', 1, ?)
       ON CONFLICT (id) DO NOTHING`,
      ["cnt_felipe_nacho", now]
    );

    await db.run(
      `INSERT INTO dm_conversations (id, is_group, title, updated_at, created_at)
       VALUES ('dm_nacho_felipe', 0, NULL, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [now, now]
    );
    await db.run(
      `INSERT INTO dm_participants (conversation_id, user_id, pinned)
       VALUES ('dm_nacho_felipe', 'user_nacho', 1)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`
    );
    await db.run(
      `INSERT INTO dm_participants (conversation_id, user_id, pinned)
       VALUES ('dm_nacho_felipe', 'user_felipe', 1)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`
    );

    await db.run(
      `INSERT INTO messages (
        id, target_type, target_id, sender_id, content, type,
        reply_to_id, metadata_json, read_by_json, edited_at, created_at
      ) VALUES (?, 'dm', 'dm_nacho_felipe', 'user_nacho', ?, 'text', NULL, ?, '["user_nacho"]', NULL, ?)
      ON CONFLICT (id) DO NOTHING`,
      [
        "msg_f1",
        "¡Hola Felipe! 🎸 Armé nuestra propia app de chat con animaciones estilo Telegram y Discord. ¡Entra con el link de invitación que te mandé por WhatsApp!",
        JSON.stringify({ sentVia: "phone" }),
        now,
      ]
    );
  } else {
    // Ensure Felipe's avatar photo is attached if missing
    await db.run(
      "UPDATE users SET avatar_url = COALESCE(avatar_url, '/avatars/felipe.png') WHERE phone_norm = '+56939042370'"
    );
  }
}

async function seedIfEmpty(db: DbAdapter): Promise<void> {
  const countRow = await db.get<{ c: number | string }>(
    "SELECT COUNT(*) as c FROM users"
  );
  if (Number(countRow?.c ?? 0) > 0) return;

  const baseTime = Date.now() - 1000 * 60 * 45;
  const iso = (offsetMinutes: number) =>
    new Date(baseTime + offsetMinutes * 60_000).toISOString();

  const seedUsers = [
    {
      id: "user_nacho",
      name: "Nacho",
      handle: "@nacho",
      email: "ignaciosergiodiaz@gmail.com",
      phone: "+54 9 11 5555-0100",
      avatarColor: "from-indigo-500 via-violet-500 to-fuchsia-500",
      avatarEmoji: "⚡",
      avatarUrl: null,
      bio: "Creando experiencias en tiempo real con animaciones fluidas.",
      status: "online",
      customStatus: "Probando Comunicate 🚀",
      isBot: 0,
      isPlaceholder: 0,
      token: "tok_nacho_default",
    },
    {
      id: "user_felipe",
      name: "Felipe",
      handle: "@felipe",
      email: null,
      phone: "+56 9 3904 2370",
      avatarColor: "from-amber-500 via-orange-500 to-indigo-600",
      avatarEmoji: "🎸",
      avatarUrl: "/avatars/felipe.png",
      bio: "Músico & amigo invitado por WhatsApp (+56 9 3904 2370).",
      status: "offline",
      customStatus: "Invitado vía WhatsApp · +56 9 3904 2370",
      isBot: 0,
      isPlaceholder: 1,
      token: "tok_felipe_invite",
    },
    {
      id: "user_sofia",
      name: "Sofía Valentina",
      handle: "@sofi.motion",
      email: "sofia@estudio.design",
      phone: "+54 9 11 4280-9911",
      avatarColor: "from-pink-500 via-rose-500 to-amber-400",
      avatarEmoji: "🎨",
      avatarUrl: null,
      bio: "Motion Designer · Micro-interacciones, springs & shaders.",
      status: "online",
      customStatus: "Puliendo curvas spring ✨",
      isBot: 0,
      isPlaceholder: 0,
      token: "tok_sofia_demo",
    },
    {
      id: "user_mateo",
      name: "Mateo Silva",
      handle: "@mateodev",
      email: "mateo@fullstack.mx",
      phone: "+52 55 8842-1904",
      avatarColor: "from-emerald-400 via-teal-500 to-cyan-500",
      avatarEmoji: "🛠️",
      avatarUrl: null,
      bio: "Arquitectura distribuida, WebSockets & audio en baja latencia.",
      status: "idle",
      customStatus: "En #nextjs-react ☕",
      isBot: 0,
      isPlaceholder: 0,
      token: "tok_mateo_demo",
    },
    {
      id: "user_lucia",
      name: "Lucía Fernández",
      handle: "@lucia.pm",
      email: "lucia@madrid.io",
      phone: "+34 612 890 341",
      avatarColor: "from-amber-400 via-orange-500 to-rose-500",
      avatarEmoji: "🌟",
      avatarUrl: null,
      bio: "Product Lead · Conectando mensajería directa y comunidades.",
      status: "dnd",
      customStatus: "Enfocada en lanzamiento 🎯",
      isBot: 0,
      isPlaceholder: 0,
      token: "tok_lucia_demo",
    },
    {
      id: "user_nova",
      name: "Nova ✨ Asistente",
      handle: "@nova.ai",
      email: "nova@comunicate.ai",
      phone: "+1 800 555-0199",
      avatarColor: "from-cyan-400 via-blue-500 to-indigo-600",
      avatarEmoji: "🤖",
      avatarUrl: null,
      bio: "Bot interactivo de Comunicate. ¡Escríbeme o reacciona para probar las animaciones en vivo!",
      status: "online",
      customStatus: "Responde al instante ⚡",
      isBot: 1,
      isPlaceholder: 0,
      token: "tok_nova_bot",
    },
  ];

  for (const u of seedUsers) {
    await db.run(
      `INSERT INTO users (
        id, name, handle, email, email_norm, phone, phone_norm,
        avatar_color, avatar_emoji, avatar_url, bio, status, custom_status,
        is_bot, is_placeholder, session_token, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO NOTHING`,
      [
        u.id,
        u.name,
        u.handle,
        u.email,
        normalizeEmail(u.email),
        u.phone,
        normalizePhone(u.phone),
        u.avatarColor,
        u.avatarEmoji,
        u.avatarUrl,
        u.bio,
        u.status,
        u.customStatus,
        u.isBot,
        u.isPlaceholder,
        u.token,
        iso(0),
      ]
    );
  }

  const contactsSeed: Array<
    [string, string, string, string, string | null, string | null, number]
  > = [
    [
      "cnt_felipe",
      "user_nacho",
      "user_felipe",
      "Felipe",
      "+56 9 3904 2370",
      null,
      1,
    ],
    [
      "cnt_felipe_nacho",
      "user_felipe",
      "user_nacho",
      "Nacho",
      "+54 9 11 5555-0100",
      "ignaciosergiodiaz@gmail.com",
      1,
    ],
    [
      "cnt_sofia",
      "user_nacho",
      "user_sofia",
      "Sofía Valentina",
      "+54 9 11 4280-9911",
      "sofia@estudio.design",
      1,
    ],
    [
      "cnt_nova",
      "user_nacho",
      "user_nova",
      "Nova ✨ Asistente",
      "+1 800 555-0199",
      "nova@comunicate.ai",
      1,
    ],
    [
      "cnt_mateo",
      "user_nacho",
      "user_mateo",
      "Mateo Silva",
      "+52 55 8842-1904",
      "mateo@fullstack.mx",
      0,
    ],
    [
      "cnt_lucia",
      "user_nacho",
      "user_lucia",
      "Lucía Fernández",
      "+34 612 890 341",
      "lucia@madrid.io",
      0,
    ],
  ];

  for (const c of contactsSeed) {
    await db.run(
      `INSERT INTO contacts (id, owner_id, contact_user_id, alias, phone, email, favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [c[0], c[1], c[2], c[3], c[4], c[5], c[6], iso(1)]
    );
  }

  const dms = [
    { id: "dm_nacho_felipe", peer: "user_felipe", pinned: 1, min: 44 },
    { id: "dm_nacho_sofia", peer: "user_sofia", pinned: 1, min: 38 },
    { id: "dm_nacho_nova", peer: "user_nova", pinned: 1, min: 40 },
    { id: "dm_nacho_mateo", peer: "user_mateo", pinned: 0, min: 25 },
    { id: "dm_nacho_lucia", peer: "user_lucia", pinned: 0, min: 15 },
  ];

  for (const d of dms) {
    await db.run(
      `INSERT INTO dm_conversations (id, is_group, title, updated_at, created_at)
       VALUES (?, 0, NULL, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [d.id, iso(d.min), iso(2)]
    );
    await db.run(
      `INSERT INTO dm_participants (conversation_id, user_id, pinned)
       VALUES (?, 'user_nacho', ?)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [d.id, d.pinned]
    );
    await db.run(
      `INSERT INTO dm_participants (conversation_id, user_id, pinned)
       VALUES (?, ?, ?)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [d.id, d.peer, d.pinned]
    );
  }

  await db.run(
    `INSERT INTO servers (id, name, icon, gradient, description, owner_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      "srv_design",
      "Diseño & Motion",
      "✨",
      "from-fuchsia-500 via-purple-500 to-indigo-500",
      "Comunidad de interfaces fluidas, micro-interacciones estilo Telegram y sistemas visuales.",
      "user_sofia",
      iso(3),
    ]
  );
  await db.run(
    `INSERT INTO servers (id, name, icon, gradient, description, owner_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      "srv_devs",
      "Devs Hispano",
      "🚀",
      "from-cyan-500 via-blue-500 to-indigo-600",
      "Arquitectura full-stack, Next.js, tiempo real, WebAudio y lanzamiento de productos.",
      "user_nacho",
      iso(3),
    ]
  );

  const allUserIds = [
    { id: "user_nacho", role: "owner", color: "#818cf8" },
    { id: "user_felipe", role: "member", color: "#fbbf24" },
    { id: "user_sofia", role: "admin", color: "#f472b6" },
    { id: "user_mateo", role: "member", color: "#34d399" },
    { id: "user_lucia", role: "member", color: "#fbbf24" },
    { id: "user_nova", role: "member", color: "#38bdf8" },
  ];
  for (const m of allUserIds) {
    await db.run(
      `INSERT INTO server_members (server_id, user_id, role, role_color)
       VALUES ('srv_design', ?, ?, ?)
       ON CONFLICT (server_id, user_id) DO NOTHING`,
      [
        m.id,
        m.id === "user_sofia"
          ? "owner"
          : m.id === "user_nacho"
          ? "admin"
          : "member",
        m.color,
      ]
    );
    await db.run(
      `INSERT INTO server_members (server_id, user_id, role, role_color)
       VALUES ('srv_devs', ?, ?, ?)
       ON CONFLICT (server_id, user_id) DO NOTHING`,
      [m.id, m.role, m.color]
    );
  }

  const channelsSeed: Array<
    [string, string, string, string, ChannelType, string, number]
  > = [
    [
      "ch_design_welcome",
      "srv_design",
      "bienvenida",
      "Reglas, recursos y guías de diseño interactivo ✨",
      "announcement",
      "INFORMACIÓN",
      1,
    ],
    [
      "ch_design_showcase",
      "srv_design",
      "showcase-animaciones",
      "Comparte prototipos con física spring, burbujas y reacciones con partículas",
      "text",
      "CANALES DE TEXTO",
      2,
    ],
    [
      "ch_design_ui",
      "srv_design",
      "critica-ui",
      "Feedback constructivo sobre tipografía, color y micro-interacciones",
      "text",
      "CANALES DE TEXTO",
      3,
    ],
    [
      "ch_design_voice_creative",
      "srv_design",
      "Sala Creativa",
      "Charla en vivo mientras diseñamos",
      "voice",
      "CANALES DE VOZ",
      4,
    ],
    [
      "ch_design_voice_lofi",
      "srv_design",
      "Beats Lo-Fi 🎧",
      "Música suave para concentrarse",
      "voice",
      "CANALES DE VOZ",
      5,
    ],
    [
      "ch_devs_ann",
      "srv_devs",
      "anuncios",
      "Novedades oficiales y despliegues de Comunicate",
      "announcement",
      "INFORMACIÓN",
      1,
    ],
    [
      "ch_devs_general",
      "srv_devs",
      "general",
      "Charla general de desarrollo, arquitectura y producto",
      "text",
      "CANALES DE TEXTO",
      2,
    ],
    [
      "ch_devs_realtime",
      "srv_devs",
      "tiempo-real-sse",
      "Sincronización instantánea entre pestañas, teléfono y correo",
      "text",
      "CANALES DE TEXTO",
      3,
    ],
    [
      "ch_devs_voice_standup",
      "srv_devs",
      "Daily Standup",
      "Sincronización rápida del equipo",
      "voice",
      "CANALES DE VOZ",
      4,
    ],
    [
      "ch_devs_voice_pair",
      "srv_devs",
      "Pair Programming",
      "Programación en vivo",
      "voice",
      "CANALES DE VOZ",
      5,
    ],
  ];

  for (const ch of channelsSeed) {
    await db.run(
      `INSERT INTO channels (id, server_id, name, topic, type, category, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      ch
    );
  }

  const msgsSeed: Array<
    [
      string,
      string,
      string,
      string,
      string,
      string,
      string | null,
      string | null,
      string,
      string
    ]
  > = [
    [
      "msg_f1",
      "dm",
      "dm_nacho_felipe",
      "user_nacho",
      "¡Hola Felipe! 🎸 Armé nuestra propia app de chat con animaciones estilo Telegram y Discord. ¡Entra con el link de invitación que te mandé por WhatsApp!",
      "text",
      null,
      JSON.stringify({ sentVia: "phone" }),
      JSON.stringify(["user_nacho"]),
      iso(44),
    ],
    [
      "msg_s1",
      "dm",
      "dm_nacho_sofia",
      "user_sofia",
      "¡Hola Nacho! Ya viste cómo quedaron las burbujas con física spring y las reacciones con explosión de partículas? ✨",
      "text",
      null,
      null,
      JSON.stringify(["user_sofia", "user_nacho"]),
      iso(32),
    ],
    [
      "msg_s2",
      "dm",
      "dm_nacho_sofia",
      "user_nacho",
      "¡Se ven increíbles! Además ya podemos agregar contactos directo con número de teléfono tipo WhatsApp o con correo electrónico 📱✉️",
      "text",
      "msg_s1",
      null,
      JSON.stringify(["user_nacho", "user_sofia"]),
      iso(34),
    ],
    [
      "msg_n1",
      "dm",
      "dm_nacho_nova",
      "user_nova",
      "¡Bienvenido a **Comunicate**! Soy Nova ✨. Escríbeme cualquier mensaje, sticker o nota de voz aquí y te responderé al instante.",
      "text",
      null,
      null,
      JSON.stringify(["user_nova", "user_nacho"]),
      iso(40),
    ],
    [
      "msg_ch1",
      "channel",
      "ch_design_showcase",
      "user_sofia",
      "Bienvenidos a **#showcase-animaciones** 🎨 Aquí combinamos lo mejor de Telegram con Discord.",
      "text",
      null,
      null,
      JSON.stringify(["user_sofia", "user_nacho"]),
      iso(28),
    ],
    [
      "msg_dev1",
      "channel",
      "ch_devs_general",
      "user_nacho",
      "¡Equipo! Comunicate ya está listo para invitar contactos por WhatsApp y correo electrónico.",
      "text",
      null,
      null,
      JSON.stringify(["user_nacho"]),
      iso(20),
    ],
  ];

  for (const m of msgsSeed) {
    await db.run(
      `INSERT INTO messages (
        id, target_type, target_id, sender_id, content, type,
        reply_to_id, metadata_json, read_by_json, edited_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
      ON CONFLICT (id) DO NOTHING`,
      m
    );
  }
}

export async function getAllUsersMap(): Promise<Map<string, User>> {
  const db = await getAdapter();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM users ORDER BY created_at ASC"
  );
  const map = new Map<string, User>();
  for (const r of rows) {
    const u = rowToUser(r);
    map.set(u.id, u);
  }
  seedDefaultVoiceParticipants(map);
  return map;
}

export async function getAvailableUsers(): Promise<User[]> {
  const db = await getAdapter();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM users WHERE is_bot = 0 ORDER BY is_placeholder ASC, created_at ASC"
  );
  return rows.map(rowToUser);
}

export async function getUserByToken(
  token?: string | null
): Promise<User | null> {
  if (!token || !/^tok_[a-f0-9]{32}$/.test(token)) return null;
  const db = await getAdapter();
  const row = await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE session_token = ?",
    [token]
  );
  return row ? rowToUser(row) : null;
}

export async function getUserById(userId: string): Promise<User | null> {
  const db = await getAdapter();
  const row = await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = ?",
    [userId]
  );
  return row ? rowToUser(row) : null;
}

export async function getDefaultUser(): Promise<{ user: User; token: string }> {
  const db = await getAdapter();
  const row = await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = 'user_nacho' LIMIT 1"
  );
  if (row) {
    return { user: rowToUser(row), token: String(row.session_token) };
  }
  const fallback = await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE is_placeholder = 0 LIMIT 1"
  );
  if (!fallback) {
    throw new Error("Base de datos sin usuarios inicializados");
  }
  return { user: rowToUser(fallback), token: String(fallback.session_token) };
}

export async function loginUser(params: {
  identifier?: string;
  password?: string;
}): Promise<{ user: User; token: string } | null> {
  const identifier = params.identifier?.trim() ?? "";
  const password = params.password ?? "";
  if (!identifier || !password) {
    throw new Error("Ingresa tu teléfono o correo y la contraseña.");
  }
  if (password.length < 6) {
    throw new Error("La contraseña necesita al menos 6 caracteres.");
  }

  const db = await getAdapter();
  let row: Record<string, unknown> | undefined;
  const emailNorm = normalizeEmail(identifier);
  const phoneNorm = normalizePhone(identifier);
  if (emailNorm) {
    row = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE email_norm = ?",
      [emailNorm]
    );
  }
  if (!row && phoneNorm) {
    row = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE phone_norm = ?",
      [phoneNorm]
    );
  }
  if (!row) return null;

  const stored = row.password_hash ? String(row.password_hash) : "";
  if (!stored) {
    if (row.id === OWNER_ID) {
      throw new Error("La contraseña de esta cuenta se configura en el servidor.");
    }
    throw new Error(
      "Esta cuenta todavía no tiene contraseña. Créala en Crear cuenta con el mismo teléfono o correo."
    );
  }
  if (!verifyPassword(password, stored)) {
    throw new Error("La contraseña no coincide.");
  }

  const token = `tok_${crypto.randomUUID().replace(/-/g, "")}`;
  await db.run(
    "UPDATE users SET session_token = ?, status = 'online', is_placeholder = 0 WHERE id = ?",
    [token, String(row.id)]
  );
  row = await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = ?",
    [String(row.id)]
  );
  if (!row) return null;
  const user = rowToUser(row);
  emitRealtimeEvent({ type: "presence:update", user });
  return { user, token };
}

export async function registerOrClaimUser(params: {
  name: string;
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  bio?: string | null;
  avatarColor?: string | null;
  avatarEmoji?: string | null;
  avatarUrl?: string | null;
}): Promise<{ user: User; token: string; claimedExistingInbox: boolean }> {
  const db = await getAdapter();
  const emailNorm = normalizeEmail(params.email);
  const phoneNorm = normalizePhone(params.phone);
  const phoneDisplay = formatPhoneDisplay(params.phone);
  const emailDisplay = emailNorm;

  if (!emailNorm && !phoneNorm) {
    throw new Error(
      "Ingresa al menos un número de teléfono o un correo electrónico."
    );
  }
  const password = params.password ?? "";
  if (password.length < 6) {
    throw new Error("La contraseña necesita al menos 6 caracteres.");
  }

  let existingRow: Record<string, unknown> | undefined;
  if (phoneNorm) {
    existingRow = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE phone_norm = ?",
      [phoneNorm]
    );
  }
  if (!existingRow && emailNorm) {
    existingRow = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE email_norm = ?",
      [emailNorm]
    );
  }

  const avatarColor =
    params.avatarColor || "from-violet-500 via-indigo-500 to-cyan-400";
  const avatarEmoji = params.avatarEmoji || "✨";
  const cleanName = params.name.trim() || "Usuario";
  const baseHandle =
    "@" +
    cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 14) +
    Math.floor(10 + Math.random() * 89);

  if (existingRow) {
    const userId = String(existingRow.id);
    const wasPlaceholder = Number(existingRow.is_placeholder) === 1;
    if (userId === OWNER_ID && !existingRow.password_hash) {
      throw new Error("La contraseña de esta cuenta se configura en el servidor.");
    }
    if (existingRow.password_hash) {
      throw new Error("Esa cuenta ya existe. Entra con tu contraseña.");
    }
    const token = `tok_${crypto.randomUUID().replace(/-/g, "")}`;
    await db.run(
      `UPDATE users
       SET name = ?,
           email = COALESCE(?, email),
           email_norm = COALESCE(?, email_norm),
           phone = COALESCE(?, phone),
           phone_norm = COALESCE(?, phone_norm),
           avatar_url = COALESCE(?, avatar_url),
           bio = ?,
           status = 'online',
           custom_status = 'Conectado en vivo ✨',
           is_placeholder = 0,
           password_hash = ?,
           session_token = ?
       WHERE id = ?`,
      [
        cleanName,
        emailDisplay,
        emailNorm,
        phoneDisplay,
        phoneNorm,
        params.avatarUrl ?? null,
        params.bio?.trim() || String(existingRow.bio || "En Comunicate ✨"),
        hashPassword(password),
        token,
        userId,
      ]
    );

    const updatedRow = (await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    ))!;
    const user = rowToUser(updatedRow);
    emitRealtimeEvent({ type: "presence:update", user });
    return {
      user,
      token: String(updatedRow.session_token),
      claimedExistingInbox: wasPlaceholder,
    };
  }

  const id = `user_${crypto.randomUUID().slice(0, 8)}`;
  const token = `tok_${crypto.randomUUID().replace(/-/g, "")}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO users (
      id, name, handle, email, email_norm, phone, phone_norm,
      avatar_color, avatar_emoji, avatar_url, bio, status, custom_status,
      is_bot, is_placeholder, session_token, password_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', 'Nuevo en Comunicate 👋', 0, 0, ?, ?, ?)`,
    [
      id,
      cleanName,
      baseHandle,
      emailDisplay,
      emailNorm,
      phoneDisplay,
      phoneNorm,
      avatarColor,
      avatarEmoji,
      params.avatarUrl ?? null,
      params.bio?.trim() || "Disponible por chat directo, número o correo.",
      token,
      hashPassword(password),
      now,
    ]
  );

  const createdRow = (await db.get<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = ?",
    [id]
  ))!;
  const user = rowToUser(createdRow);
  emitRealtimeEvent({ type: "presence:update", user });
  return { user, token, claimedExistingInbox: false };
}

async function ensureUserInDefaultServers(
  db: DbAdapter,
  userId: string
): Promise<void> {
  await db.run(
    `INSERT INTO server_members (server_id, user_id, role, role_color)
     VALUES ('srv_design', ?, 'member', '#a5b4fc')
     ON CONFLICT (server_id, user_id) DO NOTHING`,
    [userId]
  );
  await db.run(
    `INSERT INTO server_members (server_id, user_id, role, role_color)
     VALUES ('srv_devs', ?, 'member', '#a5b4fc')
     ON CONFLICT (server_id, user_id) DO NOTHING`,
    [userId]
  );
}

export async function updateUserStatus(params: {
  userId: string;
  status?: PresenceStatus;
  customStatus?: string | null;
}): Promise<User> {
  const db = await getAdapter();
  const current = await getUserById(params.userId);
  if (!current) throw new Error("Usuario no encontrado");

  const nextStatus = params.status ?? current.status;
  const nextCustom =
    params.customStatus !== undefined
      ? params.customStatus
      : current.customStatus;

  await db.run("UPDATE users SET status = ?, custom_status = ? WHERE id = ?", [
    nextStatus,
    nextCustom,
    params.userId,
  ]);

  const updated = (await getUserById(params.userId))!;
  emitRealtimeEvent({ type: "presence:update", user: updated });
  return updated;
}

export async function lookupUsers(
  query: string,
  excludeUserId?: string
): Promise<User[]> {
  const db = await getAdapter();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const digits = trimmed.replace(/[^\d]/g, "");
  const lower = `%${trimmed.toLowerCase()}%`;
  const phoneLike = digits.length >= 3 ? `%${digits}%` : null;

  const rows = phoneLike
    ? await db.all<Record<string, unknown>>(
        `SELECT * FROM users
         WHERE (LOWER(name) LIKE ? OR LOWER(COALESCE(email, '')) LIKE ? OR LOWER(handle) LIKE ? OR COALESCE(phone_norm, '') LIKE ?)
         ORDER BY is_placeholder ASC, name ASC
         LIMIT 10`,
        [lower, lower, lower, phoneLike]
      )
    : await db.all<Record<string, unknown>>(
        `SELECT * FROM users
         WHERE (LOWER(name) LIKE ? OR LOWER(COALESCE(email, '')) LIKE ? OR LOWER(handle) LIKE ?)
         ORDER BY is_placeholder ASC, name ASC
         LIMIT 10`,
        [lower, lower, lower]
      );

  return rows.map(rowToUser).filter((u) => u.id !== excludeUserId);
}

async function findDirectConversationId(
  db: DbAdapter,
  userA: string,
  userB: string
): Promise<string | null> {
  if (userA === userB) {
    const selfRow = await db.get<{ id: string }>(
      `SELECT c.id FROM dm_conversations c
       JOIN dm_participants p ON p.conversation_id = c.id
       WHERE c.is_group = 0
       GROUP BY c.id
       HAVING COUNT(*) = 1 AND MAX(p.user_id) = ?`,
      [userA]
    );
    return selfRow ? selfRow.id : null;
  }

  const row = await db.get<{ id: string }>(
    `SELECT c.id
     FROM dm_conversations c
     JOIN dm_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
     JOIN dm_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
     WHERE c.is_group = 0
     LIMIT 1`,
    [userA, userB]
  );
  return row ? row.id : null;
}

async function ensureDirectConversation(
  db: DbAdapter,
  userA: string,
  userB: string,
  pinned = false
): Promise<string> {
  const existing = await findDirectConversationId(db, userA, userB);
  if (existing) return existing;

  const convId = `dm_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO dm_conversations (id, is_group, title, updated_at, created_at) VALUES (?, 0, NULL, ?, ?)",
    [convId, now, now]
  );

  await db.run(
    `INSERT INTO dm_participants (conversation_id, user_id, pinned)
     VALUES (?, ?, ?)
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [convId, userA, pinned ? 1 : 0]
  );

  if (userB !== userA) {
    await db.run(
      `INSERT INTO dm_participants (conversation_id, user_id, pinned)
       VALUES (?, ?, 0)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [convId, userB]
    );
  }
  return convId;
}

export async function getContactsForUser(ownerId: string): Promise<Contact[]> {
  const db = await getAdapter();
  const usersMap = await getAllUsersMap();
  const rows = await db.all<Record<string, unknown>>(
    "SELECT * FROM contacts WHERE owner_id = ? ORDER BY favorite DESC, alias ASC",
    [ownerId]
  );

  const out: Contact[] = [];
  for (const r of rows) {
    const targetUser = usersMap.get(String(r.contact_user_id));
    if (!targetUser) continue;
    const convId = await findDirectConversationId(db, ownerId, targetUser.id);
    out.push({
      id: String(r.id),
      ownerId: String(r.owner_id),
      contactUserId: targetUser.id,
      alias: String(r.alias),
      phone: r.phone ? String(r.phone) : targetUser.phone,
      email: r.email ? String(r.email) : targetUser.email,
      favorite: Number(r.favorite) === 1,
      conversationId: convId,
      user: targetUser,
      createdAt: String(r.created_at),
    });
  }
  return out;
}

export async function addContactAndEnsureDm(params: {
  ownerId: string;
  alias?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  targetUserId?: string | null;
  initialMessage?: string | null;
}): Promise<{
  contact: Contact;
  dm: DmConversation;
  initialSentMessage: Message | null;
}> {
  const db = await getAdapter();
  const phoneNorm = normalizePhone(params.phone);
  const phoneDisplay = formatPhoneDisplay(params.phone);
  const emailNorm = normalizeEmail(params.email);
  const emailDisplay = emailNorm;

  let targetRow: Record<string, unknown> | undefined;

  if (params.targetUserId) {
    targetRow = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE id = ?",
      [params.targetUserId]
    );
  }
  if (!targetRow && phoneNorm) {
    targetRow = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE phone_norm = ?",
      [phoneNorm]
    );
  }
  if (!targetRow && emailNorm) {
    targetRow = await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE email_norm = ?",
      [emailNorm]
    );
  }

  if (!targetRow && !phoneNorm && !emailNorm) {
    throw new Error(
      "Debes ingresar un número de teléfono válido (ej. +56 9...) y/o un correo electrónico."
    );
  }

  const now = new Date().toISOString();
  const fallbackName =
    params.alias?.trim() ||
    (emailDisplay ? emailDisplay.split("@")[0] : null) ||
    phoneDisplay ||
    "Contacto";

  if (!targetRow) {
    const newUserId = `user_${crypto.randomUUID().slice(0, 8)}`;
    const palettes = [
      "from-emerald-400 via-teal-500 to-cyan-500",
      "from-fuchsia-500 via-pink-500 to-rose-400",
      "from-amber-400 via-orange-500 to-red-500",
      "from-sky-400 via-blue-500 to-indigo-500",
    ];
    const color = palettes[Math.floor(Math.random() * palettes.length)];
    const handle =
      "@" +
      fallbackName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 12) +
      Math.floor(100 + Math.random() * 899);

    await db.run(
      `INSERT INTO users (
        id, name, handle, email, email_norm, phone, phone_norm,
        avatar_color, avatar_emoji, avatar_url, bio, status, custom_status,
        is_bot, is_placeholder, session_token, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, 0, 1, ?, ?)`,
      [
        newUserId,
        fallbackName,
        handle,
        emailDisplay,
        emailNorm,
        phoneDisplay,
        phoneNorm,
        color,
        phoneNorm && !emailNorm ? "📱" : emailNorm && !phoneNorm ? "✉️" : "💬",
        params.avatarUrl ?? null,
        `Contacto invitado por ${
          phoneDisplay && emailDisplay
            ? "número y correo"
            : phoneDisplay
            ? "WhatsApp / número"
            : "correo electrónico"
        }.`,
        phoneDisplay
          ? `Invitado · ${phoneDisplay}`
          : `Invitado · ${emailDisplay}`,
        `tok_${crypto.randomUUID().replace(/-/g, "")}`,
        now,
      ]
    );

    targetRow = (await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE id = ?",
      [newUserId]
    ))!;
  } else if (Number(targetRow.is_placeholder) === 1 || params.avatarUrl) {
    await db.run(
      `UPDATE users
       SET email = COALESCE(email, ?),
           email_norm = COALESCE(email_norm, ?),
           phone = COALESCE(phone, ?),
           phone_norm = COALESCE(phone_norm, ?),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ?`,
      [
        emailDisplay,
        emailNorm,
        phoneDisplay,
        phoneNorm,
        params.avatarUrl ?? null,
        String(targetRow.id),
      ]
    );
    targetRow = (await db.get<Record<string, unknown>>(
      "SELECT * FROM users WHERE id = ?",
      [String(targetRow.id)]
    ))!;
  }

  const targetUser = rowToUser(targetRow);
  const chosenAlias = params.alias?.trim() || targetUser.name;

  const existingContact = await db.get<{ id: string }>(
    "SELECT id FROM contacts WHERE owner_id = ? AND contact_user_id = ?",
    [params.ownerId, targetUser.id]
  );

  const contactId =
    existingContact?.id ?? `cnt_${crypto.randomUUID().slice(0, 8)}`;
  if (existingContact) {
    await db.run(
      `UPDATE contacts
       SET alias = ?, phone = COALESCE(?, phone), email = COALESCE(?, email)
       WHERE id = ?`,
      [
        chosenAlias,
        phoneDisplay ?? targetUser.phone,
        emailDisplay ?? targetUser.email,
        contactId,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO contacts (id, owner_id, contact_user_id, alias, phone, email, favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        contactId,
        params.ownerId,
        targetUser.id,
        chosenAlias,
        phoneDisplay ?? targetUser.phone,
        emailDisplay ?? targetUser.email,
        now,
      ]
    );
  }

  const convId = await ensureDirectConversation(
    db,
    params.ownerId,
    targetUser.id,
    false
  );

  let initialSentMessage: Message | null = null;
  if (params.initialMessage && params.initialMessage.trim()) {
    initialSentMessage = await createMessage({
      senderId: params.ownerId,
      targetType: "dm",
      targetId: convId,
      content: params.initialMessage.trim(),
      type: "text",
      metadata: {
        sentVia: phoneDisplay ? "phone" : emailDisplay ? "email" : "app",
      },
    });
  }

  const contacts = await getContactsForUser(params.ownerId);
  const contact =
    contacts.find((c) => c.id === contactId) ??
    ({
      id: contactId,
      ownerId: params.ownerId,
      contactUserId: targetUser.id,
      alias: chosenAlias,
      phone: phoneDisplay ?? targetUser.phone,
      email: emailDisplay ?? targetUser.email,
      favorite: false,
      conversationId: convId,
      user: targetUser,
      createdAt: now,
    } satisfies Contact);

  const dms = await getDmConversationsForUser(params.ownerId);
  const dm = dms.find((d) => d.id === convId)!;

  emitRealtimeEvent({
    type: "contact:added",
    ownerId: params.ownerId,
    contact,
    dm,
  });

  return { contact, dm, initialSentMessage };
}

async function getReactionsForMessages(
  db: DbAdapter,
  messageIds: string[]
): Promise<Map<string, ReactionGroup[]>> {
  const result = new Map<string, ReactionGroup[]>();
  if (messageIds.length === 0) return result;

  const placeholders = messageIds.map(() => "?").join(",");
  const rows = await db.all<{
    message_id: string;
    emoji: string;
    user_id: string;
  }>(
    `SELECT message_id, emoji, user_id
     FROM message_reactions
     WHERE message_id IN (${placeholders})
     ORDER BY created_at ASC`,
    messageIds
  );

  const byMsgEmoji = new Map<string, Map<string, string[]>>();
  for (const r of rows) {
    let emojiMap = byMsgEmoji.get(r.message_id);
    if (!emojiMap) {
      emojiMap = new Map();
      byMsgEmoji.set(r.message_id, emojiMap);
    }
    const arr = emojiMap.get(r.emoji) ?? [];
    arr.push(r.user_id);
    emojiMap.set(r.emoji, arr);
  }

  for (const [msgId, emojiMap] of byMsgEmoji.entries()) {
    const groups: ReactionGroup[] = [];
    for (const [emoji, userIds] of emojiMap.entries()) {
      groups.push({ emoji, count: userIds.length, userIds });
    }
    result.set(msgId, groups);
  }
  return result;
}

async function hydrateMessages(
  db: DbAdapter,
  rows: Array<Record<string, unknown>>,
  usersMap: Map<string, User>
): Promise<Message[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const reactionsMap = await getReactionsForMessages(db, ids);

  const replyIds = Array.from(
    new Set(
      rows
        .map((r) => (r.reply_to_id ? String(r.reply_to_id) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  const replyLookup = new Map<string, Record<string, unknown>>();
  if (replyIds.length > 0) {
    const ph = replyIds.map(() => "?").join(",");
    const replyRows = await db.all<Record<string, unknown>>(
      `SELECT * FROM messages WHERE id IN (${ph})`,
      replyIds
    );
    for (const rr of replyRows) {
      replyLookup.set(String(rr.id), rr);
    }
  }

  const fallbackUser = removedSender;

  return rows.map((r) => {
    const msgId = String(r.id);
    const sender = usersMap.get(String(r.sender_id)) ?? fallbackUser;
    const replyToId = r.reply_to_id ? String(r.reply_to_id) : null;
    let replyTo: Message["replyTo"] = null;

    if (replyToId) {
      const rr = replyLookup.get(replyToId);
      if (rr) {
        const rSender = usersMap.get(String(rr.sender_id)) ?? fallbackUser;
        replyTo = {
          id: String(rr.id),
          senderId: rSender.id,
          senderName: rSender.name,
          senderColor: rSender.avatarColor,
          content: String(rr.content),
          type: (rr.type as MessageType) || "text",
        };
      }
    }

    let metadata: MessageMetadata | null = null;
    if (r.metadata_json) {
      try {
        metadata = JSON.parse(String(r.metadata_json)) as MessageMetadata;
      } catch {
        metadata = null;
      }
    }

    let readBy: string[] = [];
    try {
      readBy = JSON.parse(String(r.read_by_json || "[]")) as string[];
    } catch {
      readBy = [];
    }

    return {
      id: msgId,
      targetType: r.target_type as TargetType,
      targetId: String(r.target_id),
      senderId: sender.id,
      sender,
      content: String(r.content),
      type: (r.type as MessageType) || "text",
      replyToId,
      replyTo,
      reactions: reactionsMap.get(msgId) ?? [],
      metadata,
      editedAt: r.edited_at ? String(r.edited_at) : null,
      readBy,
      createdAt: String(r.created_at),
    };
  });
}

export async function getMessages(
  targetType: TargetType,
  targetId: string,
  limit = 120
): Promise<Message[]> {
  const db = await getAdapter();
  const usersMap = await getAllUsersMap();
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM messages
     WHERE target_type = ? AND target_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [targetType, targetId, limit]
  );
  return hydrateMessages(db, rows, usersMap);
}

export async function getMessageById(
  messageId: string
): Promise<Message | null> {
  const db = await getAdapter();
  const usersMap = await getAllUsersMap();
  const row = await db.get<Record<string, unknown>>(
    "SELECT * FROM messages WHERE id = ?",
    [messageId]
  );
  if (!row) return null;
  const arr = await hydrateMessages(db, [row], usersMap);
  return arr[0] ?? null;
}

export async function createMessage(params: {
  senderId: string;
  targetType: TargetType;
  targetId: string;
  content: string;
  type?: MessageType;
  replyToId?: string | null;
  metadata?: MessageMetadata | null;
}): Promise<Message> {
  const db = await getAdapter();
  const id = `msg_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const msgType: MessageType = params.type ?? "text";

  await db.run(
    `INSERT INTO messages (
      id, target_type, target_id, sender_id, content, type,
      reply_to_id, metadata_json, read_by_json, edited_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      id,
      params.targetType,
      params.targetId,
      params.senderId,
      params.content,
      msgType,
      params.replyToId ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      JSON.stringify([params.senderId]),
      now,
    ]
  );

  if (params.targetType === "dm") {
    await db.run("UPDATE dm_conversations SET updated_at = ? WHERE id = ?", [
      now,
      params.targetId,
    ]);
  }

  const created = (await getMessageById(id))!;
  emitRealtimeEvent({ type: "message:new", message: created });

  if (params.senderId !== "user_nova") {
    const isNovaDm =
      params.targetType === "dm" &&
      Boolean(
        await db.get(
          "SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = 'user_nova'",
          [params.targetId]
        )
      );
    const shouldBotReply =
      isNovaDm || params.content.toLowerCase().includes("@nova");

    if (shouldBotReply) {
      if (process.env.NETLIFY === "true") {
        // On serverless, execute bot reply inline before lambda freezes
        await runNovaImmediateReply(created, params.targetType, params.targetId);
      } else {
        scheduleNovaBotResponse({
          userMessage: created,
          targetType: params.targetType,
          targetId: params.targetId,
        });
      }
    }
  }

  return created;
}

function buildNovaReplyText(userMessage: Message): string {
  const lower = userMessage.content.toLowerCase();
  if (userMessage.type === "voice") {
    return "🎙️ ¡Escuché tu nota de voz con el visualizador de ondas! Qué fluido se siente el reproductor interactivo.";
  }
  if (userMessage.type === "sticker") {
    return "¡Me encanta ese sticker gigante animado! 🎉 Hazle clic encima para ver cómo rebota.";
  }
  if (
    lower.includes("felipe") ||
    lower.includes("whatsapp") ||
    lower.includes("invit")
  ) {
    return "📲 ¡Usa el botón verde **Enviar invitación por WhatsApp** en el chat de Felipe para mandarle su enlace directo de Comunicate!";
  }
  if (lower.includes("hola") || lower.includes("buenas")) {
    return `¡Hola ${userMessage.sender.name}! ✨ Qué gusto saludarte en Comunicate.`;
  }
  return "¡Recibido al instante! ⚡ Puedes deslizar este mensaje para responder o tocar cualquier reacción para disparar partículas.";
}

async function runNovaImmediateReply(
  userMessage: Message,
  targetType: TargetType,
  targetId: string
): Promise<void> {
  if (targetType === "dm") {
    await markConversationRead(targetId, "user_nova");
  }
  await toggleMessageReaction({
    messageId: userMessage.id,
    userId: "user_nova",
    emoji: "✨",
  });
  await createMessage({
    senderId: "user_nova",
    targetType,
    targetId,
    content: buildNovaReplyText(userMessage),
    type: "text",
    replyToId: userMessage.id,
  });
}

function scheduleNovaBotResponse(params: {
  userMessage: Message;
  targetType: TargetType;
  targetId: string;
}): void {
  setTimeout(async () => {
    const nova = await getUserById("user_nova");
    if (!nova) return;
    if (params.targetType === "dm") {
      await markConversationRead(params.targetId, "user_nova");
    }
    emitRealtimeEvent({
      type: "typing:update",
      targetType: params.targetType,
      targetId: params.targetId,
      user: { id: nova.id, name: nova.name, avatarColor: nova.avatarColor },
      isTyping: true,
    });
  }, 300);

  setTimeout(async () => {
    const funReactions = ["✨", "🔥", "💜", "🚀"];
    const pick = funReactions[Math.floor(Math.random() * funReactions.length)];
    await toggleMessageReaction({
      messageId: params.userMessage.id,
      userId: "user_nova",
      emoji: pick,
    }).catch(() => {});
  }, 750);

  setTimeout(async () => {
    const nova = await getUserById("user_nova");
    if (nova) {
      emitRealtimeEvent({
        type: "typing:update",
        targetType: params.targetType,
        targetId: params.targetId,
        user: { id: nova.id, name: nova.name, avatarColor: nova.avatarColor },
        isTyping: false,
      });
    }
    await createMessage({
      senderId: "user_nova",
      targetType: params.targetType,
      targetId: params.targetId,
      content: buildNovaReplyText(params.userMessage),
      type: "text",
      replyToId: params.userMessage.id,
    }).catch(() => {});
  }, 1500);
}

export async function editMessage(params: {
  messageId: string;
  userId: string;
  content: string;
}): Promise<Message> {
  const db = await getAdapter();
  const existing = await getMessageById(params.messageId);
  if (!existing) throw new Error("Mensaje no encontrado");
  if (existing.senderId !== params.userId) {
    throw new Error("Solo puedes editar tus propios mensajes");
  }

  const now = new Date().toISOString();
  await db.run("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?", [
    params.content.trim(),
    now,
    params.messageId,
  ]);

  const updated = (await getMessageById(params.messageId))!;
  emitRealtimeEvent({ type: "message:updated", message: updated });
  return updated;
}

export async function deleteMessage(params: {
  messageId: string;
  userId: string;
}): Promise<void> {
  const db = await getAdapter();
  const existing = await getMessageById(params.messageId);
  if (!existing) throw new Error("Mensaje no encontrado");
  if (existing.senderId !== params.userId) {
    throw new Error("Solo puedes eliminar tus propios mensajes");
  }

  await db.run("DELETE FROM message_reactions WHERE message_id = ?", [
    params.messageId,
  ]);
  await db.run("DELETE FROM messages WHERE id = ?", [params.messageId]);

  emitRealtimeEvent({
    type: "message:deleted",
    messageId: params.messageId,
    targetType: existing.targetType,
    targetId: existing.targetId,
  });
}

export async function toggleMessageReaction(params: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<{ reactions: ReactionGroup[]; added: boolean }> {
  const db = await getAdapter();
  const existingMsg = await getMessageById(params.messageId);
  if (!existingMsg) throw new Error("Mensaje no encontrado");

  const hasRow = await db.get(
    "SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
    [params.messageId, params.userId, params.emoji]
  );

  let added = false;
  if (hasRow) {
    await db.run(
      "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
      [params.messageId, params.userId, params.emoji]
    );
  } else {
    await db.run(
      "INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)",
      [
        params.messageId,
        params.userId,
        params.emoji,
        new Date().toISOString(),
      ]
    );
    added = true;
  }

  const map = await getReactionsForMessages(db, [params.messageId]);
  const reactions = map.get(params.messageId) ?? [];

  emitRealtimeEvent({
    type: "message:reaction",
    messageId: params.messageId,
    targetType: existingMsg.targetType,
    targetId: existingMsg.targetId,
    reactions,
    actorId: params.userId,
    emoji: params.emoji,
    added,
  });

  return { reactions, added };
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<string[]> {
  const db = await getAdapter();
  const rows = await db.all<{ id: string; read_by_json: string }>(
    "SELECT id, read_by_json FROM messages WHERE target_type = 'dm' AND target_id = ?",
    [conversationId]
  );

  const updatedIds: string[] = [];
  for (const r of rows) {
    let arr: string[] = [];
    try {
      arr = JSON.parse(r.read_by_json || "[]") as string[];
    } catch {
      arr = [];
    }
    if (!arr.includes(userId)) {
      arr.push(userId);
      await db.run("UPDATE messages SET read_by_json = ? WHERE id = ?", [
        JSON.stringify(arr),
        r.id,
      ]);
      updatedIds.push(r.id);
    }
  }

  if (updatedIds.length > 0) {
    emitRealtimeEvent({
      type: "dm:read",
      conversationId,
      userId,
      messageIds: updatedIds,
    });
  }

  return updatedIds;
}

export async function getDmConversationsForUser(
  userId: string
): Promise<DmConversation[]> {
  const db = await getAdapter();
  const usersMap = await getAllUsersMap();
  const contacts = await getContactsForUser(userId);
  const aliasByUserId = new Map<string, string>();
  for (const c of contacts) {
    aliasByUserId.set(c.contactUserId, c.alias);
  }

  const convRows = await db.all<Record<string, unknown>>(
    `SELECT c.*, p.pinned
     FROM dm_conversations c
     JOIN dm_participants p ON p.conversation_id = c.id AND p.user_id = ?
     ORDER BY p.pinned DESC, c.updated_at DESC`,
    [userId]
  );

  const out: DmConversation[] = [];
  for (const c of convRows) {
    const convId = String(c.id);
    const partRows = await db.all<{ user_id: string }>(
      "SELECT user_id FROM dm_participants WHERE conversation_id = ?",
      [convId]
    );

    const participants = partRows
      .map((pr) => usersMap.get(pr.user_id))
      .filter((u): u is User => Boolean(u));

    const peer =
      participants.find((u) => u.id !== userId) ?? participants[0] ?? null;

    const lastMsgRow = await db.get<Record<string, unknown>>(
      `SELECT * FROM messages
       WHERE target_type = 'dm' AND target_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [convId]
    );

    const lastMessage = lastMsgRow
      ? (await hydrateMessages(db, [lastMsgRow], usersMap))[0] ?? null
      : null;

    const allDmMsgs = await db.all<{
      sender_id: string;
      read_by_json: string;
    }>(
      `SELECT sender_id, read_by_json FROM messages
       WHERE target_type = 'dm' AND target_id = ? AND sender_id != ?`,
      [convId, userId]
    );

    let unreadCount = 0;
    for (const m of allDmMsgs) {
      try {
        const rb = JSON.parse(m.read_by_json || "[]") as string[];
        if (!rb.includes(userId)) unreadCount++;
      } catch {
        unreadCount++;
      }
    }

    out.push({
      id: convId,
      isGroup: Number(c.is_group) === 1,
      title: c.title ? String(c.title) : null,
      participants,
      peer,
      contactAlias: peer ? aliasByUserId.get(peer.id) ?? null : null,
      lastMessage,
      unreadCount,
      pinned: Number(c.pinned) === 1,
      updatedAt: String(c.updated_at),
    });
  }

  return out;
}

export async function getServersForUser(userId: string): Promise<Server[]> {
  const db = await getAdapter();
  const usersMap = await getAllUsersMap();

  const serverRows = await db.all<Record<string, unknown>>(
    `SELECT s.*
     FROM servers s
     JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = ?
     ORDER BY s.created_at ASC`,
    [userId]
  );

  const out: Server[] = [];
  for (const s of serverRows) {
    out.push(await buildServerObject(db, s, usersMap));
  }
  return out;
}

async function buildServerObject(
  db: DbAdapter,
  s: Record<string, unknown>,
  usersMap: Map<string, User>
): Promise<Server> {
  const serverId = String(s.id);
  const chRows = await db.all<Record<string, unknown>>(
    "SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC, id ASC",
    [serverId]
  );

  const channels: Channel[] = chRows.map((ch) => ({
    id: String(ch.id),
    serverId,
    name: String(ch.name),
    topic: String(ch.topic ?? ""),
    type: (ch.type as ChannelType) || "text",
    category: String(ch.category ?? "CANALES DE TEXTO"),
    position: Number(ch.position ?? 0),
  }));

  const memRows = await db.all<Record<string, unknown>>(
    "SELECT * FROM server_members WHERE server_id = ?",
    [serverId]
  );

  const members: ServerMember[] = memRows
    .map((m) => {
      const u = usersMap.get(String(m.user_id));
      if (!u) return null;
      return {
        userId: u.id,
        role: (m.role as ServerMember["role"]) || "member",
        roleColor: String(m.role_color || "#a5b4fc"),
        user: u,
      } satisfies ServerMember;
    })
    .filter((m): m is ServerMember => m !== null);

  return {
    id: serverId,
    name: String(s.name),
    icon: String(s.icon),
    gradient: String(s.gradient),
    description: String(s.description ?? ""),
    ownerId: String(s.owner_id),
    channels,
    members,
    voiceParticipants: getServerVoiceParticipants(serverId),
  };
}

export async function createServer(params: {
  ownerId: string;
  name: string;
  icon?: string;
  gradient?: string;
  description?: string;
}): Promise<Server> {
  const db = await getAdapter();
  const id = `srv_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const icon = params.icon?.trim() || "🌐";
  const gradient =
    params.gradient || "from-indigo-500 via-purple-500 to-pink-500";
  const name = params.name.trim() || "Nueva Comunidad";
  const description =
    params.description?.trim() || "Comunidad creada por miembros de Comunicate.";

  await db.run(
    `INSERT INTO servers (id, name, icon, gradient, description, owner_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, icon, gradient, description, params.ownerId, now]
  );

  const allRealUsers = await db.all<{ id: string }>(
    "SELECT id FROM users WHERE is_placeholder = 0"
  );
  for (const u of allRealUsers) {
    await db.run(
      `INSERT INTO server_members (server_id, user_id, role, role_color)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (server_id, user_id) DO NOTHING`,
      [
        id,
        u.id,
        u.id === params.ownerId ? "owner" : "member",
        u.id === params.ownerId ? "#f472b6" : "#a5b4fc",
      ]
    );
  }

  const chGeneralId = `ch_${crypto.randomUUID().slice(0, 8)}`;
  const chAnnId = `ch_${crypto.randomUUID().slice(0, 8)}`;
  const chVoiceId = `ch_${crypto.randomUUID().slice(0, 8)}`;

  await db.run(
    "INSERT INTO channels (id, server_id, name, topic, type, category, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      chAnnId,
      id,
      "bienvenida",
      `Anuncios y bienvenida a ${name}`,
      "announcement",
      "INFORMACIÓN",
      1,
    ]
  );
  await db.run(
    "INSERT INTO channels (id, server_id, name, topic, type, category, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      chGeneralId,
      id,
      "general",
      `Conversación principal de ${name}`,
      "text",
      "CANALES DE TEXTO",
      2,
    ]
  );
  await db.run(
    "INSERT INTO channels (id, server_id, name, topic, type, category, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      chVoiceId,
      id,
      "Sala Principal",
      "Canal de voz en vivo",
      "voice",
      "CANALES DE VOZ",
      3,
    ]
  );

  await createMessage({
    senderId: params.ownerId,
    targetType: "channel",
    targetId: chGeneralId,
    content: `🎉 ¡Bienvenidos a **${name}**! Este servidor ya tiene canales de texto y sala de voz listos en tiempo real.`,
    type: "text",
  });

  const sRow = (await db.get<Record<string, unknown>>(
    "SELECT * FROM servers WHERE id = ?",
    [id]
  ))!;
  const server = await buildServerObject(db, sRow, await getAllUsersMap());
  emitRealtimeEvent({ type: "server:created", server });
  return server;
}

export async function createChannel(params: {
  serverId: string;
  name: string;
  topic?: string;
  type?: ChannelType;
}): Promise<Channel> {
  const db = await getAdapter();
  const cleanSlug =
    params.type === "voice"
      ? params.name.trim()
      : params.name
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-áéíóúñ]/g, "");

  const chType: ChannelType = params.type ?? "text";
  const category =
    chType === "voice"
      ? "CANALES DE VOZ"
      : chType === "announcement"
      ? "INFORMACIÓN"
      : "CANALES DE TEXTO";

  const maxPosRow = await db.get<{ m: number | string }>(
    "SELECT COALESCE(MAX(position), 0) as m FROM channels WHERE server_id = ?",
    [params.serverId]
  );

  const id = `ch_${crypto.randomUUID().slice(0, 8)}`;
  const position = Number(maxPosRow?.m ?? 0) + 1;
  const topic =
    params.topic?.trim() ||
    (chType === "voice" ? "Canal de voz en vivo" : `Canal #${cleanSlug}`);

  await db.run(
    "INSERT INTO channels (id, server_id, name, topic, type, category, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      params.serverId,
      cleanSlug || "nuevo-canal",
      topic,
      chType,
      category,
      position,
    ]
  );

  const channel: Channel = {
    id,
    serverId: params.serverId,
    name: cleanSlug || "nuevo-canal",
    topic,
    type: chType,
    category,
    position,
  };

  emitRealtimeEvent({
    type: "channel:created",
    serverId: params.serverId,
    channel,
  });
  return channel;
}

export async function getBootstrapPayload(
  userId: string
): Promise<BootstrapPayload> {
  const currentUser = await getUserById(userId);
  if (!currentUser) throw new Error("Sesión no válida");
  const [dms, contacts, servers] = await Promise.all([
    getDmConversationsForUser(currentUser.id),
    getContactsForUser(currentUser.id),
    getServersForUser(currentUser.id),
  ]);
  return {
    currentUser,
    availableUsers: [currentUser],
    dms,
    contacts,
    servers,
  };
}
