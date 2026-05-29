"use client";

import { Fragment } from "react";
import { formatDateTime } from "@/lib/dashboard/format";
import { parseAvailability } from "@/lib/scheduling";

export type CalendarViewMode = "day" | "week" | "month";

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

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function setTime(date: Date, hour: number) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function toLocalDateTimeValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:00`;
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

function sameDay(value: Date | string, day: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function moveAppointmentToDay(appointmentDate: Date | string, day: Date) {
  const original = new Date(appointmentDate);
  const next = new Date(day);
  next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return toLocalDateTimeValue(next);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function getCalendarDays(viewMode: CalendarViewMode, anchorDate: Date) {
  if (viewMode === "day") {
    return [startOfDay(anchorDate)];
  }

  if (viewMode === "month") {
    const monthStart = startOfMonth(anchorDate);
    return Array.from({ length: daysInMonth(anchorDate) }, (_, index) => addDays(monthStart, index));
  }

  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function getViewLabel(viewMode: CalendarViewMode) {
  return viewMode === "day" ? "Day" : viewMode === "week" ? "Week" : "Month";
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function AppointmentBlock({
  appointment,
  editable,
  compact = false,
}: {
  appointment: CalendarAppointment;
  editable: boolean;
  compact?: boolean;
}) {
  const confirmed = appointment.status === "CONFIRMED";
  const pending = appointment.status === "PENDING";

  return (
    <article
      draggable={editable}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", appointment.id)}
      className={`rounded-md border shadow-sm transition ${
        compact ? "px-2 py-1.5 text-[10px]" : "px-2.5 py-2 text-xs"
      } ${
        confirmed
          ? "border-sky-300/30 bg-sky-400/15 text-sky-50"
          : pending
            ? "border-amber-300/30 bg-amber-400/15 text-amber-50"
            : "border-slate-700 bg-slate-800 text-slate-100"
      } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
      title={editable ? "Drag to another calendar slot" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-black">{appointment.title}</span>
        <span className={confirmed ? "text-sky-200" : pending ? "text-amber-200" : "text-slate-300"}>
          {confirmed ? "CNF" : pending ? "REQ" : appointment.status.slice(0, 3)}
        </span>
      </div>
      {!compact && <p className="mt-1 truncate font-semibold text-slate-300">{appointment.subtitle}</p>}
      {compact && <p className="mt-1 font-semibold text-slate-300">{formatDateTime(appointment.scheduledAt)}</p>}
    </article>
  );
}

export function AppointmentCalendar({
  appointments,
  tone = "light",
  editable = false,
  onReschedule,
  variant = "standard",
  viewMode = "week",
  onViewModeChange,
  anchorDate,
  onAnchorDateChange,
  availability,
}: {
  appointments: CalendarAppointment[];
  tone?: "light" | "dark";
  editable?: boolean;
  onReschedule?: (appointmentId: string, scheduledAt: string) => void;
  variant?: "standard" | "stage";
  viewMode?: CalendarViewMode;
  onViewModeChange?: (viewMode: CalendarViewMode) => void;
  anchorDate?: Date;
  onAnchorDateChange?: (date: Date) => void;
  availability?: string | null;
}) {
  const resolvedAnchorDate = startOfDay(anchorDate || new Date());
  const days = getCalendarDays(viewMode, resolvedAnchorDate);
  const availabilityWindow = parseAvailability(availability);
  const hours = availabilityWindow
    ? Array.from({ length: Math.max(1, Math.ceil(availabilityWindow.endMinutes / 60) - Math.floor(availabilityWindow.startMinutes / 60)) }, (_, index) => Math.floor(availabilityWindow.startMinutes / 60) + index)
    : [8, 9, 10, 11, 13, 14, 15, 16];
  const dark = tone === "dark";
  const stage = variant === "stage";
  const periodLabel = viewMode === "month"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(resolvedAnchorDate)
    : `${formatMonthDay(days[0])}${days.length > 1 ? ` - ${formatMonthDay(days[days.length - 1])}` : ""}`;
  const columnMinWidth = viewMode === "month" ? "minmax(96px,1fr)" : viewMode === "day" ? "minmax(320px,1fr)" : "minmax(126px,1fr)";
  const columnPixelWidth = viewMode === "day" ? 320 : 136;
  const gridMinWidth = 72 + days.length * columnPixelWidth;
  const stepUnit = viewMode === "month" ? "month" : viewMode === "day" ? "day" : "week";
  const stepCalendar = (direction: -1 | 1) => {
    if (!onAnchorDateChange) {
      return;
    }

    const amount = direction * (viewMode === "week" ? 7 : 1);
    onAnchorDateChange(stepUnit === "month" ? startOfMonth(addMonths(resolvedAnchorDate, direction)) : addDays(resolvedAnchorDate, amount));
  };

  return (
    <section className={`rounded-xl border ${stage ? "p-3 sm:p-4" : "p-4"} ${dark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Calendar</p>
          <h2 className={stage ? "text-xl font-black" : "text-lg font-black"}>Consultation Schedule</h2>
        </div>
        {stage && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
            <button
              type="button"
              onClick={() => stepCalendar(-1)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
              aria-label="Previous calendar period"
            >
              <ChevronIcon direction="left" />
            </button>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-200">{periodLabel}</span>
            <button
              type="button"
              onClick={() => stepCalendar(1)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
              aria-label="Next calendar period"
            >
              <ChevronIcon direction="right" />
            </button>
            <label className="relative">
              <span className="sr-only">Calendar view</span>
              <select
                value={viewMode}
                onChange={(event) => onViewModeChange?.(event.target.value as CalendarViewMode)}
                className="h-8 appearance-none rounded-full border border-white/10 bg-slate-950 px-3 pr-8 text-[10px] font-black uppercase text-white outline-none transition hover:border-brand-teal/60 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              >
                {(["day", "week", "month"] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {getViewLabel(mode)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </label>
            <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sky-200">Confirmed</span>
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-200">Pending</span>
          </div>
        )}
      </div>
      {viewMode === "month" ? (
        <div className="max-h-[620px] overflow-auto rounded-lg border border-slate-800 bg-slate-800 transition-all duration-300">
          <div className="grid min-w-[920px] grid-cols-7 gap-px">
            {days.map((day) => {
              const dayAppointments = appointments.filter((appointment) => sameDay(appointment.scheduledAt, day));
              const dayAvailable = !availabilityWindow || availabilityWindow.days.includes(day.getDay());

              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(event) => {
                    if (editable && dayAvailable) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    if (!editable || !onReschedule || !dayAvailable) {
                      return;
                    }

                    const appointmentId = event.dataTransfer.getData("text/plain");
                    const appointment = appointments.find((item) => item.id === appointmentId);
                    if (appointment) {
                      onReschedule(appointmentId, moveAppointmentToDay(appointment.scheduledAt, day));
                    }
                  }}
                  className={`min-h-36 p-2 transition-colors ${dayAvailable ? "bg-slate-950" : "bg-slate-900/50"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-white">{formatMonthDay(day)}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-500">{formatWeekday(day)}</p>
                    </div>
                    {dayAppointments.length ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-200">{dayAppointments.length}</span>
                    ) : null}
                  </div>
                  <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
                    {dayAppointments.map((appointment) => (
                      <AppointmentBlock key={appointment.id} appointment={appointment} editable={editable} compact />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="max-h-[620px] overflow-x-auto overflow-y-auto rounded-lg transition-all duration-300">
        <div
          className={`grid gap-px overflow-hidden rounded-lg border ${dark ? "border-slate-800 bg-slate-800" : "border-slate-200 bg-slate-200"}`}
          style={{
            gridTemplateColumns: `72px repeat(${days.length}, ${columnMinWidth})`,
            minWidth: `${gridMinWidth}px`,
          }}
        >
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
                const slotMinutes = hour * 60;
                const slotAvailable = !availabilityWindow || (
                  availabilityWindow.days.includes(slot.getDay()) &&
                  slotMinutes >= availabilityWindow.startMinutes &&
                  slotMinutes < availabilityWindow.endMinutes
                );

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    onDragOver={(event) => {
                      if (editable) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      if (!editable || !onReschedule || !slotAvailable) {
                        return;
                      }

                      const appointmentId = event.dataTransfer.getData("text/plain");
                      if (appointmentId) {
                        onReschedule(appointmentId, toLocalDateTimeValue(slot));
                      }
                    }}
                    className={`${stage ? "min-h-20" : "min-h-24"} p-2 ${slotAvailable ? (dark ? "bg-slate-950" : "bg-white") : dark ? "bg-slate-900/50" : "bg-slate-100"}`}
                  >
                    <div className={stage ? "flex max-h-28 flex-col gap-1.5 overflow-y-auto pr-1" : "space-y-2"}>
                      {slotAppointments.map((appointment) => {
                        return stage ? (
                          <AppointmentBlock key={appointment.id} appointment={appointment} editable={editable} />
                        ) : (
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      )}
      {!stage && appointments.length ? (
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
