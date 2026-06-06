import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const callId = "019e9cdb-d990-7445-b48b-44289d92a383";
  const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
