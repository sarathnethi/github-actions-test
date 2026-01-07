type User = {
  id: number;
  name: string;
};

function greet(user: User): string {
  return `Hello, ${user.name} (id=${user.id})`;
}

function sum(a: number, b: number): number {
  return a + b;
}

/** ---------- Errors & Assertions ---------- */
class AppError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

function assert(condition: unknown, message: string, cause?: unknown): asserts condition {
  if (!condition) throw new AppError(message, cause);
}

/** ---------- Type guards / Validation ---------- */
function isUser(x: unknown): x is User {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    "name" in x &&
    typeof (x as any).id === "number" &&
    typeof (x as any).name === "string"
  );
}

/** More informative validation than isUser (useful for logs/UI) */
function validateUser(x: unknown): { ok: true; value: User } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof x !== "object" || x === null) errors.push("Not an object");
  else {
    if (!("id" in x)) errors.push("Missing field: id");
    if (!("name" in x)) errors.push("Missing field: name");
    if ("id" in x && typeof (x as any).id !== "number") errors.push("id must be a number");
    if ("name" in x && typeof (x as any).name !== "string") errors.push("name must be a string");
  }

  return errors.length === 0 ? { ok: true, value: x as User } : { ok: false, errors };
}

/** ---------- Logging ---------- */
type LogLevel = "info" | "warn" | "error";
function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()}: ${msg}`;
  meta ? console.log(base, meta) : console.log(base);
}

/** ---------- Small utilities ---------- */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function safeJsonParse<T = unknown>(text: string): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error };
  }
}

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new AppError(`Invalid ${name}: ${raw}`);
  return n;
}

/** Returns unique items by a key selector */
function uniqueBy<T, K>(items: T[], key: (t: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Split into chunks */
function chunk<T>(items: T[], size: number): T[][] {
  assert(Number.isInteger(size) && size > 0, "chunk size must be a positive integer", { size });
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** ---------- User helpers ---------- */
function formatUser(user: User): string {
  return `${user.name} (#${user.id})`;
}

function cloneUser(user: User): User {
  return { ...user };
}

function updateUserName(user: User, newName: string): User {
  assert(newName.trim().length > 0, "Name cannot be empty");
  return { ...user, name: newName.trim() };
}

function compareUsersByName(a: User, b: User): number {
  return a.name.localeCompare(b.name);
}

/** ---------- Async helpers ---------- */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new AppError(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function retry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; delayMs?: number; onRetry?: (info: { attempt: number; error: unknown }) => void }
): Promise<T> {
  const { attempts, delayMs = 0, onRetry } = opts;
  assert(attempts >= 1, "attempts must be >= 1", opts);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        onRetry?.({ attempt, error: err });
        if (delayMs > 0) await delay(delayMs);
      }
    }
  }
  throw new AppError(`Failed after ${attempts} attempts`, lastErr);
}

async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log("info", `${label} completed`, { ms: Date.now() - start });
    return result;
  } catch (err) {
    log("error", `${label} failed`, { ms: Date.now() - start });
    throw err;
  }
}

/** ---------- Fake API ---------- */
async function fetchUserFromApi(id: number): Promise<unknown> {
  await delay(120);
  return { id, name: "Sarath" }; // simulate API JSON
}

/** ---------- Main ---------- */
async function main(): Promise<void> {
  const userId = getEnvNumber("USER_ID", 1);
  log("info", "Starting script", { userId });

  const raw = await measureAsync("fetchUserFromApi", () =>
    withTimeout(
      retry(() => fetchUserFromApi(userId), {
        attempts: 3,
        delayMs: 50,
        onRetry: ({ attempt, error }) => log("warn", "Retrying fetch", { attempt, error }),
      }),
      500
    )
  );

  const validated = validateUser(raw);
  if (!validated.ok) throw new AppError("API returned invalid user shape", { errors: validated.errors, raw });

  const user = validated.value;

  log("info", greet(user));
  log("info", "Formatted user", { user: formatUser(user) });
  log("info", "2 + 3 =", { result: sum(2, 3) });

  const renamed = updateUserName(user, "Sarath Chandra");
  log("info", "Renamed user", { before: cloneUser(user), after: renamed });

  const users: User[] = [
    user,
    renamed,
    { id: 2, name: "Anu" },
    { id: 2, name: "Anu (duplicate id)" },
  ];

  const uniqueUsers = uniqueBy(users, (u) => u.id).sort(compareUsersByName);
  log("info", "Unique users (by id), sorted by name", { users: uniqueUsers.map(formatUser) });

  log("info", "Chunked users (size=2)", { chunks: chunk(uniqueUsers, 2).map((c) => c.map(formatUser)) });

  // JSON parse demo
  const parsed = safeJsonParse('{"id":99,"name":"Demo"}');
  log("info", "safeJsonParse demo", parsed.ok ? { value: parsed.value } : { error: parsed.error });

  await delay(200);
  log("info", "Async works ✅");

  log("info", "Done");
}

// Execute main
// eslint-disable-next-line no-console 

main().catch((err) => {
  log("error", "Unhandled error", {
    name: err instanceof Error ? err.name : "Unknown",
    message: err instanceof Error ? err.message : String(err),
    cause: err instanceof AppError ? err.cause : undefined,
  });
  // process.exitCode = 1;
});
