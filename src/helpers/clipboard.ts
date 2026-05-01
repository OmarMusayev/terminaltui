import { spawn } from "node:child_process";

export function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === "darwin") {
      cmd = "pbcopy";
      args = [];
    } else if (platform === "win32") {
      cmd = "clip";
      args = [];
    } else {
      cmd = "xclip";
      args = ["-selection", "clipboard"];
    }

    const proc = spawn(cmd, args);
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    proc.stdin.write(text);
    proc.stdin.end();
  });
}
