"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Mail,
  MessageSquarePlus,
  Phone,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import type { Contact, DmConversation, Message, User } from "@/types/chat";
import { addContactApi, lookupContacts } from "@/lib/client/api";
import { UserAvatar } from "./UserAvatar";

const COUNTRY_CODES = [
  { code: "+54", label: "🇦🇷 +54 (AR)" },
  { code: "+52", label: "🇲🇽 +52 (MX)" },
  { code: "+34", label: "🇪🇸 +34 (ES)" },
  { code: "+57", label: "🇨🇴 +57 (CO)" },
  { code: "+56", label: "🇨🇱 +56 (CL)" },
  { code: "+51", label: "🇵🇪 +51 (PE)" },
  { code: "+598", label: "🇺🇾 +598 (UY)" },
  { code: "+1", label: "🇺🇸 +1 (US)" },
  { code: "+55", label: "🇧🇷 +55 (BR)" },
];

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (payload: {
    contact: Contact;
    dm: DmConversation;
    initialSentMessage: Message | null;
  }) => void;
}

export function AddContactModal({
  open,
  onClose,
  onCreated,
}: AddContactModalProps) {
  const [mode, setMode] = useState<"phone" | "email" | "both">("both");
  const [dialCode, setDialCode] = useState("+54");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [matches, setMatches] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const composedPhone =
    mode !== "email" && phoneLocal.trim()
      ? phoneLocal.trim().startsWith("+")
        ? phoneLocal.trim()
        : `${dialCode} ${phoneLocal.trim()}`
      : "";

  const composedEmail = mode !== "phone" ? email.trim() : "";

  const activeQuery = composedPhone || composedEmail || alias.trim();
  const visibleMatches = activeQuery.length >= 3 ? matches : [];

  // Live lookup as user types phone or email
  useEffect(() => {
    if (!open || activeQuery.length < 3) return;
    const timer = setTimeout(() => {
      lookupContacts(activeQuery)
        .then((res) => setMatches(res.matches))
        .catch(() => setMatches([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [open, activeQuery]);

  const resetAndClose = () => {
    setPhoneLocal("");
    setEmail("");
    setAlias("");
    setInitialMessage("");
    setMatches([]);
    setSelectedUser(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await addContactApi({
        alias: alias.trim() || selectedUser?.name || undefined,
        phone: composedPhone || selectedUser?.phone || undefined,
        email: composedEmail || selectedUser?.email || undefined,
        targetUserId: selectedUser?.id,
        initialMessage: initialMessage.trim() || undefined,
      });
      onCreated(result);
      resetAndClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo agregar el contacto"
      );
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-[#131728] border border-white/15 shadow-2xl overflow-hidden"
          >
            {/* Gradient Top Header */}
            <div className="relative p-5 bg-gradient-to-r from-indigo-600/25 via-violet-600/20 to-emerald-500/20 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Chatear por Número o Correo
                  </h3>
                  <p className="text-xs text-slate-300">
                    Agrega un número tipo WhatsApp y/o un email para chatear ya
                  </p>
                </div>
              </div>
              <button
                onClick={resetAndClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Mode Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0b0d14] border border-white/[0.07]">
                {(
                  [
                    { id: "both", label: "Número + Correo" },
                    { id: "phone", label: "📱 Solo Número" },
                    { id: "email", label: "✉️ Solo Correo" },
                  ] as const
                ).map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => {
                      setMode(tab.id);
                      setSelectedUser(null);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      mode === tab.id
                        ? "bg-indigo-500/25 text-white border border-indigo-400/35"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Phone Input (WhatsApp style) */}
              {mode !== "email" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    Número de teléfono (estilo WhatsApp)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={dialCode}
                      onChange={(e) => setDialCode(e.target.value)}
                      className="bg-[#0b0d14] border border-white/10 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400/60"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phoneLocal}
                      onChange={(e) => {
                        setPhoneLocal(e.target.value);
                        setSelectedUser(null);
                      }}
                      placeholder="9 11 2345-6789"
                      className="flex-1 bg-[#0b0d14] border border-white/10 focus:border-emerald-400/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Email Input */}
              {mode !== "phone" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSelectedUser(null);
                    }}
                    placeholder="persona@ejemplo.com"
                    className="w-full bg-[#0b0d14] border border-white/10 focus:border-sky-400/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                  />
                </div>
              )}

              {/* Live Matches Found in Comunicate */}
              <AnimatePresence>
                {visibleMatches.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Coincidencias encontradas en Comunicate:
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {visibleMatches.map((u) => {
                        const isPicked = selectedUser?.id === u.id;
                        return (
                          <button
                            type="button"
                            key={u.id}
                            onClick={() => {
                              setSelectedUser(u);
                              if (!alias) setAlias(u.name);
                            }}
                            className={`w-full p-2 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                              isPicked
                                ? "bg-indigo-500/25 border-indigo-400/60"
                                : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar user={u} size="sm" />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">
                                  {u.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {[u.phone, u.email].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            </div>
                            {isPicked && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Alias + Optional Initial Message */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Nombre para agendar (opcional)
                  </label>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Ej. Carlos Trabajo"
                    className="w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <MessageSquarePlus className="w-3 h-3 text-indigo-400" />
                    Primer mensaje (opcional)
                  </label>
                  <input
                    type="text"
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="¡Hola! Te escribo por aquí 👋"
                    className="w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={loading}
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 cursor-pointer"
                >
                  {loading
                    ? "Abriendo chat..."
                    : initialMessage.trim()
                    ? "Agregar y Enviar Mensaje"
                    : "Guardar y Abrir Chat"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
