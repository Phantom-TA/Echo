import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const callId = "019e9d2c-81b2-711e-ac95-7a288bc08126";
  const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  console.log("Top-level keys:", Object.keys(data));
  console.log("Messages sample:", data.messages?.slice(0, 5));
}

main().catch(console.error);
