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

-- Seed Initial Users (including Felipe +56 9 3904 2370 with his real photo!)
INSERT INTO users (
  id, name, handle, email, email_norm, phone, phone_norm,
  avatar_color, avatar_emoji, avatar_url, bio, status, custom_status,
  is_bot, is_placeholder, session_token, created_at
) VALUES
  (
    'user_nacho', 'Nacho', '@nacho', 'nacho@comunicate.app', 'nacho@comunicate.app',
    '+54 9 11 5555-0100', '+5491155550100',
    'from-indigo-500 via-violet-500 to-fuchsia-500', '⚡', NULL,
    'Creando experiencias en tiempo real con animaciones fluidas.',
    'online', 'En Comunicate 🚀', 0, 0, 'tok_nacho_default', '2026-11-15T23:00:00.000Z'
  ),
  (
    'user_felipe', 'Felipe', '@felipe', NULL, NULL,
    '+56 9 3904 2370', '+56939042370',
    'from-amber-500 via-orange-500 to-indigo-600', '🎸', '/avatars/felipe.png',
    'Músico & amigo invitado por WhatsApp (+56 9 3904 2370).',
    'offline', 'Invitado vía WhatsApp · +56 9 3904 2370', 0, 1, 'tok_felipe_invite', '2026-11-15T23:40:00.000Z'
  ),
  (
    'user_sofia', 'Sofía Valentina', '@sofi.motion', 'sofia@estudio.design', 'sofia@estudio.design',
    '+54 9 11 4280-9911', '+5491142809911',
    'from-pink-500 via-rose-500 to-amber-400', '🎨', NULL,
    'Motion Designer · Micro-interacciones, springs & shaders.',
    'online', 'Puliendo curvas spring ✨', 0, 0, 'tok_sofia_demo', '2026-11-15T23:01:00.000Z'
  ),
  (
    'user_mateo', 'Mateo Silva', '@mateodev', 'mateo@fullstack.mx', 'mateo@fullstack.mx',
    '+52 55 8842-1904', '+525588421904',
    'from-emerald-400 via-teal-500 to-cyan-500', '🛠️', NULL,
    'Arquitectura distribuida, WebSockets & audio en baja latencia.',
    'idle', 'En #nextjs-react ☕', 0, 0, 'tok_mateo_demo', '2026-11-15T23:02:00.000Z'
  ),
  (
    'user_lucia', 'Lucía Fernández', '@lucia.pm', 'lucia@madrid.io', 'lucia@madrid.io',
    '+34 612 890 341', '+34612890341',
    'from-amber-400 via-orange-500 to-rose-500', '🌟', NULL,
    'Product Lead · Conectando mensajería directa y comunidades.',
    'dnd', 'Enfocada en lanzamiento 🎯', 0, 0, 'tok_lucia_demo', '2026-11-15T23:03:00.000Z'
  ),
  (
    'user_nova', 'Nova ✨ Asistente', '@nova.ai', 'nova@comunicate.ai', 'nova@comunicate.ai',
    '+1 800 555-0199', '+18005550199',
    'from-cyan-400 via-blue-500 to-indigo-600', '🤖', NULL,
    'Bot interactivo de Comunicate. ¡Escríbeme o reacciona para probar las animaciones en vivo!',
    'online', 'Responde al instante ⚡', 1, 0, 'tok_nova_bot', '2026-11-15T23:04:00.000Z'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO contacts (id, owner_id, contact_user_id, alias, phone, email, favorite, created_at) VALUES
  ('cnt_felipe', 'user_nacho', 'user_felipe', 'Felipe', '+56 9 3904 2370', NULL, 1, '2026-11-15T23:41:00.000Z'),
  ('cnt_felipe_nacho', 'user_felipe', 'user_nacho', 'Nacho', '+54 9 11 5555-0100', 'nacho@comunicate.app', 1, '2026-11-15T23:41:00.000Z'),
  ('cnt_sofia', 'user_nacho', 'user_sofia', 'Sofía Valentina', '+54 9 11 4280-9911', 'sofia@estudio.design', 1, '2026-11-15T23:05:00.000Z'),
  ('cnt_nova', 'user_nacho', 'user_nova', 'Nova ✨ Asistente', '+1 800 555-0199', 'nova@comunicate.ai', 1, '2026-11-15T23:05:00.000Z'),
  ('cnt_mateo', 'user_nacho', 'user_mateo', 'Mateo Silva', '+52 55 8842-1904', 'mateo@fullstack.mx', 0, '2026-11-15T23:05:00.000Z'),
  ('cnt_lucia', 'user_nacho', 'user_lucia', 'Lucía Fernández', '+34 612 890 341', 'lucia@madrid.io', 0, '2026-11-15T23:05:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dm_conversations (id, is_group, title, updated_at, created_at) VALUES
  ('dm_nacho_felipe', 0, NULL, '2026-11-15T23:42:00.000Z', '2026-11-15T23:41:00.000Z'),
  ('dm_nacho_sofia', 0, NULL, '2026-11-15T23:38:00.000Z', '2026-11-15T23:02:00.000Z'),
  ('dm_nacho_nova', 0, NULL, '2026-11-15T23:35:00.000Z', '2026-11-15T23:02:00.000Z'),
  ('dm_nacho_mateo', 0, NULL, '2026-11-15T23:25:00.000Z', '2026-11-15T23:02:00.000Z'),
  ('dm_nacho_lucia', 0, NULL, '2026-11-15T23:15:00.000Z', '2026-11-15T23:02:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dm_participants (conversation_id, user_id, pinned) VALUES
  ('dm_nacho_felipe', 'user_nacho', 1),
  ('dm_nacho_felipe', 'user_felipe', 1),
  ('dm_nacho_sofia', 'user_nacho', 1),
  ('dm_nacho_sofia', 'user_sofia', 1),
  ('dm_nacho_nova', 'user_nacho', 1),
  ('dm_nacho_nova', 'user_nova', 1),
  ('dm_nacho_mateo', 'user_nacho', 0),
  ('dm_nacho_mateo', 'user_mateo', 0),
  ('dm_nacho_lucia', 'user_nacho', 0),
  ('dm_nacho_lucia', 'user_lucia', 0)
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO servers (id, name, icon, gradient, description, owner_id, created_at) VALUES
  ('srv_design', 'Diseño & Motion', '✨', 'from-fuchsia-500 via-purple-500 to-indigo-500', 'Comunidad de interfaces fluidas, micro-interacciones estilo Telegram y sistemas visuales.', 'user_sofia', '2026-11-15T23:03:00.000Z'),
  ('srv_devs', 'Devs Hispano', '🚀', 'from-cyan-500 via-blue-500 to-indigo-600', 'Arquitectura full-stack, Next.js, tiempo real, WebAudio y lanzamiento de productos.', 'user_nacho', '2026-11-15T23:03:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO server_members (server_id, user_id, role, role_color) VALUES
  ('srv_design', 'user_nacho', 'admin', '#818cf8'),
  ('srv_design', 'user_felipe', 'member', '#fbbf24'),
  ('srv_design', 'user_sofia', 'owner', '#f472b6'),
  ('srv_design', 'user_mateo', 'member', '#34d399'),
  ('srv_design', 'user_lucia', 'member', '#fbbf24'),
  ('srv_design', 'user_nova', 'member', '#38bdf8'),
  ('srv_devs', 'user_nacho', 'owner', '#818cf8'),
  ('srv_devs', 'user_felipe', 'member', '#fbbf24'),
  ('srv_devs', 'user_sofia', 'admin', '#f472b6'),
  ('srv_devs', 'user_mateo', 'member', '#34d399'),
  ('srv_devs', 'user_lucia', 'member', '#fbbf24'),
  ('srv_devs', 'user_nova', 'member', '#38bdf8')
ON CONFLICT (server_id, user_id) DO NOTHING;

INSERT INTO channels (id, server_id, name, topic, type, category, position) VALUES
  ('ch_design_welcome', 'srv_design', 'bienvenida', 'Reglas, recursos y guías de diseño interactivo ✨', 'announcement', 'INFORMACIÓN', 1),
  ('ch_design_showcase', 'srv_design', 'showcase-animaciones', 'Comparte prototipos con física spring, burbujas y reacciones con partículas', 'text', 'CANALES DE TEXTO', 2),
  ('ch_design_ui', 'srv_design', 'critica-ui', 'Feedback constructivo sobre tipografía, color y micro-interacciones', 'text', 'CANALES DE TEXTO', 3),
  ('ch_design_voice_creative', 'srv_design', 'Sala Creativa', 'Charla en vivo mientras diseñamos', 'voice', 'CANALES DE VOZ', 4),
  ('ch_design_voice_lofi', 'srv_design', 'Beats Lo-Fi 🎧', 'Música suave para concentrarse', 'voice', 'CANALES DE VOZ', 5),
  ('ch_devs_ann', 'srv_devs', 'anuncios', 'Novedades oficiales y despliegues de Comunicate', 'announcement', 'INFORMACIÓN', 1),
  ('ch_devs_general', 'srv_devs', 'general', 'Charla general de desarrollo, arquitectura y producto', 'text', 'CANALES DE TEXTO', 2),
  ('ch_devs_realtime', 'srv_devs', 'tiempo-real-sse', 'Sincronización instantánea entre dispositivos, teléfono y correo', 'text', 'CANALES DE TEXTO', 3),
  ('ch_devs_voice_standup', 'srv_devs', 'Daily Standup', 'Sincronización rápida del equipo', 'voice', 'CANALES DE VOZ', 4),
  ('ch_devs_voice_pair', 'srv_devs', 'Pair Programming', 'Programación en vivo', 'voice', 'CANALES DE VOZ', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (
  id, target_type, target_id, sender_id, content, type,
  reply_to_id, metadata_json, read_by_json, edited_at, created_at
) VALUES
  (
    'msg_f1', 'dm', 'dm_nacho_felipe', 'user_nacho',
    '¡Hola Felipe! 🎸 Armé nuestra propia app de chat con animaciones estilo Telegram y Discord. ¡Entra con el link de invitación que te mandé por WhatsApp!',
    'text', NULL, '{"sentVia":"phone"}', '["user_nacho"]', NULL, '2026-11-15T23:42:00.000Z'
  ),
  (
    'msg_s1', 'dm', 'dm_nacho_sofia', 'user_sofia',
    '¡Hola Nacho! Ya viste cómo quedaron las burbujas con física spring y las reacciones con explosión de partículas? ✨',
    'text', NULL, NULL, '["user_sofia","user_nacho"]', NULL, '2026-11-15T23:32:00.000Z'
  ),
  (
    'msg_s2', 'dm', 'dm_nacho_sofia', 'user_nacho',
    '¡Se ven increíbles! Además ya podemos invitar amigos directo por WhatsApp o correo 📱✉️',
    'text', 'msg_s1', NULL, '["user_nacho","user_sofia"]', NULL, '2026-11-15T23:34:00.000Z'
  ),
  (
    'msg_n1', 'dm', 'dm_nacho_nova', 'user_nova',
    '¡Bienvenido a **Comunicate**! Soy Nova ✨. Escríbeme cualquier mensaje, sticker o nota de voz aquí y te responderé al instante.',
    'text', NULL, NULL, '["user_nova","user_nacho"]', NULL, '2026-11-15T23:35:00.000Z'
  ),
  (
    'msg_ch1', 'channel', 'ch_design_showcase', 'user_sofia',
    'Bienvenidos a **#showcase-animaciones** 🎨 Aquí combinamos lo mejor de Telegram con Discord.',
    'text', NULL, NULL, '["user_sofia","user_nacho"]', NULL, '2026-11-15T23:28:00.000Z'
  ),
  (
    'msg_dev1', 'channel', 'ch_devs_general', 'user_nacho',
    '¡Equipo! Comunicate ya está listo en producción en Netlify con base de datos persistente 🚀',
    'text', NULL, NULL, '["user_nacho"]', NULL, '2026-11-15T23:20:00.000Z'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES
  ('msg_s1', 'user_nacho', '❤️', '2026-11-15T23:33:00.000Z'),
  ('msg_s2', 'user_sofia', '🔥', '2026-11-15T23:35:00.000Z'),
  ('msg_ch1', 'user_nacho', '🔥', '2026-11-15T23:29:00.000Z')
ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
