"use client";

import { useState } from "react";
import type { ChatAttachment, ChatMessage, DashboardRole } from "@/lib/dashboard/types";
import { formatDate, formatDateTime } from "@/lib/dashboard/format";

function VideoControlIcon({ off = false }: { off?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 13 5 3V8l-5 3" />
      <rect width="14" height="10" x="2" y="7" rx="2" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function MicControlIcon({ off = false }: { off?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 10.8c3.5-2.3 7.3-2.3 10.8 0" />
      <path d="m4.2 13.2 2.1-2.1a2 2 0 0 1 2.2-.4l1.3.6a2 2 0 0 0 1.6.1 7.2 7.2 0 0 1 1.2 0 2 2 0 0 0 1.6-.1l1.3-.6a2 2 0 0 1 2.2.4l2.1 2.1a1.6 1.6 0 0 1 .1 2.2l-1.5 1.7a2 2 0 0 1-2 .6c-3-.8-5.8-.8-8.8 0a2 2 0 0 1-2-.6l-1.5-1.7a1.6 1.6 0 0 1 .1-2.2Z" />
      <path d="M5 5l14 14" />
    </svg>
  );
}

export function StatGrid({
  stats,
  tone = "light",
}: {
  stats: { label: string; value: string | number; helper: string }[];
  tone?: "light" | "dark";
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border p-5 ${
            tone === "dark" ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">{stat.label}</p>
          <p className="mt-3 font-display text-3xl font-black">{stat.value}</p>
          <p className={`mt-1 text-xs font-semibold ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>{stat.helper}</p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{body}</p>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
      ))}
    </div>
  );
}

export function AppointmentCard({
  title,
  subtitle,
  scheduledAt,
  status,
  reason,
  tone = "light",
  actions,
}: {
  title: string;
  subtitle: string;
  scheduledAt: Date | string;
  status: string;
  reason?: string | null;
  tone?: "light" | "dark";
  actions?: React.ReactNode;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        tone === "dark" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black">{title}</h3>
            <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black uppercase text-brand-teal">
              {status}
            </span>
          </div>
          <p className={`mt-1 text-xs font-bold ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>
          {reason && <p className={`mt-2 text-xs leading-relaxed ${tone === "dark" ? "text-slate-300" : "text-slate-600"}`}>{reason}</p>}
        </div>
        <div className="shrink-0 text-left md:text-right">
          <p className={`text-xs font-black ${tone === "dark" ? "text-slate-300" : "text-slate-700"}`}>{formatDateTime(scheduledAt)}</p>
          {actions && <div className="mt-3 flex flex-wrap gap-2 md:justify-end">{actions}</div>}
        </div>
      </div>
    </article>
  );
}

export function ChatPanel({
  role,
  messages,
  onSend,
  tone = "dark",
}: {
  role: DashboardRole;
  messages: ChatMessage[];
  onSend: (text: string, attachment?: ChatAttachment) => void;
  tone?: "light" | "dark";
}) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>();

  const handleFile = (file?: File) => {
    if (!file) {
      setAttachment(undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: typeof reader.result === "string" ? reader.result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className={`flex min-h-[360px] flex-col rounded-xl border ${tone === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <header className={`border-b px-4 py-3 ${tone === "dark" ? "border-slate-800" : "border-slate-200"}`}>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Messages</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length ? (
          messages.map((message) => {
            const mine = message.sender === role;

            return (
              <div key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[10px] font-bold uppercase text-slate-500">{mine ? "You" : message.sender} · {message.time}</span>
                <p className={`mt-1 max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${mine ? "bg-brand-teal text-white" : tone === "dark" ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-700"}`}>
                  {message.text}
                  {message.attachment && (
                    <a
                      href={message.attachment.dataUrl}
                      download={message.attachment.name}
                      className="mt-2 block rounded-lg bg-white/10 px-2 py-1 font-black underline"
                    >
                      {message.attachment.name}
                    </a>
                  )}
                </p>
              </div>
            );
          })
        ) : (
          <EmptyState title="No messages yet" body="Start the conversation from either dashboard." />
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft, attachment);
          setDraft("");
          setAttachment(undefined);
        }}
        className={`flex flex-col gap-2 border-t p-3 ${tone === "dark" ? "border-slate-800" : "border-slate-200"}`}
      >
        {attachment && <p className="text-xs font-bold text-brand-teal">Attached: {attachment.name}</p>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type secure message..."
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-teal ${tone === "dark" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
          />
          <label className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-black ${tone === "dark" ? "border-slate-800 text-slate-200" : "border-slate-200 text-slate-700"}`}>
            File
            <input type="file" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          <button type="submit" className="rounded-lg bg-brand-teal px-4 py-2 text-xs font-black text-white">
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

export function LiveConsultationPanel({
  role,
  counterpartName,
  appointmentTime,
  status,
  isCameraOn,
  isMicOn,
  counterpartCameraOn = true,
  counterpartMicOn = true,
  onToggleCamera,
  onToggleMic,
  onEnd,
  chat,
  documentation,
}: {
  role: DashboardRole;
  counterpartName: string;
  appointmentTime: Date | string;
  status: "idle" | "waiting" | "connected" | "ended";
  isCameraOn: boolean;
  isMicOn: boolean;
  counterpartCameraOn?: boolean;
  counterpartMicOn?: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
  chat: React.ReactNode;
  documentation?: React.ReactNode;
}) {
  const statusLabel = status === "connected" ? "Connected" : role === "doctor" ? "Waiting for Patient" : "Waiting room";

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="rounded-xl border border-slate-800 bg-slate-950 text-white xl:col-span-7">
        <header className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Live Consultation</p>
            <h2 className="mt-1 text-lg font-black">{counterpartName}</h2>
            <p className="text-xs font-semibold text-slate-400">{formatDateTime(appointmentTime)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${status === "connected" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
            {statusLabel}
          </span>
        </header>
        <div className="grid min-h-[420px] gap-4 p-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.28),_transparent_45%)]" />
            <div className="relative flex h-full items-center justify-center p-6 text-center">
              <div>
                <div className={`mx-auto h-16 w-16 rounded-full ${counterpartCameraOn ? "bg-brand-teal/20" : "bg-brand-red/30"}`} />
                <p className="mt-4 text-sm font-black">{counterpartName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {counterpartCameraOn ? (role === "doctor" ? "Patient stream" : "Doctor stream") : "Camera disabled"}
                  {" · "}
                  {counterpartMicOn ? "Audio live" : "Muted"}
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="relative flex h-full items-center justify-center p-6 text-center">
              <div>
                <div className={`mx-auto h-16 w-16 rounded-full ${isCameraOn ? "bg-slate-700" : "bg-brand-red/30"}`} />
                <p className="mt-4 text-sm font-black">Your stream</p>
                <p className="mt-1 text-xs text-slate-400">{isCameraOn ? "Camera active" : "Camera disabled"}</p>
              </div>
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onToggleCamera}
            aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
            title={isCameraOn ? "Turn camera off" : "Turn camera on"}
            className={`grid h-12 w-12 place-items-center rounded-full border transition ${
              isCameraOn
                ? "border-white/10 bg-slate-800 text-white hover:bg-slate-700"
                : "border-red-200 bg-red-50 text-brand-red hover:bg-red-100"
            }`}
          >
            <VideoControlIcon off={!isCameraOn} />
          </button>
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
            title={isMicOn ? "Mute microphone" : "Unmute microphone"}
            className={`grid h-12 w-12 place-items-center rounded-full border transition ${
              isMicOn
                ? "border-white/10 bg-slate-800 text-white hover:bg-slate-700"
                : "border-red-200 bg-red-50 text-brand-red hover:bg-red-100"
            }`}
          >
            <MicControlIcon off={!isMicOn} />
          </button>
          <button
            type="button"
            onClick={onEnd}
            aria-label="End consultation"
            title="End consultation"
            className="ml-2 grid h-14 w-14 place-items-center rounded-full bg-brand-red text-white shadow-lg shadow-red-950/30 transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            <PhoneOffIcon />
          </button>
        </footer>
      </section>

      <div className="space-y-4 xl:col-span-5">
        {documentation}
        {chat}
      </div>
    </div>
  );
}

export function WaitingRoomPanel({
  doctorName,
  appointmentTime,
  isCameraOn,
  isMicOn,
  isSpeakerReady,
  canJoin,
  notice,
  error,
  onToggleCamera,
  onToggleMic,
  onToggleSpeaker,
  onJoin,
}: {
  doctorName: string;
  appointmentTime: Date | string;
  isCameraOn: boolean;
  isMicOn: boolean;
  isSpeakerReady: boolean;
  canJoin: boolean;
  notice?: string;
  error?: string;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onJoin: () => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-12">
      <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-7">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Waiting Room</p>
        <h2 className="mt-2 text-lg font-black text-slate-950">{doctorName}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">{formatDateTime(appointmentTime)}</p>
        <div className="mt-5 grid min-h-[320px] place-items-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <div>
            <div className="mx-auto h-20 w-20 rounded-full bg-brand-teal/10" />
            <p className="mt-4 text-sm font-black text-slate-950">Device preparation only</p>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              The consultation room is locked until your doctor starts the secure session.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 xl:col-span-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Device Checks</p>
          <div className="mt-4 space-y-3">
            <button type="button" onClick={onToggleCamera} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-800">
              Camera <span className={isCameraOn ? "text-emerald-600" : "text-brand-red"}>{isCameraOn ? "Ready" : "Off"}</span>
            </button>
            <button type="button" onClick={onToggleMic} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-800">
              Microphone <span className={isMicOn ? "text-emerald-600" : "text-brand-red"}>{isMicOn ? "Ready" : "Muted"}</span>
            </button>
            <button type="button" onClick={onToggleSpeaker} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-800">
              Speaker <span className={isSpeakerReady ? "text-emerald-600" : "text-brand-red"}>{isSpeakerReady ? "Ready" : "Check needed"}</span>
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Room Access</p>
          {notice && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div>}
          {error && <div className="mt-4 rounded-lg border border-brand-red/20 bg-brand-red/10 p-3 text-xs font-bold text-brand-red">{error}</div>}
          <button
            type="button"
            disabled={!canJoin}
            onClick={onJoin}
            className="mt-4 w-full rounded-lg bg-brand-teal px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
          >
            {canJoin ? "Join Consultation" : "Waiting for Doctor"}
          </button>
        </section>
      </div>
    </section>
  );
}

export function PrescriptionList({
  items,
  role,
}: {
  items: { id: string; prescription: string | null; reason?: string | null; scheduledAt: Date | string; owner: string }[];
  role: DashboardRole;
}) {
  const active = items.filter((item) => item.prescription);

  return active.length ? (
    <div className="grid gap-4 md:grid-cols-2">
      {active.map((item) => (
        <article key={item.id} className="rounded-xl border border-brand-red/20 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Prescription</p>
          <h3 className="mt-2 text-sm font-black text-slate-950">{item.prescription}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">{role === "doctor" ? "Patient" : "Doctor"}: {item.owner}</p>
          <p className="mt-3 text-xs text-slate-500">{formatDate(item.scheduledAt)} · {item.reason || "Clinical encounter"}</p>
          <button type="button" className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
            Download PDF
          </button>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState title="No active prescriptions" body="Prescriptions issued during completed visits appear here." />
  );
}
