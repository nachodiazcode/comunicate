"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Hash,
  Info,
  LayoutList,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Pencil,
  Phone,
  PhoneCall,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type {
  Channel,
  DmConversation,
  Message,
  MessageMetadata,
  MessageType,
  Server,
  TargetType,
  User,
} from "@/types/chat";
import { UserAvatar } from "./UserAvatar";
import { MessageItem } from "./MessageItem";
import {
  buildInviteMessageText,
  buildSmsInviteUrl,
  buildWhatsAppInviteUrl,
} from "@/lib/client/invite";

const STICKER_PACK = [
  { emoji: "🚀", label: "Despegue" },
  { emoji: "🔥", label: "Increíble" },
  { emoji: "🎉", label: "Celebración" },
  { emoji: "💜", label: "Amor Púrpura" },
  { emoji: "⚡", label: "Ultra Rápido" },
  { emoji: "🤩", label: "Fascinado" },
  { emoji: "💎", label: "Joya" },
  { emoji: "👻", label: "Fantasmita" },
  { emoji: "🦄", label: "Magia" },
  { emoji: "🍕", label: "Pizza Time" },
  { emoji: "🛸", label: "Nave" },
  { emoji: "🌈", label: "Arcoíris" },
];

const POPULAR_EMOJIS = [
  "😀",
  "😂",
  "🥹",
  "😍",
  "😎",
  "🤝",
  "🙌",
  "👏",
  "🔥",
  "✨",
  "❤️",
  "💯",
  "🎯",
  "🧠",
  "💻",
  "📱",
  "✉️",
  "🎶",
  "☕",
  "🌟",
];

interface ChatStageProps {
  targetType: TargetType;
  activeDm: DmConversation | null;
  activeServer: Server | null;
  activeChannel: Channel | null;
  messages: Message[];
  currentUser: User;
  typingNames: string[];
  burstState: Record<string, { emoji: string; seq: number }>;
  soundEnabled: boolean;
  detailsOpen: boolean;
  onToggleSound: () => void;
  onToggleDetails: () => void;
  onMobileBack: () => void;
  onSendMessage: (params: {
    content: string;
    type?: MessageType;
    replyToId?: string | null;
    metadata?: MessageMetadata | null;
  }) => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  onStartCall: (mode: "audio" | "video") => void;
  onOpenAddContact: () => void;
}

export function ChatStage({
  targetType,
  activeDm,
  activeServer,
  activeChannel,
  messages,
  currentUser,
  typingNames,
  burstState,
  soundEnabled,
  detailsOpen,
  onToggleSound,
  onToggleDetails,
  onMobileBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onTypingChange,
  onStartCall,
  onOpenAddContact,
}: ChatStageProps) {
  const currentTargetKey = `${targetType}:${
    targetType === "dm" ? activeDm?.id ?? "" : activeChannel?.id ?? ""
  }`;

  const [viewMode, setViewMode] = useState<"bubbles" | "cozy">("bubbles");
  const [text, setText] = useState("");
  const [replyState, setReplyState] = useState<{
    key: string;
    msg: Message;
  } | null>(null);
  const [editState, setEditState] = useState<{
    key: string;
    msg: Message;
  } | null>(null);
  const [emojiPopoverKey, setEmojiPopoverKey] = useState<string | null>(null);

  const replyingTo =
    replyState?.key === currentTargetKey ? replyState.msg : null;
  const editingMessage =
    editState?.key === currentTargetKey ? editState.msg : null;
  const emojiPopover = emojiPopoverKey === currentTargetKey;

  const setReplyingTo = (msg: Message | null) =>
    setReplyState(msg ? { key: currentTargetKey, msg } : null);
  const setEditingMessage = (msg: Message | null) =>
    setEditState(msg ? { key: currentTargetKey, msg } : null);
  const setEmojiPopover = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === "function" ? val(emojiPopover) : val;
    setEmojiPopoverKey(next ? currentTargetKey : null);
  };

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [copiedBadge, setCopiedBadge] = useState<
    "phone" | "email" | "invite" | null
  >(null);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom when messages or typing indicator update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingNames.length]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const visibleMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.sender.name.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const peer = activeDm?.peer ?? null;
  const headerTitle =
    targetType === "dm"
      ? activeDm?.contactAlias || peer?.name || "Conversación"
      : activeChannel?.name || "general";

  const handleCopy = (
    kind: "phone" | "email" | "invite",
    val: string
  ) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedBadge(kind);
    setTimeout(() => setCopiedBadge(null), 1800);
  };

  const handleInputChange = (val: string) => {
    setText(val);
    onTypingChange(val.trim().length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 2200);
  };

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessage) {
      const msgId = editingMessage.id;
      setEditingMessage(null);
      setText("");
      await onEditMessage(msgId, trimmed);
      return;
    }

    const replyId = replyingTo?.id ?? null;
    setText("");
    setReplyingTo(null);
    onTypingChange(false);
    await onSendMessage({
      content: trimmed,
      type: "text",
      replyToId: replyId,
    });
  };

  const handleSendSticker = async (emoji: string, label: string) => {
    setEmojiPopover(false);
    const replyId = replyingTo?.id ?? null;
    setReplyingTo(null);
    await onSendMessage({
      content: emoji,
      type: "sticker",
      replyToId: replyId,
      metadata: { stickerLabel: label },
    });
  };

  const startVoiceRecording = async () => {
    chunksRef.current = [];
    setRecordSeconds(0);
    setIsRecording(true);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        recorder.start();
      }
    } catch {
      // Fallback to simulated waveform voice note seamlessly if mic permission isn't granted
      mediaRecorderRef.current = null;
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  };

  const finishAndSendVoiceRecording = async () => {
    const dur = Math.max(1, recordSeconds);
    const waveform = Array.from({ length: 26 }).map(() =>
      Math.floor(24 + Math.random() * 72)
    );

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    setIsRecording(false);

    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
      recorder.stream.getTracks().forEach((t) => t.stop());

      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = await blobToDataUrl(blob);
        await onSendMessage({
          content: `Mensaje de voz (0:${String(dur).padStart(2, "0")})`,
          type: "voice",
          replyToId: replyingTo?.id ?? null,
          metadata: { durationSec: dur, waveform, audioUrl },
        });
        setReplyingTo(null);
        return;
      }
    }

    await onSendMessage({
      content: `Mensaje de voz (0:${String(dur).padStart(2, "0")})`,
      type: "voice",
      replyToId: replyingTo?.id ?? null,
      metadata: { durationSec: dur, waveform },
    });
    setReplyingTo(null);
  };

  const jumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(msgId);
      setTimeout(() => setHighlightedId(null), 1800);
    }
  };

  if (targetType === "dm" && !activeDm) {
    return (
      <div className="flex-1 h-full chat-wallpaper-dm flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md p-7 rounded-3xl bg-[#141829]/85 backdrop-blur-xl border border-white/10 shadow-2xl space-y-4"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl shadow-lg">
            💬
          </div>
          <h2 className="text-lg font-bold text-white">
            Selecciona un chat o agrega un contacto
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Envía mensajes directos agregando cualquier{" "}
            <strong className="text-emerald-300">número de teléfono</strong>{" "}
            (como WhatsApp) y/o{" "}
            <strong className="text-sky-300">correo electrónico</strong>, o
            entra a un servidor estilo Discord en la barra izquierda.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenAddContact}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold shadow-lg cursor-pointer"
          >
            + Agregar número o correo
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 h-full flex flex-col min-w-0 relative ${
        targetType === "dm" ? "chat-wallpaper-dm" : "chat-wallpaper-channel"
      }`}
    >
      {/* Top Chat Header */}
      <header className="min-h-[64px] py-2 shrink-0 px-3 md:px-5 bg-[#101320]/85 backdrop-blur-xl border-b border-white/[0.07] flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onMobileBack}
            className="md:hidden p-2 rounded-xl hover:bg-white/10 text-slate-200 cursor-pointer"
            aria-label="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {targetType === "dm" && peer ? (
            <>
              <UserAvatar user={peer} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-white truncate">
                    {headerTitle}
                  </h2>
                  {peer.isBot && (
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  )}
                </div>

                {/* Clickable Phone & Email Badges */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                  {peer.phone && (
                    <button
                      onClick={() => handleCopy("phone", peer.phone!)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 transition cursor-pointer"
                      title="Clic para copiar número"
                    >
                      {copiedBadge === "phone" ? (
                        <Check className="w-2.5 h-2.5" />
                      ) : (
                        <Phone className="w-2.5 h-2.5" />
                      )}
                      <span className="truncate max-w-[130px]">
                        {copiedBadge === "phone" ? "¡Copiado!" : peer.phone}
                      </span>
                    </button>
                  )}
                  {peer.email && (
                    <button
                      onClick={() => handleCopy("email", peer.email!)}
                      className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-400/20 transition cursor-pointer"
                      title="Clic para copiar correo"
                    >
                      {copiedBadge === "email" ? (
                        <Check className="w-2.5 h-2.5" />
                      ) : (
                        <Mail className="w-2.5 h-2.5" />
                      )}
                      <span className="truncate max-w-[160px]">
                        {copiedBadge === "email" ? "¡Copiado!" : peer.email}
                      </span>
                    </button>
                  )}
                  {!peer.phone && !peer.email && (
                    <span className="truncate">{peer.customStatus || peer.handle}</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-300 shrink-0">
                {activeChannel?.type === "announcement" ? (
                  <Megaphone className="w-4 h-4 text-amber-400" />
                ) : (
                  <Hash className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white truncate">
                    {headerTitle}
                  </h2>
                  {activeServer && (
                    <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                      {activeServer.name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {activeChannel?.topic || "Canal en tiempo real"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* View Mode Switcher: Bubbles (Telegram) vs Cozy (Discord) */}
          <button
            onClick={() =>
              setViewMode((m) => (m === "bubbles" ? "cozy" : "bubbles"))
            }
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-slate-200 border border-white/[0.07] transition cursor-pointer"
            title="Alternar entre Burbujas (Telegram) y Compacto (Discord)"
          >
            {viewMode === "bubbles" ? (
              <>
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Burbujas</span>
              </>
            ) : (
              <>
                <LayoutList className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Discord</span>
              </>
            )}
          </button>

          {targetType === "dm" && (
            <>
              <button
                onClick={() => onStartCall("audio")}
                className="p-2 rounded-xl hover:bg-white/[0.08] text-slate-300 hover:text-emerald-300 transition cursor-pointer"
                title="Llamada de voz"
              >
                <PhoneCall className="w-4 h-4" />
              </button>
              <button
                onClick={() => onStartCall("video")}
                className="p-2 rounded-xl hover:bg-white/[0.08] text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                title="Videollamada"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={`p-2 rounded-xl transition cursor-pointer ${
              searchOpen
                ? "bg-indigo-500/25 text-indigo-200"
                : "hover:bg-white/[0.08] text-slate-300"
            }`}
            title="Buscar mensajes"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl hover:bg-white/[0.08] text-slate-300 transition cursor-pointer"
            title={
              soundEnabled
                ? "Efectos de sonido activados"
                : "Efectos de sonido silenciados"
            }
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-300" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          <button
            onClick={onToggleDetails}
            className={`p-2 rounded-xl transition cursor-pointer ${
              detailsOpen
                ? "bg-indigo-500/25 text-indigo-200"
                : "hover:bg-white/[0.08] text-slate-300"
            }`}
            title="Información y miembros"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* WhatsApp / SMS Direct Invite Banner when chatting with an invited contact */}
      {targetType === "dm" && peer && peer.phone && peer.isPlaceholder && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950/75 via-[#13182a]/95 to-indigo-950/65 border-b border-emerald-400/20 flex flex-wrap items-center justify-between gap-2.5 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="text-xs text-slate-200 truncate">
              Invita a <strong>{headerTitle}</strong> ({peer.phone}) para que
              entre al chat en vivo:
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={buildWhatsAppInviteUrl({
                name: headerTitle,
                phone: peer.phone,
                email: peer.email,
                fromName: currentUser.name,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
            >
              <span>📲 Enviar por WhatsApp</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={buildSmsInviteUrl({
                name: headerTitle,
                phone: peer.phone,
                fromName: currentUser.name,
              })}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 text-xs font-semibold transition"
            >
              SMS
            </a>

            <button
              onClick={() =>
                handleCopy(
                  "invite",
                  buildInviteMessageText({
                    name: headerTitle,
                    phone: peer.phone,
                    email: peer.email,
                    fromName: currentUser.name,
                  })
                )
              }
              className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              {copiedBadge === "invite" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar invitación</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Search Bar Drawer */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[#121626]/95 border-b border-white/[0.07] flex items-center gap-2 z-10"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar mensajes en esta conversación..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 outline-none"
            />
            {searchQuery && (
              <span className="text-[11px] text-indigo-300">
                {visibleMessages.length} resultados
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Messages Feed */}
      <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
        {/* Conversation Intro Banner */}
        <div className="px-6 py-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.07] text-[11px] text-slate-300">
            {targetType === "dm" ? (
              <>
                <span>🔒 Mensajes en tiempo real</span>
                {peer?.phone && <span>· 📱 {peer.phone}</span>}
                {peer?.email && <span>· ✉️ {peer.email}</span>}
              </>
            ) : (
              <span>
                ✨ Inicio del canal <strong>#{headerTitle}</strong> · Reacciona o
                desliza para responder
              </span>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {visibleMessages.map((msg, idx) => {
            const prev = visibleMessages[idx - 1];
            const isGroupedWithPrev =
              Boolean(prev) &&
              prev.senderId === msg.senderId &&
              new Date(msg.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <
                1000 * 60 * 5;

            return (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUser={currentUser}
                viewMode={viewMode}
                isGroupedWithPrev={isGroupedWithPrev}
                highlighted={highlightedId === msg.id}
                burstTrigger={burstState[msg.id] ?? null}
                onReply={(m) => {
                  setEditingMessage(null);
                  setReplyingTo(m);
                  inputRef.current?.focus();
                }}
                onToggleReaction={onToggleReaction}
                onEdit={(m) => {
                  setReplyingTo(null);
                  setEditingMessage(m);
                  setText(m.content);
                  inputRef.current?.focus();
                }}
                onDelete={onDeleteMessage}
                onJumpToMessage={jumpToMessage}
              />
            );
          })}
        </AnimatePresence>

        {/* Live Animated Typing Indicator */}
        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.94 }}
              className="px-6 pt-3 flex items-center gap-2"
            >
              <div className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-[#1b2033] border border-white/10 inline-flex items-center gap-2 shadow-md">
                <div className="flex items-center gap-1">
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: 0 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: 0.15 }}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: 0.3 }}
                    className="w-1.5 h-1.5 rounded-full bg-fuchsia-400"
                  />
                </div>
                <span className="text-xs text-slate-300 font-medium">
                  {typingNames.join(", ")}{" "}
                  {typingNames.length === 1
                    ? "está escribiendo..."
                    : "están escribiendo..."}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} className="h-3" />
      </div>

      {/* Bottom Rich Composer */}
      <div className="px-3 md:px-5 pb-3.5 pt-1.5 relative z-20">
        {/* Reply or Edit Preview Banner */}
        <AnimatePresence>
          {(replyingTo || editingMessage) && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              className="mb-2 px-3.5 py-2 rounded-2xl bg-[#171c2e]/95 backdrop-blur-md border border-indigo-400/25 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {editingMessage ? (
                  <Pencil className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Reply className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-indigo-300">
                    {editingMessage
                      ? "Editando tu mensaje"
                      : `Respondiendo a ${replyingTo?.sender.name}`}
                  </div>
                  <div className="text-xs text-slate-300 truncate">
                    {(editingMessage ?? replyingTo)?.content}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  if (editingMessage) {
                    setEditingMessage(null);
                    setText("");
                  }
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticker & Emoji Picker Popover */}
        <AnimatePresence>
          {emojiPopover && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="absolute bottom-[74px] left-3 md:left-5 w-[310px] sm:w-[340px] rounded-3xl bg-[#151a2c]/98 backdrop-blur-2xl border border-white/15 shadow-2xl p-3.5 z-40 space-y-3"
            >
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-2 flex items-center justify-between">
                  <span>Stickers Animados Gigantes</span>
                  <span className="text-slate-500">1 clic para enviar</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {STICKER_PACK.map((st) => (
                    <motion.button
                      key={st.emoji}
                      whileHover={{ scale: 1.22, rotate: -6 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSendSticker(st.emoji, st.label)}
                      className="h-11 rounded-2xl bg-white/[0.04] hover:bg-indigo-500/20 border border-white/[0.05] flex items-center justify-center text-2xl cursor-pointer"
                      title={st.label}
                    >
                      {st.emoji}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.08] pt-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Insertar Emoji en texto
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {POPULAR_EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => {
                        setText((prev) => prev + em);
                        inputRef.current?.focus();
                      }}
                      className="h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-base cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input / Voice Recording Container */}
        {isRecording ? (
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-[52px] px-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-[#191d30] to-[#191d30] border border-rose-500/40 flex items-center justify-between gap-3 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-rose-200 tabular-nums">
                Grabando 0:{String(recordSeconds).padStart(2, "0")}
              </span>
              <div className="hidden sm:flex items-center gap-1 h-5">
                {Array.from({ length: 16 }).map((_, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      height: ["25%", `${45 + ((i * 19) % 55)}%`, "30%"],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.55 + (i % 4) * 0.12,
                    }}
                    className="w-1 rounded-full bg-rose-400/80"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cancelVoiceRecording}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Cancelar</span>
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={finishAndSendVoiceRecording}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar voz</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-end gap-2 bg-[#161a2c]/95 backdrop-blur-xl border border-white/[0.1] focus-within:border-indigo-400/50 rounded-2xl px-3 py-2 shadow-2xl transition">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setEmojiPopover((v) => !v)}
              className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                emojiPopover
                  ? "bg-indigo-500/25 text-indigo-300"
                  : "text-slate-400 hover:text-amber-300 hover:bg-white/[0.06]"
              }`}
              title="Stickers animados y Emojis"
            >
              <Smile className="w-5 h-5" />
            </motion.button>

            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder={
                targetType === "dm"
                  ? `Mensaje para ${headerTitle}...`
                  : `Enviar mensaje a #${headerTitle}...`
              }
              className="flex-1 max-h-32 bg-transparent py-1.5 text-sm text-white placeholder:text-slate-500 outline-none resize-none leading-relaxed"
            />

            {/* Morphing Telegram/WhatsApp Action Button: Mic when empty -> Send Plane when typing */}
            <AnimatePresence mode="wait" initial={false}>
              {text.trim().length > 0 ? (
                <motion.button
                  key="send-btn"
                  initial={{ scale: 0.5, rotate: -35, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.5, rotate: 35, opacity: 0 }}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  onClick={handleSendText}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/35 shrink-0 cursor-pointer"
                  title="Enviar mensaje (Enter)"
                >
                  <Send className="w-4 h-4 translate-x-0.5" />
                </motion.button>
              ) : (
                <motion.button
                  key="mic-btn"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  onClick={startVoiceRecording}
                  className="w-10 h-10 rounded-xl bg-white/[0.07] hover:bg-indigo-500/25 text-slate-200 hover:text-indigo-200 flex items-center justify-center shrink-0 cursor-pointer"
                  title="Grabar nota de voz"
                >
                  <Mic className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
