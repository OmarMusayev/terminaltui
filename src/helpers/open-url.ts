import { spawn } from "node:child_process";

/**
 * Open a URL in the user's default browser.
 *
 * Uses spawn with array args (no shell) so URLs are not interpolated into
 * a command line — guards against shell-injection from attacker-controlled
 * URLs.
 */
export function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === "darwin") {
      cmd = "open";
      args = [url];
    } else if (platform === "win32") {
      // start needs an empty title arg before the URL
      cmd = "cmd";
      args = ["/c", "start", "", url];
    } else {
      cmd = "xdg-open";
      args = [url];
    }

    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    child.on("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
