import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/calendar/calcom";

export const runtime = "nodejs";

export async function GET() {
  try {
    const slots = await getAvailableSlots(7);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("[/api/calendar/slots] Error:", error);
    return NextResponse.json({ slots: [], error: "Failed to fetch slots" }, { status: 500 });
  }
}
