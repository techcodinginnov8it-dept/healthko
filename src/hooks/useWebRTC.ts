"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export function useWebRTC({
  roomId,
  role,
  getSocket,
  isCameraOn,
  isMicOn,
  isActive,
}: {
  roomId: string;
  role: "doctor" | "patient";
  getSocket: () => Socket | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  isActive: boolean;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const offerTimerRef = useRef<number | null>(null);
  const mediaStateRef = useRef({ isCameraOn, isMicOn });

  const cleanup = useCallback((socket?: Socket | null) => {
    if (offerTimerRef.current) {
      window.clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }

    socket?.off("webrtc:offer");
    socket?.off("webrtc:answer");
    socket?.off("webrtc:ice-candidate");
    socket?.off("webrtc:peer-ready");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setConnectionState("new");
  }, []);

  // Sync camera track enabled state
  useEffect(() => {
    mediaStateRef.current.isCameraOn = isCameraOn;
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOn;
      });
    }
  }, [isCameraOn, localStream]);

  // Sync microphone track enabled state
  useEffect(() => {
    mediaStateRef.current.isMicOn = isMicOn;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
      });
    }
  }, [isMicOn, localStream]);

  // Handle initialization and signaling lifecycle
  useEffect(() => {
    if (!isActive || !roomId) {
      cleanup();
      setError(null);
      return;
    }

    const socket = getSocket();
    if (!socket) {
      setError("Signaling server not connected");
      return;
    }
    const activeSocket = socket;

    async function init() {
      try {
        setError(null);

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser cannot access camera or microphone devices. Use a current browser on localhost.");
        }

        // 1. Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Apply current toggle state immediately
        stream.getVideoTracks().forEach((track) => {
          track.enabled = mediaStateRef.current.isCameraOn;
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = mediaStateRef.current.isMicOn;
        });

        // 2. Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        pcRef.current = pc;

        // 3. Add local tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 4. Listen for remote stream tracks
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            remoteStreamRef.current = event.streams[0];
            return;
          }

          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
            setRemoteStream(remoteStreamRef.current);
          }

          remoteStreamRef.current.addTrack(event.track);
        };

        pc.onconnectionstatechange = () => {
          if (pcRef.current) {
            setConnectionState(pcRef.current.connectionState);
          }
        };

        // 5. Signal ICE candidates to the other peer
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            activeSocket.emit("webrtc:ice-candidate", { roomId, candidate: event.candidate });
          }
        };

        const createAndSendOffer = async () => {
          const currentPc = pcRef.current;
          if (!currentPc || currentPc.signalingState !== "stable") {
            return;
          }

          const offer = await currentPc.createOffer();
          await currentPc.setLocalDescription(offer);
          activeSocket.emit("webrtc:offer", { roomId, offer });
        };

        // 6. Setup signaling listeners
        activeSocket.on("webrtc:offer", async ({ offer }) => {
          try {
            const currentPc = pcRef.current;
            if (!currentPc) return;

            await currentPc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await currentPc.createAnswer();
            await currentPc.setLocalDescription(answer);
            activeSocket.emit("webrtc:answer", { roomId, answer });
          } catch (err: any) {
            console.error("[WebRTC] Error setting offer / creating answer:", err);
          }
        });

        activeSocket.on("webrtc:answer", async ({ answer }) => {
          try {
            const currentPc = pcRef.current;
            if (!currentPc) return;

            await currentPc.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (err: any) {
            console.error("[WebRTC] Error setting answer:", err);
          }
        });

        activeSocket.on("webrtc:ice-candidate", async ({ candidate }) => {
          try {
            const currentPc = pcRef.current;
            if (!currentPc) return;

            await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err: any) {
            console.error("[WebRTC] Error adding ICE candidate:", err);
          }
        });

        activeSocket.on("webrtc:peer-ready", async ({ role: peerRole }) => {
          if (role !== "doctor" || peerRole !== "patient") {
            return;
          }

          try {
            await createAndSendOffer();
          } catch (err: any) {
            console.error("[WebRTC] Error creating doctor offer after peer-ready:", err);
          }
        });

        // 7. Join video room
        activeSocket.emit("webrtc:join-room", { roomId });
        activeSocket.emit("webrtc:peer-ready", { roomId, role });

        // 8. Patient keeps a fallback initiator in case the ready signal is missed.
        if (role === "patient") {
          offerTimerRef.current = window.setTimeout(async () => {
            try {
              await createAndSendOffer();
            } catch (err: any) {
              console.error("[WebRTC] Error creating initiator offer:", err);
            }
          }, 1000);
        }

      } catch (err: unknown) {
        console.error("[WebRTC] Initializing getUserMedia or RTCPeerConnection failed:", err);
        if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
          setError("Camera or microphone permission was blocked. Allow access in your browser, then rejoin the consultation.");
          return;
        }

        if (err instanceof DOMException && (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")) {
          setError("No camera or microphone was found. Connect a device, then rejoin the consultation.");
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to access camera or microphone. Please check permissions.");
      }
    }

    init();

    return () => {
      cleanup(socket);
    };
  }, [cleanup, getSocket, isActive, role, roomId]);

  return { localStream, remoteStream, connectionState, error };
}
