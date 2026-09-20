import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  MonitorSmartphone,
} from "lucide-react";

import {
  subscribeToSession,
} from "../services/realtime";

import {
  listWebrtcSignals,
  publishWebrtcSignal,
  startRemoteSession,
} from "../services/backend";

/**
 * STUN + optional TURN relay.
 * TURN values can be supplied through Vite environment variables.
 */
const ICE_SERVERS = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
    ],
  },
];

const TURN_URL = (import.meta.env.VITE_TURN_URL || "").trim();
if (TURN_URL) {
  ICE_SERVERS.push({
    urls: TURN_URL,
    ...(import.meta.env.VITE_TURN_USERNAME
      ? { username: import.meta.env.VITE_TURN_USERNAME }
      : {}),
    ...(import.meta.env.VITE_TURN_CREDENTIAL
      ? { credential: import.meta.env.VITE_TURN_CREDENTIAL }
      : {}),
  });
}

function candidateKey(
  candidate,
) {
  if (!candidate) {
    return "";
  }

  return [
    candidate.candidate || "",
    candidate.sdpMid ?? "",
    candidate.sdpMLineIndex ?? "",
  ].join("|");
}

function normalizedPoint(
  video,
  clientX,
  clientY,
) {
  if (
    !video?.videoWidth ||
    !video?.videoHeight
  ) {
    return null;
  }

  const rect =
    video.getBoundingClientRect();

  if (
    !rect.width ||
    !rect.height
  ) {
    return null;
  }

  const videoRatio =
    video.videoWidth /
    video.videoHeight;

  const boxRatio =
    rect.width /
    rect.height;

  let width;
  let height;
  let offsetX;
  let offsetY;

  if (
    boxRatio >
    videoRatio
  ) {
    height =
      rect.height;

    width =
      height *
      videoRatio;

    offsetX =
      (rect.width -
        width) /
      2;

    offsetY =
      0;
  } else {
    width =
      rect.width;

    height =
      width /
      videoRatio;

    offsetX =
      0;

    offsetY =
      (rect.height -
        height) /
      2;
  }

  const localX =
    clientX -
    rect.left -
    offsetX;

  const localY =
    clientY -
    rect.top -
    offsetY;

  if (
    localX < 0 ||
    localY < 0 ||
    localX > width ||
    localY > height
  ) {
    return null;
  }

  return {
    x: Math.max(
      0,
      Math.min(
        1,
        localX / width,
      ),
    ),

    y: Math.max(
      0,
      Math.min(
        1,
        localY /
          height,
      ),
    ),
  };
}

export default function RemoteScreenStream({
  sessionId,
  controlEnabled = false,
  localUserId = null,
  onError,
  onControlStateChange,
  onStreamStateChange,
}) {
  const videoRef =
    useRef(null);

  const peerRef =
    useRef(null);

  const pendingCandidatesRef =
    useRef([]);

  const pointerStartRef =
    useRef(null);

  const seenSignalIdsRef =
    useRef(
      new Set(),
    );

  const seenRemoteIceRef =
    useRef(
      new Set(),
    );

  const appliedOfferSdpRef =
    useRef(null);

  const offerApplyingRef =
    useRef(false);

  const signalPollingRef =
    useRef(null);

  const signalRefreshInFlightRef =
    useRef(false);

  const receivedVideoTrackRef =
    useRef(false);

  const noVideoTimerRef =
    useRef(null);

  const controlChannelRef =
    useRef(null);

  const pendingControlRef =
    useRef(new Map());

  const onErrorRef =
    useRef(onError);

  const onControlStateChangeRef =
    useRef(onControlStateChange);

  const onStreamStateChangeRef =
    useRef(onStreamStateChange);

  const [
    controlReady,
    setControlReady,
  ] = useState(false);

  const [
    state,
    setState,
  ] = useState(
    "waiting",
  );

  useEffect(() => {
    onErrorRef.current =
      onError;
  }, [onError]);

  useEffect(() => {
    onControlStateChangeRef.current = onControlStateChange;
  }, [onControlStateChange]);

  useEffect(() => {
    onStreamStateChangeRef.current = onStreamStateChange;
  }, [onStreamStateChange]);

  useEffect(() => {
    onStreamStateChangeRef.current?.(state);
  }, [state]);

  function sendControlCommand(command) {
    return new Promise((resolve, reject) => {
      const channel = controlChannelRef.current;

      if (!channel || channel.readyState !== "open") {
        reject(
          new Error(
            "Remote control channel is not ready yet. Wait a moment and try again.",
          ),
        );
        return;
      }

      const requestId =
        globalThis.crypto?.randomUUID?.() ||
        `ctl-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const timer = window.setTimeout(() => {
        const pending = pendingControlRef.current.get(requestId);
        if (!pending) return;
        pendingControlRef.current.delete(requestId);
        pending.reject(new Error("Android did not acknowledge the remote action."));
      }, 5000);

      pendingControlRef.current.set(requestId, { resolve, reject, timer });

      try {
        channel.send(
          JSON.stringify({
            ...command,
            requestId,
          }),
        );
      } catch (error) {
        window.clearTimeout(timer);
        pendingControlRef.current.delete(requestId);
        reject(error);
      }
    });
  }

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    console.log(
      "AirLink Web: starting remote screen receiver:",
      sessionId,
    );

    console.log(
      TURN_URL
        ? "AirLink Web ICE configuration: STUN + TURN"
        : "AirLink Web ICE configuration: STUN only",
    );

    let cancelled =
      false;

    let unsubscribe =
      () => {};

    const peer =
      new RTCPeerConnection(
        {
          iceServers:
            ICE_SERVERS,
        },
      );

    peerRef.current =
      peer;

    pendingCandidatesRef.current =
      [];

    seenSignalIdsRef.current =
      new Set();

    seenRemoteIceRef.current =
      new Set();

    appliedOfferSdpRef.current =
      null;

    offerApplyingRef.current =
      false;

    signalRefreshInFlightRef.current =
      false;

    receivedVideoTrackRef.current =
      false;

    if (noVideoTimerRef.current) {
      window.clearTimeout(
        noVideoTimerRef.current,
      );
      noVideoTimerRef.current =
        null;
    }

    setControlReady(false);
    onControlStateChangeRef.current?.(false);

    setState(
      "waiting",
    );

    const reportError =
      (error) => {
        const normalized =
          error instanceof
          Error
            ? error
            : new Error(
                String(
                  error,
                ),
              );

        console.error(
          "AirLink WebRTC error:",
          normalized,
        );

        onErrorRef.current?.(
          normalized,
        );
      };

    const attachControlChannel = (channel) => {
      if (!channel) return;

      console.log(
        "AirLink Web: remote control data channel received:",
        channel.label,
      );

      controlChannelRef.current = channel;

      const markOpen = () => {
        console.log("AirLink Web: remote control channel open.");
        setControlReady(true);
        onControlStateChangeRef.current?.(true);
      };

      channel.onopen = markOpen;

      channel.onclose = () => {
        console.log("AirLink Web: remote control channel closed.");
        if (controlChannelRef.current === channel) {
          controlChannelRef.current = null;
        }
        setControlReady(false);
        onControlStateChangeRef.current?.(false);
      };

      // ondatachannel may fire after the channel is already open on fast local
      // connections, so do not rely exclusively on a future `open` event.
      if (channel.readyState === "open") {
        markOpen();
      }

      channel.onerror = (event) => {
        console.warn("AirLink Web: remote control channel error:", event);
      };

      channel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== "ack" || !payload?.requestId) return;

          const pending = pendingControlRef.current.get(payload.requestId);
          if (!pending) return;

          pendingControlRef.current.delete(payload.requestId);
          window.clearTimeout(pending.timer);

          if (payload.success) {
            pending.resolve(payload);
          } else {
            pending.reject(
              new Error(payload.error || "Android rejected the remote action."),
            );
          }
        } catch (error) {
          console.warn("AirLink Web: invalid control acknowledgement:", error);
        }
      };
    };

    peer.ondatachannel = (event) => {
      attachControlChannel(event.channel);
    };

    const externalControlHandler = (event) => {
      const detail = event.detail;
      if (!detail || detail.sessionId !== sessionId || !detail.command) return;

      sendControlCommand(detail.command).catch(reportError);
    };

    window.addEventListener(
      "airlink:remote-control",
      externalControlHandler,
    );

    peer.onicecandidate =
      (event) => {
        if (
          !event.candidate
        ) {
          console.log(
            "AirLink Web: local ICE gathering complete.",
          );

          return;
        }

        const payload =
          typeof event
            .candidate
            .toJSON ===
          "function"
            ? event.candidate.toJSON()
            : {
                candidate:
                  event
                    .candidate
                    .candidate,

                sdpMid:
                  event
                    .candidate
                    .sdpMid,

                sdpMLineIndex:
                  event
                    .candidate
                    .sdpMLineIndex,

                usernameFragment:
                  event
                    .candidate
                    .usernameFragment,
              };

        console.log(
          "AirLink Web: sending ICE candidate",
        );

        publishWebrtcSignal(
          sessionId,
          "ice",
          payload,
        ).catch(
          reportError,
        );
      };

    peer.onicegatheringstatechange =
      () => {
        console.log(
          "AirLink Web ICE gathering state:",
          peer.iceGatheringState,
        );
      };

    peer.oniceconnectionstatechange =
      () => {
        console.log(
          "AirLink Web ICE connection state:",
          peer.iceConnectionState,
        );
      };

    peer.onsignalingstatechange =
      () => {
        console.log(
          "AirLink Web signaling state:",
          peer.signalingState,
        );
      };

    peer.ontrack =
      (event) => {
        if (
          cancelled
        ) {
          return;
        }

        console.log(
          "AirLink Web: remote media track received:",
          event.track
            ?.kind,
        );

        let stream =
          event.streams?.[
            0
          ];

        /**
         * Some WebRTC implementations
         * may not populate streams[].
         */
        if (!stream) {
          stream =
            new MediaStream();

          stream.addTrack(
            event.track,
          );
        }

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            stream;

          videoRef.current
            .play()
            .catch(
              (error) => {
                console.warn(
                  "AirLink Web: video play failed:",
                  error,
                );
              },
            );
        }

        receivedVideoTrackRef.current =
          event.track?.kind ===
          "video";

        if (noVideoTimerRef.current) {
          window.clearTimeout(
            noVideoTimerRef.current,
          );
          noVideoTimerRef.current =
            null;
        }

        setState(
          "live",
        );
      };

    peer.onconnectionstatechange =
      () => {
        if (
          cancelled
        ) {
          return;
        }

        const connectionState =
          peer.connectionState;

        console.log(
          "AirLink WebRTC connection state:",
          connectionState,
        );

        if (
          connectionState ===
          "connected"
        ) {
          if (
            receivedVideoTrackRef.current
          ) {
            setState(
              "live",
            );
          } else {
            // Transport can connect through the data/ICE path even when the
            // remote SDP did not negotiate a screen video track. Do not hide
            // the waiting UI until an actual video track is received.
            setState(
              "connecting",
            );

            if (
              !noVideoTimerRef.current
            ) {
              noVideoTimerRef.current =
                window.setTimeout(
                  () => {
                    if (
                      !cancelled &&
                      !receivedVideoTrackRef.current
                    ) {
                      reportError(
                        new Error(
                          "WebRTC connected, but Android did not send a screen video track. Start a new session after updating the viewer.",
                        ),
                      );
                    }
                  },
                  8000,
                );
            }
          }

          return;
        }

        if (
          connectionState ===
            "new" ||
          connectionState ===
            "connecting"
        ) {
          setState(
            "connecting",
          );

          return;
        }

        if (
          connectionState ===
          "disconnected"
        ) {
          console.warn(
            "AirLink Web: peer temporarily disconnected.",
          );

          setState(
            "connecting",
          );

          return;
        }

        if (
          connectionState ===
          "failed"
        ) {
          setState(
            "failed",
          );

          reportError(
            new Error(
              "WebRTC connection failed.",
            ),
          );
        }
      };

    async function addRemoteCandidate(
      candidate,
    ) {
      if (
        cancelled ||
        !candidate
      ) {
        return;
      }

      const key =
        candidateKey(
          candidate,
        );

      if (
        key &&
        seenRemoteIceRef.current.has(
          key,
        )
      ) {
        return;
      }

      /**
       * Queue candidate until mobile offer
       * has been applied.
       */
      if (
        !peer.remoteDescription
      ) {
        if (key) {
          seenRemoteIceRef.current.add(
            key,
          );
        }

        pendingCandidatesRef.current.push(
          candidate,
        );

        return;
      }

      try {
        await peer.addIceCandidate(
          new RTCIceCandidate(
            candidate,
          ),
        );

        if (key) {
          seenRemoteIceRef.current.add(
            key,
          );
        }
      } catch (error) {
        if (key) {
          seenRemoteIceRef.current.delete(
            key,
          );
        }

        console.warn(
          "AirLink Web: failed to add ICE candidate:",
          error,
        );

        throw error;
      }
    }

    async function flushCandidates() {
      if (
        !peer.remoteDescription
      ) {
        return;
      }

      const queued =
        pendingCandidatesRef.current;

      pendingCandidatesRef.current =
        [];

      for (
        const candidate of queued
      ) {
        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(
              candidate,
            ),
          );
        } catch (error) {
          console.warn(
            "AirLink Web: failed to add queued ICE candidate:",
            error,
          );
        }
      }
    }

    async function handleOffer(
      payload,
      signalId,
    ) {
      if (
        cancelled ||
        !payload?.sdp
      ) {
        return;
      }

      const offerSdp =
        String(
          payload.sdp,
        );

      /**
       * Socket + DB polling duplicate
       * protection.
       */
      if (
        appliedOfferSdpRef.current ===
        offerSdp
      ) {
        console.log(
          "AirLink Web: duplicate WebRTC offer ignored.",
        );

        if (signalId) {
          seenSignalIdsRef.current.add(
            signalId,
          );
        }

        return;
      }

      if (
        offerApplyingRef.current
      ) {
        console.log(
          "AirLink Web: offer already being processed.",
        );

        return;
      }

      /**
       * Browser is answerer.
       * Initial offer must arrive in stable state.
       */
      if (
        peer.signalingState !==
        "stable"
      ) {
        console.warn(
          "AirLink Web: cannot apply remote offer in state:",
          peer.signalingState,
        );

        return;
      }

      offerApplyingRef.current =
        true;

      try {
        setState(
          "connecting",
        );

        console.log(
          "AirLink Web: applying mobile offer.",
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            {
              type:
                "offer",

              sdp:
                offerSdp,
            },
          ),
        );

        console.log(
          "AirLink Web: remote offer applied.",
        );

        await flushCandidates();

        const answer =
          await peer.createAnswer();

        /**
         * Browser local answer first.
         */
        await peer.setLocalDescription(
          answer,
        );

        console.log(
          "AirLink Web: local answer applied. signalingState:",
          peer.signalingState,
        );

        /**
         * Publish answer afterwards.
         */
        // Persist the answer over REST so Android can receive it through
        // its deployed polling channel even when Socket.IO/WebSocket is not
        // available on the hosting path.
        await publishWebrtcSignal(
          sessionId,
          "answer",
          {
            type:
              answer.type,

            sdp:
              answer.sdp,
          },
        );

        // The Android client is the offerer in this flow, so the browser
        // answer completes signaling. Promote the approved session to active.
        try {
          await startRemoteSession(
            sessionId,
          );
        } catch (startError) {
          // A duplicate/late start is harmless if another path already made
          // the session active. Surface all other errors.
          if (startError?.status !== 409) {
            throw startError;
          }
        }

        appliedOfferSdpRef.current =
          offerSdp;

        if (signalId) {
          seenSignalIdsRef.current.add(
            signalId,
          );
        }

        console.log(
          "AirLink Web: SDP answer published.",
        );
      } catch (error) {
        console.error(
          "AirLink Web: failed to process offer:",
          error,
        );

        throw error;
      } finally {
        offerApplyingRef.current =
          false;
      }
    }

    async function handleSignal(
      signal,
    ) {
      if (
        cancelled
      ) {
        return;
      }

      /**
       * Ignore our own signals.
       */
      if (
        localUserId &&
        signal?.senderUserId ===
          localUserId
      ) {
        return;
      }

      const rawSignalId =
        signal?.signalId ??
        signal?.id;

      const signalId =
        rawSignalId != null
          ? String(
              rawSignalId,
            )
          : null;

      if (
        signalId &&
        seenSignalIdsRef.current.has(
          signalId,
        )
      ) {
        return;
      }

      if (
        signal.signalType ===
        "offer"
      ) {
        await handleOffer(
          signal.payload,
          signalId,
        );

        return;
      }

      if (
        (
          signal.signalType ===
            "ice" ||
          signal.signalType ===
            "ice-candidate"
        ) &&
        signal.payload
      ) {
        await addRemoteCandidate(
          signal.payload,
        );

        if (signalId) {
          seenSignalIdsRef.current.add(
            signalId,
          );
        }
      }
    }

    async function refreshPersistedSignals() {
      if (
        cancelled ||
        signalRefreshInFlightRef.current
      ) {
        return;
      }

      signalRefreshInFlightRef.current =
        true;

      try {
        const rows =
          await listWebrtcSignals(
            sessionId,
          );

        if (
          cancelled ||
          !Array.isArray(
            rows,
          )
        ) {
          return;
        }

        for (
          const row of rows
        ) {
          if (
            localUserId &&
            row.sender_user_id ===
              localUserId
          ) {
            continue;
          }

          await handleSignal(
            {
              id:
                row.id,

              signalId:
                row.id,

              senderUserId:
                row.sender_user_id,

              signalType:
                row.signal_type,

              payload:
                row.payload,
            },
          );
        }
      } finally {
        signalRefreshInFlightRef.current =
          false;
      }
    }

    subscribeToSession(
      sessionId,
      {
        onSignal:
          (signal) => {
            handleSignal(
              signal,
            ).catch(
              reportError,
            );
          },

        onError:
          reportError,
      },
    )
      .then(
        (cleanup) => {
          if (
            cancelled
          ) {
            cleanup();

            return;
          }

          unsubscribe =
            cleanup;

          return refreshPersistedSignals();
        },
      )
      .then(() => {
        if (
          cancelled
        ) {
          return;
        }

        /**
         * Database fallback.
         */
        signalPollingRef.current =
          window.setInterval(
            () => {
              refreshPersistedSignals().catch(
                reportError,
              );
            },
            1500,
          );
      })
      .catch(
        reportError,
      );

    // Android is the sole WebRTC offerer. It starts screen capture after the
    // owner presses Accept, publishes an SDP offer containing the screen video
    // track, and this browser answers it. Keeping a single offerer avoids SDP
    // glare (both peers creating offers at the same time).
    console.log(
      "AirLink Web: waiting for Android screen offer.",
    );

    return () => {
      cancelled =
        true;

      unsubscribe();

      if (
        signalPollingRef.current
      ) {
        window.clearInterval(
          signalPollingRef.current,
        );
      }

      signalPollingRef.current =
        null;

      signalRefreshInFlightRef.current =
        false;

      pendingCandidatesRef.current =
        [];

      seenSignalIdsRef.current.clear();

      seenRemoteIceRef.current.clear();

      appliedOfferSdpRef.current =
        null;

      offerApplyingRef.current =
        false;

      pointerStartRef.current =
        null;

      receivedVideoTrackRef.current =
        false;

      if (noVideoTimerRef.current) {
        window.clearTimeout(
          noVideoTimerRef.current,
        );
        noVideoTimerRef.current =
          null;
      }

      window.removeEventListener(
        "airlink:remote-control",
        externalControlHandler,
      );

      for (const pending of pendingControlRef.current.values()) {
        window.clearTimeout(pending.timer);
        pending.reject(new Error("Remote session closed."));
      }
      pendingControlRef.current.clear();
      controlChannelRef.current = null;
      setControlReady(false);
      onControlStateChangeRef.current?.(false);

      try {
        peer.close();
      } catch {}

      peerRef.current =
        null;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }

      console.log(
        "AirLink Web: peer closed.",
      );
    };
  }, [
    sessionId,
    localUserId,
  ]);

  function pointerDown(
    event,
  ) {
    if (
      !controlEnabled ||
      !controlReady ||
      state !== "live"
    ) {
      return;
    }

    const point =
      normalizedPoint(
        videoRef.current,
        event.clientX,
        event.clientY,
      );

    if (!point) {
      return;
    }

    event.currentTarget
      .setPointerCapture?.(
        event.pointerId,
      );

    pointerStartRef.current =
      {
        ...point,

        startedAt:
          performance.now(),

        pointerId:
          event.pointerId,
      };

    event.preventDefault();
  }

  function pointerUp(
    event,
  ) {
    const start =
      pointerStartRef.current;

    pointerStartRef.current =
      null;

    if (
      !start ||
      !controlEnabled ||
      !controlReady ||
      state !== "live"
    ) {
      return;
    }

    const end =
      normalizedPoint(
        videoRef.current,
        event.clientX,
        event.clientY,
      );

    if (!end) {
      return;
    }

    const elapsed =
      performance.now() -
      start.startedAt;

    const distance =
      Math.hypot(
        end.x -
          start.x,

        end.y -
          start.y,
      );

    let command;

    if (
      distance <
      0.012
    ) {
      if (
        elapsed >=
        550
      ) {
        command = {
          type:
            "long_press",

          x:
            end.x,

          y:
            end.y,

          durationMs:
            Math.min(
              1800,
              Math.max(
                550,
                Math.round(
                  elapsed,
                ),
              ),
            ),
        };
      } else {
        command = {
          type:
            "tap",

          x:
            end.x,

          y:
            end.y,
        };
      }
    } else {
      command = {
        type:
          "swipe",

        startX:
          start.x,

        startY:
          start.y,

        endX:
          end.x,

        endY:
          end.y,

        durationMs:
          Math.min(
            1200,
            Math.max(
              120,
              Math.round(
                elapsed,
              ),
            ),
          ),
      };
    }

    sendControlCommand(
      command,
    ).catch(
      (error) => {
        onErrorRef.current?.(
          error,
        );
      },
    );

    event.preventDefault();
  }

  return (
    <div
      id="airlink-live-screen"
      className={`remote-video-shell ${
        controlEnabled
          ? "remote-control-enabled"
          : ""
      }`}
      onPointerDown={
        pointerDown
      }
      onPointerUp={
        pointerUp
      }
      onPointerCancel={() => {
        pointerStartRef.current =
          null;
      }}
      style={{
        touchAction:
          "none",

        cursor:
          controlEnabled &&
          controlReady &&
          state ===
            "live"
            ? "pointer"
            : "default",
      }}
    >
      <video
        ref={
          videoRef
        }
        className="remote-screen-video"
        autoPlay
        muted
        playsInline
        draggable={
          false
        }
        style={{
          pointerEvents:
            "none",

          userSelect:
            "none",
        }}
      />

      {state !==
        "live" && (
        <div className="remote-video-waiting">
          <span className="loader-ring" />

          <MonitorSmartphone
            size={28}
          />

          <b>
            {state ===
            "failed"
              ? "Screen connection failed"
              : state ===
                  "connecting"
                ? "Connecting to Android screen"
                : "Waiting for Android screen"}
          </b>

          <small>
            {state ===
            "failed"
              ? "The direct WebRTC connection could not be established."
              : "Approve the screen-sharing prompt on the Android device. The live screen will appear here automatically."}
          </small>
        </div>
      )}
    </div>
  );
}