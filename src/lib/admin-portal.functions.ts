import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function clientIp(): string {
  try {
    const request = getRequest();
    return (
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

export const adminPortalLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username?: string; password?: string }) => ({
    username: String(input?.username ?? "").trim().slice(0, 64),
    password: String(input?.password ?? "").slice(0, 128),
  }))
  .handler(async ({ data }) => {
    const { signInAdmin } = await import("./admin-portal.server");
    if (!data.username || !data.password) return { ok: false as const };
    const ok = await signInAdmin(data.username, data.password, clientIp());
    return { ok };
  });

export const adminPortalLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { signOutAdmin } = await import("./admin-portal.server");
  await signOutAdmin();
  return { ok: true as const };
});

export const adminPortalStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdminSession } = await import("./admin-portal.server");
  return { signedIn: await isAdminSession() };
});
