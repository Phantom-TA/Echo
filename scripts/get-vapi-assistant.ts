import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const assistantId = "cac873d9-78f1-4f15-b9a7-8b30dd7dc059";
  const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
