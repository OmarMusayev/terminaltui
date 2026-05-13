import { getBatteryInfo } from "../lib/system.js";

export async function GET() {
  return getBatteryInfo();
}
