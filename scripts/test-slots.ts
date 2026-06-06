import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAvailableSlots } from "../src/lib/calendar/calcom";

async function main() {
  console.log("CALCOM_EVENT_TYPE_ID:", process.env.CALCOM_EVENT_TYPE_ID);
  const slots = await getAvailableSlots(7);
  console.log("Slots returned:", JSON.stringify(slots, null, 2));
}

main().catch(console.error);
