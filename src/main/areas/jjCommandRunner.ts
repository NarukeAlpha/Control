import { execFile, type ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type JjCommandClass = "passiveRead" | "explicitReadWithSnapshotRisk" | "mutation";

export interface JjCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  commandClass: JjCommandClass;
  touchedWorkingCopy: boolean;
}

export interface JjCommandRunnerOptions {
  timeoutMs?: number;
  executor?: JjCommandExecutor;
}

export type JjCommandExecutor = (
  command: string,
  args: string[],
  options: ExecFileOptions
) => Promise<{ stdout: Buffer | string; stderr: Buffer | string }>;

export class JjCommandRunner {
  constructor(private readonly options: JjCommandRunnerOptions = {}) {}

  async run(cwd: string, args: string[], commandClass: JjCommandClass): Promise<JjCommandResult> {
    if (commandClass !== "passiveRead") {
      throw new Error(`JJ ${commandClass} commands are not allowed from passive refresh.`);
    }

    const startedAt = Date.now();
    const fullArgs = shouldIgnoreWorkingCopy(args) ? ["--ignore-working-copy", ...args] : args;
    const executor = this.options.executor ?? execFileAsync;
    try {
      const { stdout, stderr } = await executor("jj", fullArgs, {
        cwd,
        timeout: this.options.timeoutMs ?? 5_000,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0"
        }
      });
      return {
        stdout: stdout.toString().trim(),
        stderr: stderr.toString().trim(),
        exitCode: 0,
        durationMs: Date.now() - startedAt,
        commandClass,
        touchedWorkingCopy: false
      };
    } catch (error) {
      const execError = error as {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        code?: number;
      };
      return {
        stdout: execError.stdout?.toString().trim() ?? "",
        stderr: execError.stderr?.toString().trim() ?? (error instanceof Error ? error.message : ""),
        exitCode: typeof execError.code === "number" ? execError.code : 1,
        durationMs: Date.now() - startedAt,
        commandClass,
        touchedWorkingCopy: false
      };
    }
  }
}

function shouldIgnoreWorkingCopy(args: string[]): boolean {
  const command = args[0];
  return (
    command === "status" ||
    command === "log" ||
    command === "show" ||
    command === "diff" ||
    command === "interdiff" ||
    command === "bookmark" ||
    command === "tag" ||
    command === "operation" ||
    command === "sparse" ||
    command === "git"
  );
}
