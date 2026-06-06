import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function updateToolUrl(toolId: string, newUrl: string) {
  const res = await fetch(`https://api.vapi.ai/tool/${toolId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: newUrl,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update tool ${toolId}: ${res.status} ${await res.text()}`);
  }

  console.log(`✅ Updated tool ${toolId} to URL: ${newUrl}`);
}

async function main() {
  const tools = [
    { id: "24d7de07-f86c-4d0c-b32a-1770da8b24f3", name: "book_meeting" },
    { id: "43d00ecf-9c74-4b8c-9e85-219ab1581ab6", name: "get_calendar_slots" },
    { id: "97880875-02b5-426a-b02f-f07743d2fce4", name: "knowledge_lookup" }
  ];

  for (const t of tools) {
    const newUrl = `https://echo-umber-seven.vercel.app/api/vapi?tool=${t.name}`;
    await updateToolUrl(t.id, newUrl);
  }
}

main().catch(console.error);
