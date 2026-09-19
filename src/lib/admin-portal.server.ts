import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type PortalSession = { admin?: boolean; at?: number };

function sessionConfig() {
  const password = process.env["ADMIN_SESSION_SECRET"];
  if (!password) throw new Error("Admin portal is not configured.");
  return {
    password,
    name: "cm-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function matches(input: string, expected: string) {
  return timingSafeEqual(digest(input), digest(expected));
}

/** Simple in-memory throttle so the login form cannot be brute forced. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;

function throttle(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export async function signInAdmin(username: string, password: string, ip: string) {
  if (!throttle(ip)) return false;
  const expectedUser = process.env["ADMIN_PORTAL_USERNAME"];
  const expectedPass = process.env["ADMIN_PORTAL_PASSWORD"];
  if (!expectedUser || !expectedPass) throw new Error("Admin portal is not configured.");
  if (!matches(username, expectedUser) || !matches(password, expectedPass)) return false;
  const session = await useSession<PortalSession>(sessionConfig());
  await session.update({ admin: true, at: Date.now() });
  attempts.delete(ip);
  return true;
}

export async function signOutAdmin() {
  const session = await useSession<PortalSession>(sessionConfig());
  await session.clear();
}

export async function isAdminSession() {
  const session = await useSession<PortalSession>(sessionConfig());
  return session.data.admin === true;
}

/** Throws for anyone without a valid portal session, then hands back admin db access. */
export async function requireAdminSession() {
  if (!(await isAdminSession())) throw new Error("Not signed in.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
