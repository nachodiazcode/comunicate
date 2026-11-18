# Comunicate 💬✨

Web App / PWA híbrida que combina **mensajería directa estilo Telegram y WhatsApp** (agregando contactos por número de teléfono y/o correo electrónico) con **servidores, canales y salas de voz estilo Discord**, impulsada por animaciones físicas con Framer Motion y sincronización en tiempo real mediante Server-Sent Events (SSE) + SQLite nativo (`node:sqlite`).

## Características Principales

- **Agenda y Chats por Número o Correo (`+código` / `email`)**:
  - Busca usuarios registrados en vivo mientras escribes su teléfono o email.
  - Si agregas un número o correo que aún no tiene cuenta, se crea el chat directo al instante y, cuando esa persona se registre con ese mismo número o correo, reclama automáticamente sus mensajes pendientes.
- **Híbrido Telegram + Discord**:
  - **Barra lateral izquierda (Dock)** con indicador elástico (`layoutId`), DMs con contador de no leídos, servidores con estado de salas de voz en vivo y creación rápida de comunidades.
  - Alterna en cualquier conversación entre **Modo Burbujas (Telegram)** y **Modo Compacto (Discord)**.
- **Micro-interacciones y Animaciones**:
  - Burbujas con entrada spring y gesto **deslizar para responder** (*swipe-to-reply*).
  - **Explosión de partículas** al reaccionar con emojis (`❤️`, `🔥`, `😂`, `🚀`, `👏`, `✨`) en tiempo real.
  - **Stickers gigantes interactivos**, grabador/reproductor de **notas de voz con ondas animadas** (`1x`, `1.5x`, `2x`), botón morfing **Micrófono → Enviar**, doble check `✓✓` de lectura e indicador líquido de `"escribiendo..."`.
  - **Nova ✨ Bot** integrado para probar respuestas, reacciones y animaciones en vivo con una sola pestaña, además de soporte **multi-usuario real por pestaña**.

## Desarrollo Local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 en dos pestañas distintas y usa el botón **Cuenta** (abajo a la izquierda) para elegir otro usuario o registrar tu propio número/correo y ver los mensajes, escritura y reacciones viajar en vivo.

## Contrato API

Consulta la especificación completa de endpoints en `openapi.yaml`.
