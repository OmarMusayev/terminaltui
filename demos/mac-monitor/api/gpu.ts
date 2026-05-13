import { getGpuInfo } from "../lib/system.js";

export async function GET() {
  return getGpuInfo();
}
