"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Megaphone, Sparkles, Volume2, X } from "lucide-react";
import type { Channel, ChannelType, Server } from "@/types/chat";
import { createChannelApi, createServerApi } from "@/lib/client/api";

const SERVER_PRESETS = [
  { icon: "🎮", gradient: "from-indigo-500 via-purple-500 to-pink-500" },
  { icon: "🚀", gradient: "from-cyan-500 via-blue-500 to-indigo-600" },
  { icon: "🎨", gradient: "from-rose-500 via-pink-500 to-amber-400" },
  { icon: "⚡", gradient: "from-emerald-400 via-teal-500 to-cyan-500" },
  { icon: "🎵", gradient: "from-violet-500 via-fuchsia-500 to-rose-500" },
  { icon: "🌎", gradient: "from-amber-400 via-orange-500 to-red-500" },
];

export function CreateServerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (server: Server) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [presetIdx, setPresetIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const preset = SERVER_PRESETS[presetIdx];
      const { server } = await createServerApi({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: preset.icon,
        gradient: preset.gradient,
      });
      onCreated(server);
      setName("");
      setDescription("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#131728] border border-white/15 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Crear Comunidad / Servidor
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                {SERVER_PRESETS.map((p, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setPresetIdx(idx)}
                    className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${
                      p.gradient
                    } flex items-center justify-center text-lg transition cursor-pointer ${
                      presetIdx === idx
                        ? "ring-2 ring-white scale-110 shadow-lg"
                        : "opacity-60 hover:opacity-90"
                    }`}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">
                  Nombre del servidor
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Club de Gaming & Música"
                  className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Descripción corta (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Canales de texto, anuncios y salas de voz"
                  className="mt-1 w-full bg-[#0b0d14] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-bold shadow-lg cursor-pointer"
                >
                  {loading ? "Creando..." : "Crear Servidor"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CreateChannelModal({
  serverId,
  onClose,
  onCreated,
}: {
  serverId: string | null;
  onClose: () => void;
  onCreated: (serverId: string, channel: Channel) => void;
}) {
  const [type, setType] = useState<ChannelType>("text");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId || !name.trim()) return;
    setLoading(true);
    try {
      const { channel } = await createChannelApi(serverId, {
        name: name.trim(),
        topic: topic.trim() || undefined,
        type,
      });
      onCreated(serverId, channel);
      setName("");
      setTopic("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {serverId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#131728] border border-white/15 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Crear Canal</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "text", label: "Texto", icon: Hash },
                    { id: "voice", label: "Sala Voz", icon: Volume2 },
                    { id: "announcement", label: "Anuncios", icon: Megaphone },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = type === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setType(opt.id)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-semibold transition cursor-pointer ${
                        active
                          ? "bg-indigo-500/25 border-indigo-400 text-white"
                          : "bg-[#0b0d14] border-white/10 text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">
                  Nombre del canal
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    type === "voice" ? "Ej. Café de la tarde" : "ej. ideas-ui"
                  }
                  className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Tema / descripción (opcional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="¿De qué se habla en este canal?"
                  className="mt-1 w-full bg-[#0b0d14] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                >
                  {loading ? "Creando..." : "Crear Canal"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
