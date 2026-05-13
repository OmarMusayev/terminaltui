import { getProcesses } from "../lib/system.js";

export async function GET() {
  return {
    processes: getProcesses("cpu", 50),
  };
}
