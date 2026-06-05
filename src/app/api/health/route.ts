import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    persona: "Tushar Agrawal",
    timestamp: new Date().toISOString(),
  });
}
