// Safe subprocess execution — the ONLY place in this worker allowed to spawn
// a child process. Always argument arrays, never a shell string. Callers
// must validate any user-derived value (video ID) with assertValidVideoId()
// BEFORE it reaches these functions; these functions add no validation of
// their own beyond refusing empty argv, by design — the trust boundary is
// video-id.mjs, not here.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** @param {string} command @param {string[]} args @param {{timeoutMs?: number, maxBufferBytes?: number}} [opts] */
export async function runCommand(command, args, opts = {}) {
  if (!Array.isArray(args)) throw new TypeError("args must be an array — never a shell string");
  const { timeoutMs = 30_000, maxBufferBytes = 20 * 1024 * 1024 } = opts;
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: maxBufferBytes,
      // shell:false is the execFile default — stated explicitly, never
      // override it to true anywhere in this codebase.
      shell: false,
    });
    return { stdout, stderr, timedOut: false };
  } catch (err) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(err.message ?? err),
      timedOut: err.killed === true && err.signal === "SIGTERM",
      exitCode: err.code,
      raw: err,
    };
  }
}
