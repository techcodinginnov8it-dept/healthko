"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

type DeviceStatus = {
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
  permissionState: PermissionState | "unknown";
  message: string | null;
};

type PendingIceCandidate = RTCIceCandidateInit | RTCIceCandidate;

function getMediaErrorMessage(err: unknown) {
  if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
    return "Camera or microphone permission was blocked. Allow access in your browser, then rejoin the consultation.";
  }

  if (
    err instanceof DOMException &&
    (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError")
  ) {
    return "No matching camera or microphone was found. You can still receive the other participant's stream, or connect a device and rejoin.";
  }

  return err instanceof Error
    ? err.message
    : "Failed to access camera or microphone. Please check permissions.";
}

function getInsecureContextMessage() {
  return "Camera and microphone require a secure browser context. Use localhost on this computer or open the consultation through an HTTPS tunnel on your phone.";
}

function getEmptyDeviceStatus(): DeviceStatus {
  return {
    cameraAvailable: false,
    microphoneAvailable: false,
    permissionState: "unknown",
    message: null,
  };
}

export function useWebRTC({
  roomId,
  role,
  getSocket,
  isCameraOn,
  isMicOn,
  isActive,
  signalingReady = true,
  onRemoteSessionEnded,
}: {
  roomId: string;
  role: "doctor" | "patient";
  getSocket: () => Socket | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  isActive: boolean;
  signalingReady?: boolean;
  onRemoteSessionEnded?: () => void;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(() => getEmptyDeviceStatus());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const offerTimerRef = useRef<number | null>(null);
  const mediaStateRef = useRef({ isCameraOn, isMicOn });
  const onRemoteSessionEndedRef = useRef(onRemoteSessionEnded);
  const pendingIceCandidatesRef = useRef<PendingIceCandidate[]>([]);

  useEffect(() => {
    onRemoteSessionEndedRef.current = onRemoteSessionEnded;
  }, [onRemoteSessionEnded]);

  const refreshDevices = useCallback(async () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getInsecureContextMessage();
      setDeviceStatus({
        cameraAvailable: false,
        microphoneAvailable: false,
        permissionState: "unknown",
        message,
      });
      return [];
    }

    if (!navigator.mediaDevices?.enumerateDevices) {
      setDeviceStatus({
        cameraAvailable: false,
        microphoneAvailable: false,
        permissionState: "unknown",
        message: "This browser cannot enumerate camera or microphone devices.",
      });
      return [];
    }

    try {
      const availableDevices = await navigator.mediaDevices.enumerateDevices();
      const cameraAvailable = availableDevices.some((device) => device.kind === "videoinput");
      const microphoneAvailable = availableDevices.some((device) => device.kind === "audioinput");
      let permissionState: DeviceStatus["permissionState"] = "unknown";

      try {
        const cameraPermission = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
        const microphonePermission = await navigator.permissions?.query?.({ name: "microphone" as PermissionName });
        permissionState =
          cameraPermission?.state === "denied" || microphonePermission?.state === "denied"
            ? "denied"
            : cameraPermission?.state === "granted" || microphonePermission?.state === "granted"
              ? "granted"
              : "prompt";
      } catch {
        permissionState = "unknown";
      }

      setDevices(availableDevices);
      setDeviceStatus({
        cameraAvailable,
        microphoneAvailable,
        permissionState,
        message:
          cameraAvailable || microphoneAvailable
            ? null
            : "No camera or microphone was detected. Connect a device or check browser permissions.",
      });

      return availableDevices;
    } catch (err: unknown) {
      const message = getMediaErrorMessage(err);
      setDeviceStatus({
        cameraAvailable: false,
        microphoneAvailable: false,
        permissionState: "unknown",
        message,
      });
      return [];
    }
  }, []);

  const cleanup = useCallback((socket?: Socket | null) => {
    if (offerTimerRef.current) {
      window.clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }

    socket?.off("webrtc:offer");
    socket?.off("webrtc:answer");
    socket?.off("webrtc:ice-candidate");
    socket?.off("webrtc:peer-ready");
    socket?.off("webrtc:peer-ready-request");
    socket?.off("webrtc:session-ended");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    pendingIceCandidatesRef.current = [];

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setConnectionState("new");
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      void refreshDevices();
    });

    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshDevices();
      setError("Camera or microphone devices changed. Rechecking media connection...");
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

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
      window.queueMicrotask(() => {
        cleanup();
        setError(null);
      });
      return;
    }

    async function getLocalMedia() {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        const message = getInsecureContextMessage();
        setError(message);
        setDeviceStatus({
          cameraAvailable: false,
          microphoneAvailable: false,
          permissionState: "unknown",
          message,
        });
        return new MediaStream();
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "This browser cannot access camera or microphone devices. Use a current browser on localhost or HTTPS.";
        setError(message);
        setDeviceStatus({
          cameraAvailable: false,
          microphoneAvailable: false,
          permissionState: "unknown",
          message,
        });
        return new MediaStream();
      }

      const buildConstraints = (includeVideo: boolean, includeAudio: boolean): MediaStreamConstraints => ({
        video: includeVideo
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user",
              ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : {}),
            }
          : false,
        audio: includeAudio ? (microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true) : false,
      });

      try {
        return await navigator.mediaDevices.getUserMedia(buildConstraints(true, true));
      } catch (err: unknown) {
        const message = getMediaErrorMessage(err);
        setError(message);

        if (
          err instanceof DOMException &&
          (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError")
        ) {
          try {
            return await navigator.mediaDevices.getUserMedia(buildConstraints(false, true));
          } catch {
            try {
              return await navigator.mediaDevices.getUserMedia(buildConstraints(true, false));
            } catch {
              return new MediaStream();
            }
          }
        }

        return new MediaStream();
      }
    }

    async function init() {
      try {
        setError(null);

        // 1. Get user media when available. Missing local devices should not prevent receiving the remote stream.
        const stream = await getLocalMedia();
        setLocalStream(stream);
        localStreamRef.current = stream;
        void refreshDevices();

        // Apply current toggle state immediately
        stream.getVideoTracks().forEach((track) => {
          track.enabled = mediaStateRef.current.isCameraOn;
          track.onended = () => {
            setError("Camera disconnected or stopped. Reconnect the camera or switch devices.");
            void refreshDevices();
          };
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = mediaStateRef.current.isMicOn;
          track.onended = () => {
            setError("Microphone disconnected or stopped. Reconnect the microphone or switch devices.");
            void refreshDevices();
          };
        });

        // 2. Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        pcRef.current = pc;

        // 3. Always negotiate audio/video receive lines, then attach local tracks when available.
        const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
        const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
          await videoTransceiver.sender.replaceTrack(videoTrack);
        }

        if (audioTrack) {
          await audioTransceiver.sender.replaceTrack(audioTrack);
        }

        pc.oniceconnectionstatechange = () => {
          if (pcRef.current?.iceConnectionState === "failed") {
            void pcRef.current.restartIce();
          }
        };

        // 4. Listen for remote stream tracks
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            remoteStreamRef.current = event.streams[0];
            return;
          }

          const existingTracks = remoteStreamRef.current?.getTracks() || [];
          if (existingTracks.some((track) => track.id === event.track.id)) {
            return;
          }

          const nextStream = new MediaStream([...existingTracks, event.track]);
          remoteStreamRef.current = nextStream;
          setRemoteStream(nextStream);
        };

        pc.onconnectionstatechange = () => {
          if (pcRef.current) {
            setConnectionState(pcRef.current.connectionState);
          }
        };

        // 5. Signal ICE candidates to the other peer
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const activeSocket = getSocket();
            if (!activeSocket) {
              return;
            }
            activeSocket.emit("webrtc:ice-candidate", { roomId, candidate: event.candidate });
          }
        };

        const createAndSendOffer = async () => {
          const currentPc = pcRef.current;
          const activeSocket = getSocket();
          if (!currentPc || currentPc.signalingState !== "stable") {
            return;
          }
          if (!activeSocket) {
            setError("Camera is ready. Waiting for realtime signaling to reconnect...");
            return;
          }

          const offer = await currentPc.createOffer();
          await currentPc.setLocalDescription(offer);
          activeSocket.emit("webrtc:offer", { roomId, offer });
        };

        const scheduleDoctorOffer = (delay = 250) => {
          if (role !== "doctor") {
            return;
          }

          if (offerTimerRef.current) {
            window.clearTimeout(offerTimerRef.current);
          }

          offerTimerRef.current = window.setTimeout(() => {
            offerTimerRef.current = null;
            void createAndSendOffer().catch((err: unknown) => {
              console.error("[WebRTC] Error creating scheduled doctor offer:", err);
            });
          }, delay);
        };

        // 6. Setup signaling listeners
        const flushPendingIceCandidates = async () => {
          const currentPc = pcRef.current;
          if (!currentPc?.remoteDescription) {
            return;
          }

          const candidates = pendingIceCandidatesRef.current.splice(0);
          for (const candidate of candidates) {
            try {
              await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err: unknown) {
              console.error("[WebRTC] Error adding queued ICE candidate:", err);
            }
          }
        };

        const activeSocket = getSocket();
        if (!activeSocket || !signalingReady) {
          setError("Camera is ready. Waiting for realtime signaling to reconnect...");
          return;
        }

        activeSocket.on("webrtc:offer", async ({ offer }) => {
          try {
            const currentPc = pcRef.current;
            if (!currentPc) return;
            const offerCollision = currentPc.signalingState !== "stable";

            if (offerCollision && role === "doctor") {
              return;
            }

            if (offerCollision) {
              await currentPc.setLocalDescription({ type: "rollback" });
            }

            await currentPc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await currentPc.createAnswer();
            await currentPc.setLocalDescription(answer);
            activeSocket.emit("webrtc:answer", { roomId, answer });
            await flushPendingIceCandidates();
          } catch (err: unknown) {
            console.error("[WebRTC] Error setting offer / creating answer:", err);
          }
        });

        activeSocket.on("webrtc:answer", async ({ answer }) => {
          try {
            const currentPc = pcRef.current;
            if (!currentPc) return;
            if (currentPc.signalingState !== "have-local-offer") return;

            await currentPc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushPendingIceCandidates();
          } catch (err: unknown) {
            console.error("[WebRTC] Error setting answer:", err);
          }
        });

        activeSocket.on("webrtc:ice-candidate", async ({ candidate }) => {
          try {
            const currentPc = pcRef.current;
            if (!currentPc) return;
            if (!currentPc.remoteDescription) {
              pendingIceCandidatesRef.current.push(candidate);
              return;
            }

            await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err: unknown) {
            console.error("[WebRTC] Error adding ICE candidate:", err);
          }
        });

        activeSocket.on("webrtc:peer-ready", async ({ role: peerRole }) => {
          if (role !== "doctor" || peerRole !== "patient") {
            return;
          }

          scheduleDoctorOffer();
        });

        activeSocket.on("webrtc:peer-ready-request", () => {
          activeSocket.emit("webrtc:peer-ready", { roomId, role });
          scheduleDoctorOffer(500);
        });

        activeSocket.on("webrtc:session-ended", () => {
          onRemoteSessionEndedRef.current?.();
        });

        // 7. Join video room
        activeSocket.emit("webrtc:join-room", { roomId });
        activeSocket.emit("webrtc:peer-ready", { roomId, role });
        activeSocket.emit("webrtc:peer-ready-request", { roomId });
        scheduleDoctorOffer(900);

      } catch (err: unknown) {
        console.warn("[WebRTC] Initialization failed:", err);
        setError(getMediaErrorMessage(err));
      }
    }

    init();

    return () => {
      cleanup(getSocket());
    };
  }, [cameraDeviceId, cleanup, getSocket, isActive, microphoneDeviceId, refreshDevices, role, roomId, signalingReady]);

  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    devices,
    cameraDeviceId,
    microphoneDeviceId,
    deviceStatus,
    setCameraDeviceId,
    setMicrophoneDeviceId,
    refreshDevices,
  };
}
