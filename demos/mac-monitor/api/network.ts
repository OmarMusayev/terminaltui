import { getNetworkInfo } from "../lib/system.js";

export async function GET() {
  return getNetworkInfo();
}
