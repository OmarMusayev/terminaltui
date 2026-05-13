import { getCpuInfo, getProcesses } from "../lib/system.js";

export async function GET() {
  return {
    ...getCpuInfo(),
    topProcesses: getProcesses("cpu", 10),
  };
}
