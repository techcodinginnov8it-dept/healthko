"use client";

import { useCallback, useState } from "react";
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

export function useConsultationSession<TAppointment extends { id: string }>({
  role,
  publish,
}: {
  role: DashboardRole;
  publish: (event: RealtimeEvent) => void;
}) {
  const [state, setState] = useState<SessionState<TAppointment>>({
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
  });

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
            text: nextStatus === "waiting" ? "Secure room opened. Waiting for the patient to join." : "Secure WebRTC room access authorized.",
            time: formatTimeNow(),
          },
        ],
      }));
    },
    [role]
  );

  const endSession = useCallback((broadcast = true) => {
    setState((current) => {
      if (broadcast && current.activeAppointment) {
        publish({
          type: "session:ended",
          appointmentId: current.activeAppointment.id,
          actorRole: role,
        });
      }

      return {
        ...current,
        activeAppointment: null,
        status: "ended",
        roomId: "",
        accessToken: "",
      };
    });
  }, [publish, role]);

  const toggleCamera = useCallback(() => {
    setState((current) => {
      const isCameraOn = !current.isCameraOn;
      if (current.activeAppointment) {
        publish({
          type: "media:updated",
          appointmentId: current.activeAppointment.id,
          actorRole: role,
          cameraOn: isCameraOn,
          micOn: current.isMicOn,
        });
      }
      return { ...current, isCameraOn };
    });
  }, [publish, role]);

  const toggleMic = useCallback(() => {
    setState((current) => {
      const isMicOn = !current.isMicOn;
      if (current.activeAppointment) {
        publish({
          type: "media:updated",
          appointmentId: current.activeAppointment.id,
          actorRole: role,
          cameraOn: current.isCameraOn,
          micOn: isMicOn,
        });
      }
      return { ...current, isMicOn };
    });
  }, [publish, role]);

  const toggleSpeaker = useCallback(() => {
    setState((current) => ({ ...current, isSpeakerReady: !current.isSpeakerReady }));
  }, []);

  const sendMessage = useCallback(
    (text: string, attachment?: ChatAttachment) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) {
        return;
      }

      setState((current) => {
        if (!current.activeAppointment) {
          return current;
        }

        const message: ChatMessage = {
          id: `${current.activeAppointment.id}-${Date.now()}`,
          sender: role,
          text: trimmed || (attachment ? `Shared ${attachment.name}` : ""),
          time: formatTimeNow(),
          attachment,
        };

        publish({
          type: "message:new",
          appointmentId: current.activeAppointment.id,
          actorRole: role,
          messageId: message.id,
          text: message.text,
          time: message.time,
          attachment,
        });

        return {
          ...current,
          messages: [...current.messages, message],
        };
      });
    },
    [publish, role]
  );

  const receiveRealtimeEvent = useCallback((event: RealtimeEvent | null) => {
    if (!event) {
      return;
    }

    if (event.type === "notification:new") {
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
