"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/dashboard/format";
import type { DashboardNotification, DashboardRole } from "@/lib/dashboard/types";

function BellIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function getKindLabel(kind: DashboardNotification["kind"]) {
  switch (kind) {
    case "appointment":
      return "Appointment";
    case "consultation":
      return "Consultation";
    case "message":
      return "Message";
    case "prescription":
      return "Prescription";
    default:
      return "System";
  }
}

export function NotificationBell({
  role,
  notifications,
  unreadCount,
  onMarkAllRead,
  onOpenNotifications,
}: {
  role: DashboardRole;
  notifications: DashboardNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onOpenNotifications: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDoctor = role === "doctor";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-lg border ${
          isDoctor ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-700"
        }`}
        aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-2xl ${
            isDoctor ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"
          }`}
        >
          <div className={`flex items-center justify-between gap-3 border-b p-4 ${isDoctor ? "border-slate-800" : "border-slate-200"}`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Notifications</p>
              <p className="mt-1 text-sm font-black">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
            </div>
            <button
              type="button"
              onClick={onMarkAllRead}
              className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase ${
                isDoctor ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-600"
              }`}
            >
              Mark Read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {notifications.length ? (
              notifications.slice(0, 8).map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg p-3 ${isDoctor ? "hover:bg-slate-900" : "hover:bg-slate-50"} ${item.readAt ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black">{item.title}</p>
                    {!item.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-red" aria-label="Unread" />}
                  </div>
                  <p className={`mt-1 line-clamp-2 text-xs font-semibold ${isDoctor ? "text-slate-400" : "text-slate-500"}`}>{item.body}</p>
                  <div className={`mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase ${isDoctor ? "text-slate-500" : "text-slate-400"}`}>
                    <span>{getKindLabel(item.kind)}</span>
                    <time dateTime={new Date(item.createdAt).toISOString()}>{formatDateTime(item.createdAt)}</time>
                  </div>
                </article>
              ))
            ) : (
              <div className={`p-5 text-sm font-semibold ${isDoctor ? "text-slate-400" : "text-slate-500"}`}>
                No alerts yet.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenNotifications();
            }}
            className={`w-full border-t px-4 py-3 text-xs font-black ${
              isDoctor ? "border-slate-800 text-brand-teal" : "border-slate-200 text-brand-teal"
            }`}
          >
            View Notification Center
          </button>
        </div>
      )}
    </div>
  );
}
