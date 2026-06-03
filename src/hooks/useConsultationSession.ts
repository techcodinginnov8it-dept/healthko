"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatAttachment, ChatMessage, DashboardRole, RealtimeEvent } from "@/lib/dashboard/types";
import { formatTimeNow } from "@/lib/dashboard/format";

type SessionState<TAppointment> = {
  activeAppointment: TAppointment | null;
  status: "idle" | "waiting" | "connected" | "ended";
  isCameraOn: boolean;
  isMicOn: boolean;
  counterpartCameraOn: boolean;
  counterpartMicOn: boolean;
  isSpeakerReady: boolean;
  roomId: string;
  accessToken: string;
  messages: ChatMessage[];
};

const idleState = {
  activeAppointment: null,
  status: "idle",
  isCameraOn: true,
  isMicOn: true,
  counterpartCameraOn: true,
  counterpartMicOn: true,
  isSpeakerReady: true,
  roomId: "",
  accessToken: "",
  messages: [],
} satisfies SessionState<{ id: string }>;

function getInitialState<TAppointment>(persistKey?: string): SessionState<TAppointment> {
  if (!persistKey || typeof window === "undefined") {
    return idleState as SessionState<TAppointment>;
  }

  try {
    const saved = window.sessionStorage.getItem(persistKey);
    if (!saved) {
      return idleState as SessionState<TAppointment>;
    }

    const parsed = JSON.parse(saved) as Partial<SessionState<TAppointment>>;
    if (!parsed.activeAppointment || !parsed.roomId || (parsed.status !== "waiting" && parsed.status !== "connected")) {
      return idleState as SessionState<TAppointment>;
    }

    return {
      ...(idleState as SessionState<TAppointment>),
      ...parsed,
      status: parsed.status,
      messages: parsed.messages || [],
    };
  } catch {
    return idleState as SessionState<TAppointment>;
  }
}

export function useConsultationSession<TAppointment extends { id: string }>({
  role,
  publish,
  persistKey,
}: {
  role: DashboardRole;
  publish: (event: RealtimeEvent) => void;
  persistKey?: string;
}) {
  const storageKey = useMemo(() => persistKey || `healthko:${role}:active-consultation`, [persistKey, role]);
  const [hasLoadedStoredState, setHasLoadedStoredState] = useState(false);
  const [state, setState] = useState<SessionState<TAppointment>>(idleState as SessionState<TAppointment>);

  useEffect(() => {
    window.queueMicrotask(() => {
      setState(getInitialState<TAppointment>(storageKey));
      setHasLoadedStoredState(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredState) {
      return;
    }

    if (!state.activeAppointment || !state.roomId || (state.status !== "waiting" && state.status !== "connected")) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [hasLoadedStoredState, state, storageKey]);

  const openWaitingRoom = useCallback(
    (appointment: TAppointment) => {
      setState((current) => ({
        ...current,
        activeAppointment: appointment,
        status: "waiting",
        roomId: "",
        accessToken: "",
        messages: [
          {
            id: `${appointment.id}-waiting-room`,
            sender: role,
            kind: "system",
            text:
              role === "doctor"
                ? "Secure room is staged. Start the consultation when you are ready."
                : "Waiting room opened. Complete your device checks while the doctor starts the consultation.",
            time: formatTimeNow(),
          },
        ],
      }));
    },
    [role]
  );

  const enterAuthorizedRoom = useCallback(
    (appointment: TAppointment, roomId: string, accessToken: string, nextStatus: SessionState<TAppointment>["status"] = "connected") => {
      setState((current) => ({
        ...current,
        activeAppointment: appointment,
        status: nextStatus,
        roomId,
        accessToken,
        messages: [
          ...current.messages,
          {
            id: `${appointment.id}-room-authorized-${Date.now()}`,
            sender: role,
            kind: "system",
            text: nextStatus === "waiting" ? "Secure room opened. Waiting for the patient to join." : "Secure WebRTC room access authorized.",
            time: formatTimeNow(),
          },
        ],
      }));
    },
    [role]
  );

  const endSession = useCallback((broadcast = true) => {
    const appointment = state.activeAppointment;

    if (broadcast && appointment) {
      publish({
        type: "session:ended",
        appointmentId: appointment.id,
        actorRole: role,
      });
    }

    setState((current) => {
      return {
        ...current,
        activeAppointment: null,
        status: "ended",
        roomId: "",
        accessToken: "",
      };
    });
  }, [publish, role, state.activeAppointment]);

  const toggleCamera = useCallback(() => {
    const isCameraOn = !state.isCameraOn;
    if (state.activeAppointment) {
      publish({
        type: "media:updated",
        appointmentId: state.activeAppointment.id,
        actorRole: role,
        cameraOn: isCameraOn,
        micOn: state.isMicOn,
      });
    }

    setState((current) => {
      if (current.isCameraOn === isCameraOn) {
        return current;
      }

      return { ...current, isCameraOn };
    });
  }, [publish, role, state.activeAppointment, state.isCameraOn, state.isMicOn]);

  const toggleMic = useCallback(() => {
    const isMicOn = !state.isMicOn;
    if (state.activeAppointment) {
      publish({
        type: "media:updated",
        appointmentId: state.activeAppointment.id,
        actorRole: role,
        cameraOn: state.isCameraOn,
        micOn: isMicOn,
      });
    }

    setState((current) => {
      if (current.isMicOn === isMicOn) {
        return current;
      }

      return { ...current, isMicOn };
    });
  }, [publish, role, state.activeAppointment, state.isCameraOn, state.isMicOn]);

  const toggleSpeaker = useCallback(() => {
    setState((current) => ({ ...current, isSpeakerReady: !current.isSpeakerReady }));
  }, []);

  const sendMessage = useCallback(
    (text: string, attachment?: ChatAttachment) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) {
        return;
      }

      const appointment = state.activeAppointment;
      if (!appointment) {
        return;
      }

      const message: ChatMessage = {
        id: `${appointment.id}-${role}-${Date.now()}`,
        sender: role,
        kind: "user",
        text: trimmed || (attachment ? `Shared ${attachment.name}` : ""),
        time: formatTimeNow(),
        attachment,
      };

      publish({
        type: "message:new",
        appointmentId: appointment.id,
        actorRole: role,
        messageId: message.id,
        text: message.text,
        time: message.time,
        attachment,
      });

      setState((current) => {
        if (!current.activeAppointment || current.activeAppointment.id !== appointment.id || current.messages.some((item) => item.id === message.id)) {
          return current;
        }

        return {
          ...current,
          messages: [...current.messages, message],
        };
      });
    },
    [publish, role, state.activeAppointment]
  );

  const receiveRealtimeEvent = useCallback((event: RealtimeEvent | null) => {
    if (!event) {
      return;
    }

    if (event.type === "notification:new" || event.type === "doctor:availability-updated" || event.type === "doctor:status-updated") {
      return;
    }

    setState((current) => {
      if (!current.activeAppointment || current.activeAppointment.id !== event.appointmentId) {
        return current;
      }

      if (event.actorRole === role) {
        return current;
      }

      if (event.type === "session:ended") {
        return {
          ...current,
          activeAppointment: null,
          status: "ended",
          roomId: "",
          accessToken: "",
          messages: [
            ...current.messages,
            {
              id: `${event.appointmentId}-ended-${Date.now()}`,
              sender: event.actorRole,
              kind: "system",
              text: "The consultation was ended.",
              time: formatTimeNow(),
            },
          ],
        };
      }

      if (event.type === "media:updated") {
        return {
          ...current,
          counterpartCameraOn: event.cameraOn,
          counterpartMicOn: event.micOn,
        };
      }

      if (event.type === "session:joined") {
        return {
          ...current,
          status: "connected",
          messages: [
            ...current.messages,
            {
              id: `${event.appointmentId}-joined-${Date.now()}`,
              sender: event.actorRole,
              kind: "system",
              text: "Participant joined the live consultation room.",
              time: formatTimeNow(),
            },
          ],
        };
      }

      if (event.type !== "message:new") {
        return current;
      }

      if (current.messages.some((message) => message.id === event.messageId)) {
        return current;
      }

      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: event.messageId,
            sender: event.actorRole,
            kind: "user",
            text: event.text,
            time: event.time,
            attachment: event.attachment,
          },
        ],
      };
    });
  }, [role]);

  return {
    ...state,
    startSession: openWaitingRoom,
    openWaitingRoom,
    enterAuthorizedRoom,
    endSession,
    toggleCamera,
    toggleMic,
    toggleSpeaker,
    sendMessage,
    receiveMessage: receiveRealtimeEvent,
    receiveRealtimeEvent,
  };
}
