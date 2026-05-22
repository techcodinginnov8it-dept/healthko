"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import type { RealtimeEvent } from "@/lib/dashboard/types";

const SOCKET_PATH = "/api/socket";

type ConnectionState = "connected" | "reconnecting" | "offline";

function getConnectionSnapshot(): ConnectionState {
  return navigator.onLine ? "connected" : "offline";
}

export function useDashboardRealtime(onEvent?: (event: RealtimeEvent) => void) {
  const connectionState = useSyncExternalStore<ConnectionState>(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);

      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    getConnectionSnapshot,
    () => "connected"
  );
  const [reconnectState, setReconnectState] = useState<ConnectionState | null>(null);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const seenEventKeysRef = useRef(new Set<string>());

  const getEventKey = useCallback((event: RealtimeEvent) => {
    if (event.type === "message:new") {
      return `message:new:${event.messageId}`;
    }

    return null;
  }, []);

  const commitEvent = useCallback(
    (event: RealtimeEvent) => {
      const key = getEventKey(event);
      if (key && seenEventKeysRef.current.has(key)) {
        return;
      }

      if (key) {
        seenEventKeysRef.current.add(key);
        if (seenEventKeysRef.current.size > 300) {
          const oldestKey = seenEventKeysRef.current.values().next().value;
          if (oldestKey) {
            seenEventKeysRef.current.delete(oldestKey);
          }
        }
      }

      setLastEvent(event);
      onEvent?.(event);
    },
    [getEventKey, onEvent]
  );

  useEffect(() => {
    const socket = io({
      path: SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    const handleMessage = (event: RealtimeEvent) => commitEvent(event);

    socket.on("dashboard:event", handleMessage);
    socket.on("reconnect_attempt", () => setReconnectState("reconnecting"));
    socket.on("connect", () => setReconnectState(null));
    socket.on("connect_error", () => setReconnectState("offline"));
    socket.on("disconnect", () => setReconnectState("offline"));

    return () => {
      socket.off("dashboard:event", handleMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [commitEvent]);

  const publish = useCallback(
    (event: RealtimeEvent) => {
      commitEvent(event);
      socketRef.current?.emit("dashboard:event", event);
    },
    [commitEvent]
  );

  const simulateReconnect = useCallback(() => {
    setReconnectState("reconnecting");
    window.setTimeout(() => setReconnectState(null), 900);
  }, []);

  const joinVideoRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("webrtc:join-room", { roomId });
  }, []);

  return {
    connectionState: reconnectState || connectionState,
    lastEvent,
    publish,
    joinVideoRoom,
    simulateReconnect,
  };
}
