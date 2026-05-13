import { getCpuInfo, getMemoryInfo, getDiskInfo, getNetworkInfo, getBatteryInfo, getGpuInfo, getSystemInfo } from "../lib/system.js";

export async function GET() {
  return {
    system: getSystemInfo(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    network: getNetworkInfo(),
    battery: getBatteryInfo(),
    gpu: getGpuInfo(),
  };
}
