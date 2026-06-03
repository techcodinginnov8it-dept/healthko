"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function PhoneDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 rotate-[135deg]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
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
  const gridColumns = stats.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3";

  return (
    <div className={`grid gap-4 ${gridColumns}`}>
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

const SYSTEM_MESSAGE_TEXTS = new Set([
  "Secure room is staged. Start the consultation when you are ready.",
  "Waiting room opened. Complete your device checks while the doctor starts the consultation.",
  "Secure room opened. Waiting for the patient to join.",
  "Secure WebRTC room access authorized.",
  "Participant joined the live consultation room.",
  "The consultation was ended.",
]);

function isSystemChatMessage(message: ChatMessage) {
  return message.kind === "system" || (!message.kind && SYSTEM_MESSAGE_TEXTS.has(message.text));
}

function SystemChatMessage({ message, tone }: { message: ChatMessage; tone: "light" | "dark" }) {
  return (
    <div className="flex justify-center px-2">
      <div
        className={`max-w-[90%] rounded-full border px-3 py-1.5 text-center text-[11px] font-bold ${
          tone === "dark"
            ? "border-slate-700 bg-slate-950/80 text-slate-300"
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        <span>{message.text}</span>
        <span className="ml-2 text-[10px] uppercase opacity-70">{message.time}</span>
      </div>
    </div>
  );
}

function ConversationChatMessage({ message, mine, tone }: { message: ChatMessage; mine: boolean; tone: "light" | "dark" }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
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
  const visibleMessages = useMemo(() => {
    const seen = new Set<string>();

    return messages.filter((message) => {
      if (seen.has(message.id)) {
        return false;
      }

      seen.add(message.id);
      return true;
    });
  }, [messages]);
  const hasConversationMessages = visibleMessages.some((message) => !isSystemChatMessage(message));

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
        {visibleMessages.length ? (
          visibleMessages.map((message) => {
            if (isSystemChatMessage(message)) {
              return <SystemChatMessage key={message.id} message={message} tone={tone} />;
            }

            const mine = message.sender === role;

            return <ConversationChatMessage key={message.id} message={message} mine={mine} tone={tone} />;
          })
        ) : (
          <EmptyState title="No messages yet" body="Start the conversation from either dashboard." />
        )}
        {visibleMessages.length > 0 && !hasConversationMessages && (
          <p className={`pt-1 text-center text-xs font-semibold ${tone === "dark" ? "text-slate-500" : "text-slate-400"}`}>
            No conversation messages yet.
          </p>
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

function VideoStream({ stream, muted, active }: { stream: MediaStream | null; muted?: boolean; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      // Browser autoplay policies can still block unmuted remote playback until the user interacts.
    });

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  if (!stream) return null;

  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;
  const visualActive = active && hasVideo;

  if (!visualActive && !hasAudio) return null;

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={visualActive ? "absolute inset-0 h-full w-full rounded-xl object-cover" : "sr-only"}
    />
  );
}

type MediaDeviceControlsProps = {
  devices?: MediaDeviceInfo[];
  cameraDeviceId?: string;
  microphoneDeviceId?: string;
  onCameraDeviceChange?: (deviceId: string) => void;
  onMicrophoneDeviceChange?: (deviceId: string) => void;
  onRefreshDevices?: () => void;
  deviceStatus?: {
    cameraAvailable: boolean;
    microphoneAvailable: boolean;
    permissionState: PermissionState | "unknown";
    message: string | null;
  };
};

function MediaDeviceControls({
  devices = [],
  cameraDeviceId = "",
  microphoneDeviceId = "",
  onCameraDeviceChange,
  onMicrophoneDeviceChange,
  onRefreshDevices,
  deviceStatus,
}: MediaDeviceControlsProps) {
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const microphones = devices.filter((device) => device.kind === "audioinput");

  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="min-w-0 space-y-1 font-bold text-slate-300">
        Camera
        <select
          value={cameraDeviceId}
          onChange={(event) => onCameraDeviceChange?.(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-brand-teal"
        >
          <option value="">{cameras.length ? "Default camera" : "No camera detected"}</option>
          {cameras.map((device, index) => (
            <option key={device.deviceId || `camera-${index}`} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 space-y-1 font-bold text-slate-300">
        Microphone
        <select
          value={microphoneDeviceId}
          onChange={(event) => onMicrophoneDeviceChange?.(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-brand-teal"
        >
          <option value="">{microphones.length ? "Default microphone" : "No microphone detected"}</option>
          {microphones.map((device, index) => (
            <option key={device.deviceId || `microphone-${index}`} value={device.deviceId}>
              {device.label || `Microphone ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onRefreshDevices}
        className="self-end rounded-md border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition hover:bg-white/10"
      >
        Recheck
      </button>
      {deviceStatus?.message && (
        <p className="text-[11px] font-semibold text-amber-100 sm:col-span-3">{deviceStatus.message}</p>
      )}
    </div>
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
  localStream = null,
  remoteStream = null,
  connectionState = "new",
  mediaError = null,
  devices,
  cameraDeviceId,
  microphoneDeviceId,
  deviceStatus,
  onCameraDeviceChange,
  onMicrophoneDeviceChange,
  onRefreshDevices,
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
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  connectionState?: RTCPeerConnectionState;
  mediaError?: string | null;
  devices?: MediaDeviceInfo[];
  cameraDeviceId?: string;
  microphoneDeviceId?: string;
  deviceStatus?: MediaDeviceControlsProps["deviceStatus"];
  onCameraDeviceChange?: (deviceId: string) => void;
  onMicrophoneDeviceChange?: (deviceId: string) => void;
  onRefreshDevices?: () => void;
}) {
  const statusLabel = status === "connected" ? "Connected" : role === "doctor" ? "Waiting for Patient" : "Waiting room";
  const localVideoActive = Boolean(localStream?.getVideoTracks().length && isCameraOn);
  const remoteVideoActive = Boolean(remoteStream?.getVideoTracks().length && counterpartCameraOn);
  const connectionLabel =
    connectionState === "connected"
      ? "Media connected"
      : connectionState === "connecting"
        ? "Connecting media"
        : connectionState === "failed"
          ? "Media connection failed"
          : "Media ready";

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="relative rounded-xl border border-slate-800 bg-slate-950 text-white xl:col-span-7">
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
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${connectionState === "failed" ? "bg-red-500/15 text-red-200" : "bg-white/10 text-slate-200"}`}>
            {connectionLabel}
          </span>
          {mediaError && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-100">
              {mediaError}
            </span>
          )}
        </div>
        <div className="border-b border-slate-800 px-4 py-3">
          <MediaDeviceControls
            devices={devices}
            cameraDeviceId={cameraDeviceId}
            microphoneDeviceId={microphoneDeviceId}
            deviceStatus={deviceStatus}
            onCameraDeviceChange={onCameraDeviceChange}
            onMicrophoneDeviceChange={onMicrophoneDeviceChange}
            onRefreshDevices={onRefreshDevices}
          />
        </div>
        <div className="relative grid min-h-[520px] gap-4 p-4 pb-28 md:grid-cols-2">
          <div className={`relative min-h-[420px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 ${remoteVideoActive ? "md:col-span-2" : ""}`}>
            <VideoStream stream={remoteStream} active={counterpartCameraOn} />
            <div className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.28),_transparent_45%)] ${remoteVideoActive ? "hidden" : ""}`} />
            <div className={`relative flex h-full items-center justify-center p-6 text-center ${remoteVideoActive ? "hidden" : ""}`}>
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
          <div className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 ${remoteVideoActive ? "absolute bottom-32 right-6 z-10 h-32 w-44 shadow-2xl shadow-black/50 md:bottom-28 md:right-8 md:h-40 md:w-56" : "min-h-[420px]"}`}>
            <VideoStream stream={localStream} muted={true} active={isCameraOn} />
            <div className={`relative flex h-full items-center justify-center p-6 text-center ${localVideoActive ? "hidden" : ""}`}>
              <div>
                <div className={`mx-auto h-16 w-16 rounded-full ${isCameraOn ? "bg-slate-700" : "bg-brand-red/30"}`} />
                <p className="mt-4 text-sm font-black">Your stream</p>
                <p className="mt-1 text-xs text-slate-400">{isCameraOn ? "Waiting for camera access" : "Camera disabled"}</p>
              </div>
            </div>
          </div>
        </div>
        <footer className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-4 rounded-full border border-white/10 bg-[rgba(24,24,27,0.7)] px-5 py-3 shadow-2xl shadow-black/30 backdrop-blur-[12px]">
          <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleCamera}
            aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
            title={isCameraOn ? "Turn camera off" : "Turn camera on"}
            className={`grid h-12 w-12 place-items-center rounded-full border transition focus:outline-none focus:ring-4 ${
              isCameraOn
                ? "border-white/15 bg-white/10 text-white hover:bg-white/15 focus:ring-white/20"
                : "border-red-300/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 focus:ring-red-300/30"
            }`}
          >
            <VideoControlIcon off={!isCameraOn} />
          </button>
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
            title={isMicOn ? "Mute microphone" : "Unmute microphone"}
            className={`grid h-12 w-12 place-items-center rounded-full border transition focus:outline-none focus:ring-4 ${
              isMicOn
                ? "border-white/15 bg-white/10 text-white hover:bg-white/15 focus:ring-white/20"
                : "border-red-300/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 focus:ring-red-300/30"
            }`}
          >
            <MicControlIcon off={!isMicOn} />
          </button>
          </div>
          <button
            type="button"
            onClick={onEnd}
            aria-label="End consultation"
            title="End consultation"
            className="grid h-14 w-14 place-items-center rounded-full bg-brand-red text-white shadow-lg shadow-red-950/40 transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            <PhoneDownIcon />
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

export function FloatingConsultationCall({
  role,
  counterpartName,
  status,
  isCameraOn,
  isMicOn,
  counterpartCameraOn = true,
  localStream = null,
  remoteStream = null,
  connectionState = "new",
  mediaError = null,
  onOpen,
  onToggleCamera,
  onToggleMic,
  onEnd,
}: {
  role: DashboardRole;
  counterpartName: string;
  status: "waiting" | "connected";
  isCameraOn: boolean;
  isMicOn: boolean;
  counterpartCameraOn?: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  connectionState?: RTCPeerConnectionState;
  mediaError?: string | null;
  onOpen: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}) {
  const remoteVideoActive = Boolean(remoteStream?.getVideoTracks().length && counterpartCameraOn);
  const localVideoActive = Boolean(localStream?.getVideoTracks().length && isCameraOn);
  const stateText = connectionState === "connected" ? "Connected" : status === "waiting" ? "Waiting" : "Reconnecting";
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 16,
    originY: 16,
  });

  const clampPosition = useCallback((nextX: number, nextY: number) => {
    if (typeof window === "undefined") {
      return { x: nextX, y: nextY };
    }

    const width = Math.min(352, window.innerWidth - 32);
    const height = 360;

    return {
      x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, nextY), Math.max(8, window.innerHeight - height - 8)),
    };
  }, []);

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active) {
      return;
    }

    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    setPosition(clampPosition(nextX, nextY));
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      className="fixed z-[90] w-[min(22rem,calc(100vw-2rem))] touch-none overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-white shadow-2xl shadow-black/40"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
    >
      <div className="relative h-44 bg-slate-900">
        <div className="absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300 backdrop-blur">
          Drag
        </div>
        <VideoStream stream={remoteStream} active={counterpartCameraOn} />
        {!remoteVideoActive && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900 p-4 text-center">
            <div>
              <p className="text-sm font-black">{counterpartName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{role === "doctor" ? "Patient" : "Doctor"} video unavailable</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 right-3 h-20 w-28 overflow-hidden rounded-lg border border-white/15 bg-slate-800 shadow-xl">
          <VideoStream stream={localStream} muted active={isCameraOn} />
          {!localVideoActive && <div className="grid h-full place-items-center text-[10px] font-black uppercase text-slate-300">You</div>}
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{counterpartName}</p>
            <p className={`text-[11px] font-bold ${mediaError ? "text-amber-200" : "text-emerald-200"}`}>
              {mediaError || stateText}
            </p>
          </div>
          <button type="button" onClick={onOpen} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white" aria-label="Open consultation">
            <MaximizeIcon />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onToggleCamera} className={`grid h-10 w-10 place-items-center rounded-full ${isCameraOn ? "bg-white/10" : "bg-red-500/20 text-red-100"}`} aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}>
            <VideoControlIcon off={!isCameraOn} />
          </button>
          <button type="button" onClick={onToggleMic} className={`grid h-10 w-10 place-items-center rounded-full ${isMicOn ? "bg-white/10" : "bg-red-500/20 text-red-100"}`} aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}>
            <MicControlIcon off={!isMicOn} />
          </button>
          <button type="button" onClick={onEnd} className="grid h-11 w-11 place-items-center rounded-full bg-brand-red text-white" aria-label="End consultation">
            <PhoneDownIcon />
          </button>
        </div>
      </div>
    </aside>
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
