import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function getTool(toolId: string) {
  const res = await fetch(`https://api.vapi.ai/tool/${toolId}`, {
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

async function main() {
  const toolIds = [
    "24d7de07-f86c-4d0c-b32a-1770da8b24f3",
    "43d00ecf-9c74-4b8c-9e85-219ab1581ab6",
    "97880875-02b5-426a-b02f-f07743d2fce4"
  ];

  for (const id of toolIds) {
    console.log(`\n=== Tool ${id} ===`);
    const tool = await getTool(id);
    console.log(JSON.stringify(tool, null, 2));
  }
}

main().catch(console.error);
