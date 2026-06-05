import dotenv from "dotenv";
import path from "path";

// Load local env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function listEventTypes() {
  const apiKey = process.env.CALCOM_API_KEY;

  if (!apiKey) {
    console.error("❌ No CALCOM_API_KEY found in .env.local");
    return;
  }

  console.log("⏳ Fetching event types from Cal.com API v1 & v2...");
  console.log(`Using Key: ${apiKey.slice(0, 10)}...`);

  // Try API v1 first
  try {
    const url = `https://api.cal.com/v1/event-types?apiKey=${apiKey}`;
    const res = await fetch(url);
    console.log(`v1 API Status: ${res.status}`);
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const eventTypes = data.event_types ?? data.eventTypes ?? [];
      if (eventTypes.length > 0) {
        console.log("\n🎯 Cal.com API v1 - Available Event Types:");
        console.log("─".repeat(50));
        eventTypes.forEach((event: any) => {
          console.log(`• Name: ${event.title}`);
          console.log(`  Slug: ${event.slug}`);
          console.log(`  ID:   ${event.id}`);
          console.log("─".repeat(50));
        });
        return;
      } else {
        console.log("v1 returned ok but empty list:", text);
      }
    } else {
      console.log("v1 response error body:", text);
    }
  } catch (e: any) {
    console.log("Cal.com v1 attempt failed with exception:", e.message);
  }

  // Try API v2
  try {
    const res = await fetch("https://api.cal.com/v2/event-types", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
    });
    console.log(`v2 API Status: ${res.status}`);
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const eventTypes = data?.data?.eventTypes ?? [];
      if (eventTypes.length > 0) {
        console.log("\n🎯 Cal.com API v2 - Available Event Types:");
        console.log("─".repeat(50));
        eventTypes.forEach((event: any) => {
          console.log(`• Name: ${event.title}`);
          console.log(`  Slug: ${event.slug}`);
          console.log(`  ID:   ${event.id}`);
          console.log("─".repeat(50));
        });
        return;
      } else {
        console.log("v2 returned ok but empty list:", text);
      }
    } else {
      console.log("v2 response error body:", text);
    }
  } catch (e: any) {
    console.log("Cal.com v2 attempt failed with exception:", e.message);
  }

  console.log("\n❌ Could not retrieve event types automatically. Please verify your API key.");
}

listEventTypes();
