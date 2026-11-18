"use client";

import { useState } from "react";
import { Lock, LogIn, Mail, Phone, UserPlus } from "lucide-react";
import { loginAccount, registerAccount } from "@/lib/client/api";

const AVATARS = ["⚡", "🎸", "🎧", "✨", "🌙", "🔥"];

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [emoji, setEmoji] = useState(AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await loginAccount({ identifier: identifier.trim(), password });
      } else {
        const value = identifier.trim();
        const isEmail = value.includes("@");
        await registerAccount({
          name: name.trim(),
          email: isEmail ? value : undefined,
          phone: isEmail ? undefined : value,
          password,
          avatarEmoji: emoji,
          persistAsDefault: true,
        });
      }
      await onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-[#0b0d14] flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-[#131728] border border-white/10 shadow-2xl p-6 space-y-4"
      >
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/30">
            💬
          </div>
          <h1 className="text-xl font-bold text-white">Comunicate</h1>
          <p className="text-xs text-slate-400">
            Entra con tu teléfono o correo. Los contactos de prueba ya no están.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#0b0d14] border border-white/[0.07]">
          {(
            [
              { id: "login", label: "Ingresar" },
              { id: "register", label: "Crear cuenta" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setError(null);
              }}
              className={`py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                mode === tab.id
                  ? "bg-indigo-500/25 text-white border border-indigo-400/35"
                  : "text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <>
            <div className="flex justify-center gap-2">
              {AVATARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  className={`w-10 h-10 rounded-full bg-[#0b0d14] text-lg cursor-pointer ${
                    emoji === item ? "ring-2 ring-white" : "opacity-60"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="block text-xs text-slate-300">
              Tu nombre
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
                className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </label>
          </>
        )}

        <label className="block text-xs text-slate-300">
          <span className="inline-flex items-center gap-1">
            {identifier.includes("@") ? (
              <Mail className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
            )}
            Teléfono o correo
          </span>
          <input
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="ignaciosergiodiaz@gmail.com o +56 9..."
            autoComplete="username"
            className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
          />
        </label>

        <label className="block text-xs text-slate-300">
          <span className="inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-indigo-300" />
            Contraseña
          </span>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="mt-1 w-full bg-[#0b0d14] border border-white/10 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
          />
        </label>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {mode === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {loading ? "Un momento..." : mode === "login" ? "Entrar" : "Crear cuenta y entrar"}
        </button>
      </form>
    </div>
  );
}
