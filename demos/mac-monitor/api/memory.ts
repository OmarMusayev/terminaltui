import { getMemoryInfo, getProcesses } from "../lib/system.js";

export async function GET() {
  return {
    ...getMemoryInfo(),
    topProcesses: getProcesses("mem", 10),
  };
}
