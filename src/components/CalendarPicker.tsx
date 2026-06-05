"use client";

import React, { useState, useEffect } from "react";

interface Slot {
  time: string;
}

interface CalendarPickerProps {
  onBookingSuccess: (details: string) => void;
}

export default function CalendarPicker({ onBookingSuccess }: CalendarPickerProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookedDetails, setBookedDetails] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      try {
        const res = await fetch("/api/calendar/slots");
        if (!res.ok) throw new Error("Failed to load slots");
        const data = await res.json();
        setSlots(data.slots || []);
      } catch (err) {
        console.error("Error loading slots:", err);
        setError("Could not load slots. You can still book manually.");
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, []);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !name || !email) return;

    setBooking(true);
    setError(null);

    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: selectedSlot,
          name,
          email,
          notes: notes || "Chat session with Tushar's AI Persona",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Booking failed");
      }

      setBookedDetails(data.booking);
      const timeStr = new Date(selectedSlot).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      onBookingSuccess(`Successfully booked an interview for ${timeStr}!`);
    } catch (err: any) {
      console.error("Error booking meeting:", err);
      setError(err.message || "Failed to complete the booking. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const calComUrl = process.env.NEXT_PUBLIC_CALCOM_URL || "https://cal.com/tushar-agrawal";

  if (bookedDetails) {
    const formattedTime = new Date(selectedSlot!).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <div className="glass-card" style={{ padding: "20px", marginTop: "10px", borderColor: "var(--success)" }}>
        <h3 style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
          ✅ Interview Confirmed!
        </h3>
        <p style={{ margin: "10px 0 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Your meeting is scheduled for <strong>{formattedTime}</strong>. A calendar invite has been sent to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: "20px", marginTop: "10px" }}>
      <h3 style={{ margin: "0 0 15px 0", fontSize: "1.1rem", color: "var(--text-primary)" }}>
        📅 Schedule a Chat / Interview
      </h3>

      {loading && (
        <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Loading available slots...
        </div>
      )}

      {error && (
        <div style={{ marginBottom: "15px" }}>
          <p style={{ color: "var(--error)", fontSize: "0.9rem", margin: "0 0 10px 0" }}>{error}</p>
          <a
            href={calComUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
          >
            Book via Cal.com
          </a>
        </div>
      )}

      {!loading && !error && slots.length === 0 && !selectedSlot && (
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 10px 0" }}>
            No automated slots available right now.
          </p>
          <a
            href={calComUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
          >
            Check Cal.com Profile
          </a>
        </div>
      )}

      {!loading && !error && slots.length > 0 && !selectedSlot && (
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 12px 0" }}>
            Select one of the upcoming available times:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
            {slots.map((slot) => {
              const date = new Date(slot.time);
              const label = date.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <button
                  key={slot.time}
                  onClick={() => setSelectedSlot(slot.time)}
                  className="slot-badge"
                  style={{ border: "none", outline: "none", width: "100%" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: "15px", textAlign: "right" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              or book directly on <a href={calComUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-light)" }}>Cal.com</a>
            </span>
          </div>
        </div>
      )}

      {selectedSlot && !bookedDetails && (
        <form onSubmit={handleBook} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Selected Time:</span>
            <div style={{ fontWeight: 600, color: "var(--accent-light)", fontSize: "1rem", marginTop: "2px" }}>
              {new Date(selectedSlot).toLocaleString(undefined, {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>Your Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hiring Manager / Recruiter"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>Your Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Chat about internship / scaling role at Scaler"
              rows={2}
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "var(--text-primary)",
                outline: "none",
                resize: "none",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
            <button
              type="submit"
              disabled={booking}
              className="btn-primary"
              style={{ flex: 1, justifyContent: "center", fontSize: "0.9rem" }}
            >
              {booking ? "Booking..." : "Confirm Booking"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedSlot(null)}
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: "0.9rem" }}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
