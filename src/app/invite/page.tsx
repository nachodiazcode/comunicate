"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Mail, MessageCircle, Phone, Sparkles } from "lucide-react";
import { registerAccount } from "@/lib/client/api";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0d14] flex items-center justify-center text-slate-300 text-sm">
          Abriendo invitación...
        </div>
      }
    >
      <InviteCard />
    </Suspense>
  );
}

function InviteCard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialName = searchParams.get("name") || "Invitado";
  const initialPhone = searchParams.get("phone") || "";
  const initialEmail = searchParams.get("email") || "";
  const inviterName = searchParams.get("from") || "Nacho";

  const isFelipe = initialPhone.replace(/[^\d]/g, "") === "56939042370";

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerAccount({
        name: name.trim() || initialName,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        password,
        avatarUrl: isFelipe ? "/avatars/felipe.png" : undefined,
        persistAsDefault: true,
      });
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo abrir tu cuenta"
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full chat-wallpaper-dm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="w-full max-w-md rounded-[32px] bg-[#131728]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden"
      >
        <div className="relative p-7 pb-6 text-center bg-gradient-to-b from-indigo-600/25 via-violet-600/15 to-transparent border-b border-white/10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-300 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Invitación directa a Comunicate</span>
          </div>

          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 ring-4 ring-indigo-500/30 shadow-2xl flex items-center justify-center text-3xl">
            {isFelipe ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/avatars/felipe.png"
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <MessageCircle className="w-10 h-10 text-white" />
            )}
          </div>

          <h1 className="mt-4 text-xl font-bold text-white">
            ¡Hola {name || "amigo"}! 👋
          </h1>
          <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
            <strong className="text-indigo-300">{inviterName}</strong> te invitó
            a chatear en tiempo real en <strong>Comunicate</strong>. Tus
            mensajes ya te están esperando adentro.
          </p>
        </div>

        <form onSubmit={handleJoin} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">
              Tu nombre en el chat
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              Tu número vinculado
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+56 9 3904 2370"
              className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              Correo electrónico (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-sky-400 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 text-white text-sm font-bold shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <span>
              {loading
                ? "Abriendo chat en vivo..."
                : `Entrar al chat con ${inviterName}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
