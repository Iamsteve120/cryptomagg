/**
 * Transactional email over the project's own SMTP host. Server only.
 *
 * Runs a minimal SMTP conversation over an implicit TLS socket (port 465), which
 * works both in the deployed edge runtime and in local development. Sending is
 * best effort: a failed email is logged and never breaks a payment, and no
 * credential is ever returned to the caller.
 */

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

export function readSmtpConfig(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const password = process.env["SMTP_PASS"] ?? process.env["SMTP_PASSWORD"];
  if (!host || !user || !password) return null;
  const port = Number(process.env["SMTP_PORT"] ?? 465);
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    user,
    password,
    from: process.env["SMTP_FROM"] ?? user,
  };
}

type Duplex = {
  write: (text: string) => Promise<void>;
  read: () => Promise<string>;
  close: () => Promise<void>;
};

async function openTlsSocket(host: string, port: number): Promise<Duplex> {
  try {
    const specifier = "cloudflare:sockets";
    const { connect } = (await import(/* @vite-ignore */ specifier)) as {
      connect: (
        address: { hostname: string; port: number },
        options?: { secureTransport?: string },
      ) => {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        close: () => Promise<void>;
      };
    };
    const socket = connect({ hostname: host, port }, { secureTransport: "on" });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    return {
      write: async (text) => {
        await writer.write(encoder.encode(text));
      },
      read: async () => {
        const chunk = await reader.read();
        return chunk.value ? decoder.decode(chunk.value) : "";
      },
      close: async () => {
        try {
          await writer.close();
        } catch {
          /* already closed */
        }
        await socket.close();
      },
    };
  } catch {
    // Local development runs on Node, which has no cloudflare:sockets module.
    const tls = await import("node:tls");
    const socket = tls.connect({ host, port, servername: host });
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => resolve());
      socket.once("error", reject);
    });
    const queue: string[] = [];
    let waiting: ((value: string) => void) | null = null;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve(chunk);
      } else {
        queue.push(chunk);
      }
    });
    return {
      write: async (text) => {
        await new Promise<void>((resolve, reject) => {
          socket.write(text, (error) => (error ? reject(error) : resolve()));
        });
      },
      read: () =>
        new Promise<string>((resolve) => {
          const next = queue.shift();
          if (next !== undefined) resolve(next);
          else waiting = resolve;
        }),
      close: async () => {
        socket.end();
      },
    };
  }
}

async function expect(socket: Duplex, codes: string[]): Promise<void> {
  const deadline = Date.now() + 15_000;
  let buffer = "";
  while (Date.now() < deadline) {
    buffer += await socket.read();
    const lines = buffer.trimEnd().split(/\r?\n/);
    const last = lines[lines.length - 1] ?? "";
    // A final reply line has a space after the code; a dash means more follows.
    if (/^\d{3} /.test(last)) {
      if (codes.some((code) => last.startsWith(code))) return;
      throw new Error(`smtp_unexpected_reply:${last.slice(0, 60)}`);
    }
  }
  throw new Error("smtp_timeout");
}

function base64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 200);
}

/** Sends one plain text email. Resolves false when sending was not possible. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const config = readSmtpConfig();
  if (!config) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) return false;

  let socket: Duplex | null = null;
  try {
    socket = await openTlsSocket(config.host, config.port);
    await expect(socket, ["220"]);
    await socket.write(`EHLO ${config.host}\r\n`);
    await expect(socket, ["250"]);
    await socket.write("AUTH LOGIN\r\n");
    await expect(socket, ["334"]);
    await socket.write(`${base64(config.user)}\r\n`);
    await expect(socket, ["334"]);
    await socket.write(`${base64(config.password)}\r\n`);
    await expect(socket, ["235"]);
    await socket.write(`MAIL FROM:<${config.from}>\r\n`);
    await expect(socket, ["250"]);
    await socket.write(`RCPT TO:<${input.to}>\r\n`);
    await expect(socket, ["250", "251"]);
    await socket.write("DATA\r\n");
    await expect(socket, ["354"]);

    const body = input.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    const message = [
      `From: CryptoMagg <${config.from}>`,
      `To: <${input.to}>`,
      `Subject: ${headerSafe(input.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      body,
      ".",
      "",
    ].join("\r\n");
    await socket.write(message);
    await expect(socket, ["250"]);
    await socket.write("QUIT\r\n");
    return true;
  } catch (error) {
    console.error("Email send failed", error instanceof Error ? error.message : "unknown");
    return false;
  } finally {
    if (socket) await socket.close().catch(() => undefined);
  }
}

const money = (value: number) => value.toFixed(2);

export async function sendDepositReceipt(input: {
  to: string;
  name?: string | null;
  amountUsdt: number;
  amountKes: number;
  receipt: string;
  balanceUsdt: number;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `Deposit received: ${money(input.amountUsdt)} USDT`,
    text: [
      `Hello ${input.name?.split(" ")[0] ?? "there"},`,
      "",
      `Your M Pesa payment of KES ${Math.round(input.amountKes)} has been received and your real account has been credited with ${money(input.amountUsdt)} USDT.`,
      `M Pesa receipt: ${input.receipt}`,
      `Available balance: ${money(input.balanceUsdt)} USDT`,
      "",
      "Trading carries risk. Only trade money you can afford to lose.",
      "",
      "CryptoMagg",
    ].join("\n"),
  });
}

export async function sendWithdrawalReceipt(input: {
  to: string;
  name?: string | null;
  amountUsdt: number;
  phone: string;
  status: "pending" | "completed" | "failed";
}): Promise<void> {
  const pending = input.status === "pending";
  const failed = input.status === "failed";
  await sendEmail({
    to: input.to,
    subject: failed
      ? `Withdrawal could not be sent: ${money(input.amountUsdt)} USDT`
      : pending
        ? `Withdrawal request received: ${money(input.amountUsdt)} USDT`
        : `Withdrawal sent: ${money(input.amountUsdt)} USDT`,
    text: [
      `Hello ${input.name?.split(" ")[0] ?? "there"},`,
      "",
      failed
        ? `Your withdrawal of ${money(input.amountUsdt)} USDT to ${input.phone} could not be sent, and the full amount has been returned to your balance. Please try again.`
        : pending
          ? `We have received your withdrawal request for ${money(input.amountUsdt)} USDT to ${input.phone}. The amount has been held from your balance and will be paid out to M Pesa once it clears review.`
          : `Your withdrawal of ${money(input.amountUsdt)} USDT has been sent to ${input.phone} via M Pesa.`,
      "",
      "If you did not request this, reply to this email immediately.",
      "",
      "CryptoMagg",
    ].join("\n"),
  });
}
