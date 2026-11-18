"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCheck,
  CornerUpLeft,
  Pause,
  Pencil,
  Play,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import type { Message, User } from "@/types/chat";
import { UserAvatar } from "./UserAvatar";
import { playSimulatedVoiceTone } from "@/lib/client/sound";

const QUICK_REACTIONS = ["❤️", "🔥", "😂", "🚀", "👏", "✨"];

interface BurstParticle {
  id: string;
  emoji: string;
  dx: number;
  dy: number;
  rot: number;
  scale: number;
}

interface MessageItemProps {
  message: Message;
  currentUser: User;
  viewMode: "bubbles" | "cozy";
  isGroupedWithPrev: boolean;
  highlighted: boolean;
  burstTrigger?: { emoji: string; seq: number } | null;
  onReply: (message: Message) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onJumpToMessage: (messageId: string) => void;
}

function isSingleJumboEmoji(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 8) return false;
  // Match 1-2 pictographic emojis with no letters/digits
  return (
    /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D)+$/u.test(
      trimmed
    ) && !/[a-zA-Z0-9]/.test(trimmed)
  );
}

export function MessageItem({
  message,
  currentUser,
  viewMode,
  isGroupedWithPrev,
  highlighted,
  burstTrigger,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onJumpToMessage,
}: MessageItemProps) {
  const isMine = message.senderId === currentUser.id;
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [particles, setParticles] = useState<BurstParticle[]>([]);
  const [stickerBounce, setStickerBounce] = useState(0);
  const lastSeqRef = useRef<number>(0);

  const isJumbo =
    message.type === "sticker" ||
    (message.type === "text" && isSingleJumboEmoji(message.content));

  const triggerLocalBurst = (emoji: string) => {
    const batch: BurstParticle[] = Array.from({ length: 9 }).map((_, idx) => {
      const angle = (Math.PI * 2 * idx) / 9 + (Math.random() * 0.4 - 0.2);
      const dist = 34 + Math.random() * 44;
      return {
        id: `${Date.now()}-${idx}-${Math.random()}`,
        emoji: idx % 3 === 0 ? "✨" : emoji,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 18,
        rot: Math.random() * 90 - 45,
        scale: 0.75 + Math.random() * 0.55,
      };
    });
    setParticles((prev) => [...prev, ...batch]);
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !batch.some((b) => b.id === p.id))
      );
    }, 900);
  };

  useEffect(() => {
    if (burstTrigger && burstTrigger.seq !== lastSeqRef.current) {
      lastSeqRef.current = burstTrigger.seq;
      triggerLocalBurst(burstTrigger.emoji);
    }
  }, [burstTrigger]);

  const readByOthers = useMemo(
    () => message.readBy.some((uid) => uid !== message.senderId),
    [message.readBy, message.senderId]
  );

  const timeLabel = useMemo(() => {
    try {
      return new Date(message.createdAt).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [message.createdAt]);

  // Discord Cozy Mode
  if (viewMode === "cozy") {
    return (
      <motion.div
        id={`msg-${message.id}`}
        layout="position"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 440, damping: 32 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPickerOpen(false);
        }}
        className={`group relative px-4 py-1.5 rounded-xl transition-colors ${
          highlighted
            ? "bg-indigo-500/20 ring-1 ring-indigo-400/50"
            : "hover:bg-white/[0.03]"
        } ${isGroupedWithPrev ? "mt-0.5" : "mt-3"}`}
      >
        {/* Reply Spine */}
        {message.replyTo && (
          <button
            onClick={() => onJumpToMessage(message.replyTo!.id)}
            className="ml-11 mb-1 flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-300 transition cursor-pointer max-w-full truncate"
          >
            <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-semibold text-indigo-300 shrink-0">
              {message.replyTo.senderName}
            </span>
            <span className="truncate opacity-80">{message.replyTo.content}</span>
          </button>
        )}

        <div className="flex items-start gap-3">
          {!isGroupedWithPrev ? (
            <UserAvatar
              user={message.sender}
              size="sm"
              showStatus={false}
            />
          ) : (
            <div className="w-8 shrink-0 text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 text-right pt-1">
              {timeLabel}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {!isGroupedWithPrev && (
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[13px] font-semibold text-white">
                  {message.sender.name}
                </span>
                {message.sender.isBot && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/25 text-indigo-300">
                    BOT
                  </span>
                )}
                <span className="text-[10px] text-slate-400">{timeLabel}</span>
                {message.editedAt && (
                  <span className="text-[10px] text-slate-500">(editado)</span>
                )}
              </div>
            )}

            {message.type === "voice" ? (
              <div className="max-w-xs mt-1">
                <VoiceNotePlayer message={message} isMine={false} />
              </div>
            ) : isJumbo ? (
              <motion.div
                key={stickerBounce}
                animate={{ scale: [1, 1.24, 0.94, 1], rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.45 }}
                onClick={() => {
                  setStickerBounce((c) => c + 1);
                  triggerLocalBurst(message.content.trim());
                }}
                className="inline-block text-5xl py-1 cursor-pointer select-none"
                title="¡Haz clic para animar!"
              >
                {message.content}
              </motion.div>
            ) : (
              <div
                data-selectable="true"
                className="text-[13.5px] leading-relaxed text-slate-100 break-words whitespace-pre-wrap"
              >
                <FormattedText text={message.content} />
              </div>
            )}

            <ReactionsRow
              message={message}
              currentUserId={currentUser.id}
              onToggle={(emoji) => {
                triggerLocalBurst(emoji);
                onToggleReaction(message.id, emoji);
              }}
            />
          </div>
        </div>

        <ParticleLayer particles={particles} alignRight={false} />

        <FloatingActionDock
          visible={hovered || pickerOpen}
          isMine={isMine}
          alignRight={true}
          onQuickReact={(emoji) => {
            triggerLocalBurst(emoji);
            onToggleReaction(message.id, emoji);
          }}
          onReply={() => onReply(message)}
          onEdit={() => onEdit(message)}
          onDelete={() => onDelete(message.id)}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
        />
      </motion.div>
    );
  }

  // Telegram / WhatsApp Rich Animated Bubbles Mode
  return (
    <motion.div
      id={`msg-${message.id}`}
      layout="position"
      initial={{
        opacity: 0,
        y: 16,
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.85,
        transition: { duration: 0.16 },
      }}
      transition={{
        type: "spring",
        stiffness: 430,
        damping: 29,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPickerOpen(false);
      }}
      className={`group relative flex items-end gap-2.5 px-3 md:px-6 ${
        isMine ? "justify-end" : "justify-start"
      } ${isGroupedWithPrev ? "mt-1" : "mt-3.5"} ${
        highlighted ? "py-1.5 rounded-2xl bg-indigo-500/15" : ""
      }`}
    >
      {!isMine && (
        <div className="w-8 shrink-0 self-end mb-1">
          {!isGroupedWithPrev && (
            <UserAvatar user={message.sender} size="sm" showStatus={false} />
          )}
        </div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={isMine ? { left: 0.25, right: 0.04 } : { left: 0.04, right: 0.25 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 48) {
            onReply(message);
          }
        }}
        style={{
          transformOrigin: isMine ? "bottom right" : "bottom left",
        }}
        className={`relative max-w-[82%] sm:max-w-[70%] flex flex-col ${
          isMine ? "items-end" : "items-start"
        }`}
      >
        {/* Particle Burst Layer */}
        <ParticleLayer particles={particles} alignRight={isMine} />

        {/* Hover Floating Reaction & Action Toolbar */}
        <FloatingActionDock
          visible={hovered || pickerOpen}
          isMine={isMine}
          alignRight={isMine}
          onQuickReact={(emoji) => {
            triggerLocalBurst(emoji);
            onToggleReaction(message.id, emoji);
          }}
          onReply={() => onReply(message)}
          onEdit={() => onEdit(message)}
          onDelete={() => onDelete(message.id)}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
        />

        {isJumbo ? (
          <div className="flex flex-col items-end gap-1">
            {message.replyTo && (
              <button
                onClick={() => onJumpToMessage(message.replyTo!.id)}
                className="px-2.5 py-1 rounded-xl bg-white/[0.08] border-l-2 border-indigo-400 text-left text-[11px] text-slate-200 max-w-[220px] truncate cursor-pointer"
              >
                <span className="font-semibold text-indigo-300 block">
                  {message.replyTo.senderName}
                </span>
                <span className="truncate block opacity-80">
                  {message.replyTo.content}
                </span>
              </button>
            )}
            <motion.div
              key={stickerBounce}
              whileHover={{ scale: 1.12, rotate: isMine ? -4 : 4 }}
              whileTap={{ scale: 1.32 }}
              animate={{ scale: [0.85, 1.15, 1], rotate: [0, -6, 6, 0] }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              onClick={() => {
                setStickerBounce((c) => c + 1);
                triggerLocalBurst(message.content.trim());
              }}
              className="text-6xl py-1 px-2 select-none cursor-pointer drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
              title="¡Toca el sticker para animarlo!"
            >
              {message.content}
            </motion.div>
            <div className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-[10px] text-slate-300 flex items-center gap-1">
              <span>{timeLabel}</span>
              {isMine &&
                (readByOthers ? (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                ) : (
                  <Check className="w-3 h-3 text-slate-400" />
                ))}
            </div>
          </div>
        ) : (
          <div
            className={`relative px-3.5 py-2.5 shadow-lg transition-shadow ${
              isMine
                ? "bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white rounded-[20px] rounded-br-[6px] shadow-indigo-950/50 border border-white/15"
                : "bg-[#1b2033]/95 backdrop-blur-md text-slate-100 rounded-[20px] rounded-bl-[6px] border border-white/[0.08] shadow-black/30"
            }`}
          >
            {/* Sender Name in Channels or non-grouped incoming */}
            {!isMine && !isGroupedWithPrev && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-bold bg-gradient-to-r from-indigo-300 to-pink-300 bg-clip-text text-transparent">
                  {message.sender.name}
                </span>
                {message.sender.isBot && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                    BOT
                  </span>
                )}
              </div>
            )}

            {/* Quoted Reply Block (Telegram / WhatsApp style) */}
            {message.replyTo && (
              <button
                onClick={() => onJumpToMessage(message.replyTo!.id)}
                className={`w-full mb-2 px-2.5 py-1.5 rounded-xl text-left border-l-[3px] transition cursor-pointer block ${
                  isMine
                    ? "bg-black/20 hover:bg-black/30 border-cyan-300 text-white/90"
                    : "bg-white/[0.06] hover:bg-white/[0.1] border-indigo-400 text-slate-200"
                }`}
              >
                <div className="text-[11px] font-bold truncate opacity-95">
                  {message.replyTo.senderName}
                </div>
                <div className="text-[11px] truncate opacity-75">
                  {message.replyTo.type === "voice"
                    ? "🎙️ Nota de voz"
                    : message.replyTo.content}
                </div>
              </button>
            )}

            {/* Main Content */}
            {message.type === "voice" ? (
              <VoiceNotePlayer message={message} isMine={isMine} />
            ) : (
              <div
                data-selectable="true"
                className="text-[13.5px] leading-[1.45] break-words whitespace-pre-wrap"
              >
                <FormattedText text={message.content} />
              </div>
            )}

            {/* Timestamp + Edited + Read Receipt */}
            <div
              className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                isMine ? "text-indigo-100/80" : "text-slate-400"
              }`}
            >
              {message.metadata?.sentVia &&
                message.metadata.sentVia !== "app" && (
                  <span className="opacity-80 mr-1">
                    {message.metadata.sentVia === "phone"
                      ? "vía número"
                      : "vía correo"}
                  </span>
                )}
              {message.editedAt && <span className="italic">editado ·</span>}
              <span>{timeLabel}</span>
              {isMine &&
                (readByOthers ? (
                  <motion.span
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    title="Leído"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-300 drop-shadow-[0_0_4px_rgba(103,232,249,0.7)]" />
                  </motion.span>
                ) : (
                  <Check className="w-3 h-3 opacity-75" />
                ))}
            </div>
          </div>
        )}

        {/* Animated Reaction Pills */}
        <ReactionsRow
          message={message}
          currentUserId={currentUser.id}
          onToggle={(emoji) => {
            triggerLocalBurst(emoji);
            onToggleReaction(message.id, emoji);
          }}
        />
      </motion.div>
    </motion.div>
  );
}

function FormattedText({ text }: { text: string }) {
  // Lightweight bold (**...**) and code (`...`) parser
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-black/30 font-mono text-[12px] text-cyan-200"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function ReactionsRow({
  message,
  currentUserId,
  onToggle,
}: {
  message: Message;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}) {
  if (!message.reactions || message.reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <AnimatePresence initial={false}>
        {message.reactions.map((r) => {
          const active = r.userIds.includes(currentUserId);
          return (
            <motion.button
              key={r.emoji}
              layout
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              onClick={() => onToggle(r.emoji)}
              className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition cursor-pointer ${
                active
                  ? "bg-indigo-500/30 border-indigo-400/60 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                  : "bg-[#151929]/90 border-white/10 text-slate-300 hover:border-white/25"
              }`}
            >
              <span>{r.emoji}</span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={r.count}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 6, opacity: 0 }}
                  className="text-[11px] font-semibold tabular-nums"
                >
                  {r.count}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function FloatingActionDock({
  visible,
  isMine,
  alignRight,
  onQuickReact,
  onReply,
  onEdit,
  onDelete,
  pickerOpen,
  setPickerOpen,
}: {
  visible: boolean;
  isMine: boolean;
  alignRight: boolean;
  onQuickReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
}) {
  const extraEmojis = ["🎉", "💜", "🤩", "👀", "💯", "🙌", "⚡", "💎"];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.92 }}
          transition={{ duration: 0.14 }}
          className={`absolute -top-9 z-30 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-[#121625]/95 backdrop-blur-xl border border-white/15 shadow-2xl ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {QUICK_REACTIONS.map((emoji, i) => (
            <motion.button
              key={emoji}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              whileHover={{ scale: 1.3, y: -2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onQuickReact(emoji)}
              className="w-6 h-6 flex items-center justify-center text-sm cursor-pointer"
              title={`Reaccionar con ${emoji}`}
            >
              {emoji}
            </motion.button>
          ))}

          <div className="relative">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="w-6 h-6 rounded-full hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
              title="Más reacciones"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            {pickerOpen && (
              <div className="absolute bottom-8 right-0 p-1.5 rounded-2xl bg-[#151a2d] border border-white/15 shadow-2xl grid grid-cols-4 gap-1 w-36 z-40">
                {extraEmojis.map((em) => (
                  <button
                    key={em}
                    onClick={() => {
                      onQuickReact(em);
                      setPickerOpen(false);
                    }}
                    className="h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-base cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

          <button
            onClick={onReply}
            className="w-6 h-6 rounded-full hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            title="Responder"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {isMine && (
            <>
              <button
                onClick={onEdit}
                className="w-6 h-6 rounded-full hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Editar mensaje"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={onDelete}
                className="w-6 h-6 rounded-full hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                title="Eliminar mensaje"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ParticleLayer({
  particles,
  alignRight,
}: {
  particles: BurstParticle[];
  alignRight: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute top-1/2 ${
        alignRight ? "right-8" : "left-8"
      } z-40`}
    >
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
            animate={{
              x: p.dx,
              y: p.dy,
              scale: p.scale,
              opacity: 0,
              rotate: p.rot,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.78, ease: "easeOut" }}
            className="absolute text-base select-none"
          >
            {p.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function VoiceNotePlayer({
  message,
  isMine,
}: {
  message: Message;
  isMine: boolean;
}) {
  const durationSec = message.metadata?.durationSec ?? 7;
  const waveform = message.metadata?.waveform ?? [
    30, 55, 76, 48, 82, 92, 60, 40, 72, 88, 52, 34, 68, 90, 62, 45, 74, 58, 38,
    64, 48, 32,
  ];
  const audioUrl = message.metadata?.audioUrl;

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopToneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopToneRef.current?.();
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!playing || audioUrl) return;
    stopToneRef.current = playSimulatedVoiceTone();
    const stepMs = 80;
    const increment = (stepMs / 1000 / durationSec) * speed;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 1) {
          setPlaying(false);
          stopToneRef.current?.();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      clearInterval(timer);
      stopToneRef.current?.();
    };
  }, [playing, audioUrl, durationSec, speed]);

  const togglePlay = () => {
    if (audioUrl) {
      if (!audioRef.current) {
        const el = new Audio(audioUrl);
        audioRef.current = el;
        el.ontimeupdate = () => {
          if (el.duration) {
            setProgress(el.currentTime / el.duration);
          }
        };
        el.onended = () => {
          setPlaying(false);
          setProgress(0);
        };
      }
      audioRef.current.playbackRate = speed;
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setPlaying(true);
      }
    } else {
      setPlaying((p) => !p);
    }
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const elapsedSec = Math.round(progress * durationSec);
  const displaySec = playing ? elapsedSec : durationSec;

  return (
    <div className="flex items-center gap-2.5 min-w-[210px] sm:min-w-[250px] py-0.5">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow cursor-pointer ${
          isMine
            ? "bg-white text-indigo-600"
            : "bg-indigo-500 text-white"
        }`}
      >
        {playing ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </motion.button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-[3px] h-7">
          {waveform.map((val, idx) => {
            const pct = idx / waveform.length;
            const active = pct <= progress;
            return (
              <motion.span
                key={idx}
                animate={{
                  height: playing
                    ? `${Math.max(22, Math.min(100, val + (idx % 2 === 0 ? 12 : -8)))}%`
                    : `${Math.max(20, val)}%`,
                }}
                transition={{ duration: 0.2 }}
                onClick={() => setProgress(pct)}
                className={`w-1 rounded-full transition-colors cursor-pointer ${
                  active
                    ? isMine
                      ? "bg-cyan-200"
                      : "bg-indigo-400"
                    : isMine
                    ? "bg-white/35"
                    : "bg-white/20"
                }`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-85">
          <span>
            0:{String(displaySec).padStart(2, "0")}
          </span>
          <button
            onClick={cycleSpeed}
            className="px-1.5 py-0.2 rounded bg-black/25 font-bold hover:bg-black/40 transition cursor-pointer"
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}
