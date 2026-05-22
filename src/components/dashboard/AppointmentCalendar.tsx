"use client";

import { Fragment } from "react";
import { formatDateTime } from "@/lib/dashboard/format";

type CalendarAppointment = {
  id: string;
  title: string;
  subtitle: string;
  scheduledAt: Date | string;
  status: string;
  reason?: string | null;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date: Date, hour: number) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function sameSlot(value: Date | string, slot: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === slot.getFullYear() &&
    date.getMonth() === slot.getMonth() &&
    date.getDate() === slot.getDate() &&
    date.getHours() === slot.getHours()
  );
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function AppointmentCalendar({
  appointments,
  tone = "light",
  editable = false,
  onReschedule,
}: {
  appointments: CalendarAppointment[];
  tone?: "light" | "dark";
  editable?: boolean;
  onReschedule?: (appointmentId: string, scheduledAt: string) => void;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 5 }, (_, index) => addDays(today, index));
  const hours = [8, 9, 10, 11, 13, 14, 15, 16];
  const dark = tone === "dark";

  return (
    <section className={`rounded-xl border p-4 ${dark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Calendar</p>
        <h2 className="text-lg font-black">Consultation Schedule</h2>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[820px] grid-cols-[88px_repeat(5,minmax(136px,1fr))] gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
          <div className={dark ? "bg-slate-950 p-3" : "bg-slate-50 p-3"} />
          {days.map((day) => (
            <div key={day.toISOString()} className={dark ? "bg-slate-950 p-3" : "bg-slate-50 p-3"}>
              <p className="text-xs font-black">{formatWeekday(day)}</p>
              <p className={dark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>
                {formatMonthDay(day)}
              </p>
            </div>
          ))}
          {hours.map((hour) => (
            <Fragment key={hour}>
              <div key={`time-${hour}`} className={dark ? "bg-slate-950 p-3 text-xs font-black text-slate-400" : "bg-slate-50 p-3 text-xs font-black text-slate-500"}>
                {`${hour.toString().padStart(2, "0")}:00`}
              </div>
              {days.map((day) => {
                const slot = setTime(day, hour);
                const slotAppointments = appointments.filter((appointment) => sameSlot(appointment.scheduledAt, slot));

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    onDragOver={(event) => {
                      if (editable) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      if (!editable || !onReschedule) {
                        return;
                      }

                      const appointmentId = event.dataTransfer.getData("text/plain");
                      if (appointmentId) {
                        onReschedule(appointmentId, slot.toISOString());
                      }
                    }}
                    className={`min-h-24 p-2 ${dark ? "bg-slate-950" : "bg-white"}`}
                  >
                    <div className="space-y-2">
                      {slotAppointments.map((appointment) => (
                        <article
                          key={appointment.id}
                          draggable={editable}
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", appointment.id)}
                          className={`rounded-lg border-l-4 border-brand-teal p-2 text-xs shadow-sm ${
                            dark ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"
                          } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                          title={editable ? "Drag to another calendar slot" : undefined}
                        >
                          <p className="font-black">{appointment.title}</p>
                          <p className={dark ? "mt-1 font-semibold text-slate-400" : "mt-1 font-semibold text-slate-500"}>{appointment.subtitle}</p>
                          <p className="mt-2 font-black uppercase text-brand-teal">{appointment.status}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {appointments.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {appointments.slice(0, 4).map((appointment) => (
            <p key={appointment.id} className={dark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>
              {appointment.title}: {formatDateTime(appointment.scheduledAt)}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
