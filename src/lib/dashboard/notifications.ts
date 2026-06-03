import type { DashboardNotification, DashboardRole, RealtimeEvent } from "@/lib/dashboard/types";

export function createDashboardNotification({
  id,
  title,
  body,
  kind = "system",
  createdAt = new Date(),
  readAt = null,
}: Omit<DashboardNotification, "id" | "createdAt"> & {
  id: string;
  createdAt?: Date | string;
}) {
  return {
    id,
    title,
    body,
    kind,
    createdAt,
    readAt,
  };
}

export function notificationFromRealtimeEvent(event: RealtimeEvent, recipientRole: DashboardRole): DashboardNotification | null {
  if (event.actorRole === recipientRole) {
    return null;
  }

  const idParts = [event.type, "appointmentId" in event ? event.appointmentId : "", Date.now().toString()];
  const id = idParts.filter(Boolean).join(":");

  if (event.type === "message:new") {
    return createDashboardNotification({
      id: `${id}:${event.messageId}`,
      title: "New secure message",
      body: event.text,
      kind: "message",
    });
  }

  if (event.type === "session:started") {
    return createDashboardNotification({
      id,
      title: event.title || "Consultation room started",
      body: event.body || "A secure live consultation room is ready.",
      kind: "consultation",
    });
  }

  if (event.type === "session:ended") {
    return createDashboardNotification({
      id,
      title: event.title || "Consultation ended",
      body: event.body || "The live consultation session has ended.",
      kind: "consultation",
    });
  }

  if (
    event.type === "appointment:created" ||
    event.type === "appointment:updated" ||
    event.type === "appointment:rescheduled" ||
    event.type === "appointment:cancelled" ||
    event.type === "appointment:referred"
  ) {
    return createDashboardNotification({
      id,
      title: event.title || "Appointment update",
      body: event.body || "Your appointment workflow was updated.",
      kind: "appointment",
    });
  }

  if (event.type === "doctor:availability-updated" || event.type === "doctor:status-updated") {
    return createDashboardNotification({
      id: `${event.type}:${event.doctorId}:${Date.now()}`,
      title: event.title || (event.type === "doctor:status-updated" ? "Doctor status updated" : "Availability updated"),
      body: event.body || (event.type === "doctor:status-updated" ? "Doctor dashboard status changed." : "Consultation availability changed."),
      kind: "appointment",
    });
  }

  if (event.type === "notification:new") {
    return createDashboardNotification({
      id,
      title: event.title,
      body: event.body,
      kind: "system",
    });
  }

  return null;
}
