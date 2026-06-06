import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { bookMeeting } from "../src/lib/calendar/calcom";

async function main() {
  const result = await bookMeeting({
    startTime: "2026-06-09T00:00:00.000+05:30",
    name: "Tushar Verification",
    email: "tushar.verif.test@gmail.com",
    notes: "Testing Cal.com API v2 booking"
  });

  console.log("Booking Result:", result);
}

main().catch(console.error);
