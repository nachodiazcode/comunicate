"use client";

const PRODUCTION_SITE_URL = "https://comunicate-nacho.netlify.app";

export function getShareableOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_SITE_URL;
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.")
  ) {
    return PRODUCTION_SITE_URL;
  }
  return window.location.origin;
}

export function buildInviteUrl(params: {
  name: string;
  phone?: string | null;
  email?: string | null;
  fromName: string;
}): string {
  const base = getShareableOrigin();
  const qs = new URLSearchParams();
  qs.set("name", params.name);
  if (params.phone) qs.set("phone", params.phone);
  if (params.email) qs.set("email", params.email);
  qs.set("from", params.fromName);
  return `${base}/invite?${qs.toString()}`;
}

export function buildInviteMessageText(params: {
  name: string;
  phone?: string | null;
  email?: string | null;
  fromName: string;
}): string {
  const link = buildInviteUrl(params);
  return `¡Hola ${params.name}! 👋 Te invito a chatear conmigo en tiempo real en *Comunicate* ✨. Entra directo a nuestro chat tocando este enlace:\n${link}`;
}

export function buildWhatsAppInviteUrl(params: {
  name: string;
  phone: string;
  email?: string | null;
  fromName: string;
}): string {
  const cleanDigits = params.phone.replace(/[^\d]/g, "");
  const message = buildInviteMessageText(params);
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}

export function buildSmsInviteUrl(params: {
  name: string;
  phone: string;
  fromName: string;
}): string {
  const cleanPhone =
    "+" + params.phone.replace(/[^\d]/g, "");
  const message = buildInviteMessageText(params);
  return `sms:${cleanPhone}?&body=${encodeURIComponent(message)}`;
}
