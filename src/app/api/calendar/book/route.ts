import { NextResponse } from "next/server";
import { bookMeeting } from "@/lib/calendar/calcom";
import { z } from "zod";

export const runtime = "nodejs";

const BookingSchema = z.object({
  startTime: z.string().datetime({ offset: true, message: "startTime must be a valid ISO 8601 datetime" }),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid booking data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const booking = await bookMeeting(parsed.data);

    if (!booking) {
      return NextResponse.json(
        { error: "Failed to create booking. Please try again or book directly at cal.com/tushar-agrawal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error("[/api/calendar/book] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
