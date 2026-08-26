import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  MonitorSmartphone,
} from "lucide-react";

import {
  emitSessionSignal,
  subscribeToSession,
} from "../services/realtime";

import {
  listWebrtcSignals,
  sendRemoteInput,
} from "../services/backend";

/**
 * STUN ONLY
 * No TURN configuration.
 */
const ICE_SERVERS = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
    ],
  },
];

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

  const onErrorRef =
    useRef(onError);

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
    if (!sessionId) {
      return undefined;
    }

    console.log(
      "AirLink Web: starting remote screen receiver:",
      sessionId,
    );

    console.log(
      "AirLink Web ICE configuration: STUN only",
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

        emitSessionSignal(
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
          setState(
            "live",
          );

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
        await emitSessionSignal(
          sessionId,
          "answer",
          {
            type:
              answer.type,

            sdp:
              answer.sdp,
          },
        );

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

    sendRemoteInput(
      sessionId,
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
          state ===
            "live"
            ? "crosshair"
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