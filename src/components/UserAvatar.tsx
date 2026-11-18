"use client";

import type { PresenceStatus, User } from "@/types/chat";

const STATUS_STYLES: Record<PresenceStatus, string> = {
  online: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]",
  idle: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  dnd: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.65)]",
  offline: "bg-slate-500",
};

interface UserAvatarProps {
  user: Pick<
    User,
    | "name"
    | "avatarColor"
    | "avatarEmoji"
    | "avatarUrl"
    | "status"
    | "isBot"
    | "isPlaceholder"
  >;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  speaking?: boolean;
}

export function UserAvatar({
  user,
  size = "md",
  showStatus = true,
  speaking = false,
}: UserAvatarProps) {
  const sizeClasses = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-2xl",
  }[size];

  const dotClasses = {
    xs: "w-2 h-2 -bottom-0.5 -right-0.5 border",
    sm: "w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2",
    md: "w-3 h-3 -bottom-0.5 -right-0.5 border-2",
    lg: "w-3.5 h-3.5 bottom-0 right-0 border-2",
    xl: "w-4 h-4 bottom-0.5 right-0.5 border-2",
  }[size];

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {speaking && (
        <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-speaking-ring pointer-events-none" />
      )}
      <div
        className={`${sizeClasses} rounded-full overflow-hidden bg-gradient-to-br ${user.avatarColor} flex items-center justify-center font-semibold text-white shadow-md ring-1 ring-white/15 select-none ${
          speaking ? "ring-2 ring-emerald-400" : ""
        }`}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{user.avatarEmoji || initials}</span>
        )}
      </div>
      {showStatus && (
        <span
          className={`absolute rounded-full border-[#111420] ${dotClasses} ${
            STATUS_STYLES[user.status] || STATUS_STYLES.offline
          }`}
          title={
            user.isPlaceholder
              ? "Invitado pendiente de unirse"
              : `Estado: ${user.status}`
          }
        />
      )}
    </div>
  );
}
