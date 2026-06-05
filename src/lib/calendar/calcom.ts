/**
 * Cal.com API v2 Wrapper
 *
 * Handles fetching available slots and booking meetings.
 * Requires CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID in .env.local.
 */

const CALCOM_BASE = "https://api.cal.com/v2";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
    "Content-Type": "application/json",
    "cal-api-version": "2024-08-13",
  };
}

export interface CalSlot {
  time: string; // ISO 8601
}

export interface CalBookingResult {
  id: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: Array<{ name: string; email: string }>;
}

/**
 * Fetch available time slots for the next N days.
 */
export async function getAvailableSlots(
  daysAhead = 7
): Promise<CalSlot[]> {
  if (!process.env.CALCOM_API_KEY || !process.env.CALCOM_EVENT_TYPE_ID) {
    console.warn("Cal.com credentials not configured — returning empty slots.");
    return [];
  }

  const startTime = new Date().toISOString();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);
  const endTime = endDate.toISOString();

  const url = new URL(`${CALCOM_BASE}/slots/available`);
  url.searchParams.set("eventTypeId", process.env.CALCOM_EVENT_TYPE_ID);
  url.searchParams.set("startTime", startTime);
  url.searchParams.set("endTime", endTime);
  url.searchParams.set("timeZone", "Asia/Kolkata");

  const res = await fetch(url.toString(), { headers: getHeaders() });

  if (!res.ok) {
    console.error("Cal.com slots error:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  // data.data.slots is a Record<date, CalSlot[]>
  const slotsByDay: Record<string, CalSlot[]> = data?.data?.slots ?? {};
  return Object.values(slotsByDay).flat().slice(0, 10); // return max 10 slots
}

/**
 * Book a meeting on Cal.com.
 */
export async function bookMeeting(params: {
  startTime: string;
  name: string;
  email: string;
  notes?: string;
}): Promise<CalBookingResult | null> {
  if (!process.env.CALCOM_API_KEY || !process.env.CALCOM_EVENT_TYPE_ID) {
    console.warn("Cal.com credentials not configured — cannot book.");
    return null;
  }

  const res = await fetch(`${CALCOM_BASE}/bookings`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      eventTypeId: Number(process.env.CALCOM_EVENT_TYPE_ID),
      start: params.startTime,
      attendee: {
        name: params.name,
        email: params.email,
        timeZone: "Asia/Kolkata",
      },
      metadata: {
        notes: params.notes ?? "Booked via Tushar's AI Persona",
      },
    }),
  });

  if (!res.ok) {
    console.error("Cal.com booking error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data?.data ?? null;
}
