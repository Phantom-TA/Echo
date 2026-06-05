import dotenv from "dotenv";
import path from "path";

// Load local env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testEndpoints() {
  console.log("⏳ Testing calendar slots endpoint (/api/calendar/slots)...");
  try {
    const slotsRes = await fetch("http://localhost:3002/api/calendar/slots");
    console.log(`Slots API Status: ${slotsRes.status}`);
    const slotsData = await slotsRes.json();
    console.log("Slots Data Received:", JSON.stringify(slotsData, null, 2).slice(0, 500));
  } catch (error: any) {
    console.error("❌ Slots endpoint test failed:", error.message);
  }

  console.log("\n⏳ Testing chat endpoint (/api/chat) with streaming query...");
  try {
    const chatRes = await fetch("http://localhost:3002/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Tell me about IntentSync." }
        ]
      })
    });

    console.log(`Chat API Status: ${chatRes.status}`);
    if (!chatRes.ok) {
      console.error("Chat request failed:", await chatRes.text());
      return;
    }

    const reader = chatRes.body?.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let result = "";

    if (reader) {
      console.log("Streaming response from AI representative:");
      console.log("─".repeat(50));
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          result += chunk;
          process.stdout.write(chunk);
        }
      }
      console.log("\n" + "─".repeat(50));
      console.log("✅ Chat Streaming Completed successfully!");
    } else {
      console.log("Chat body is null");
    }
  } catch (error: any) {
    console.error("❌ Chat endpoint test failed:", error.message);
  }
}

testEndpoints();
