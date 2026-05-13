import { getDiskInfo } from "../lib/system.js";

export async function GET() {
  return getDiskInfo();
}
