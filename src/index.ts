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

class AppError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

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

type LogLevel = "info" | "warn" | "error";
function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()}: ${msg}`;
  meta ? console.log(base, meta) : console.log(base);
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new AppError(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function fetchUserFromApi(id: number): Promise<unknown> {
  await delay(120);
  return { id, name: "Sarath" }; // simulate API JSON
}

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new AppError(`Invalid ${name}: ${raw}`);
  return n;
}

async function main(): Promise<void> {
  const userId = getEnvNumber("USER_ID", 1);
  log("info", "Starting script", { userId });

  const raw = await withTimeout(fetchUserFromApi(userId), 500);

  if (!isUser(raw)) throw new AppError("API returned invalid user shape", raw);

  log("info", greet(raw));
  log("info", "2 + 3 =", { result: sum(2, 3) });

  await delay(200);
  log("info", "Async works ✅");

  log("info", "Done");
}

main().catch((err) => {
  log("error", "Unhandled error", {
    name: err instanceof Error ? err.name : "Unknown",
    message: err instanceof Error ? err.message : String(err),
    cause: err instanceof AppError ? err.cause : undefined,
  });
  // process.exitCode = 1;
});
