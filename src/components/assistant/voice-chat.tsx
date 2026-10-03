"use client";

import { useEffect, useRef, useState } from "react";
import type { FunctionCall, LiveServerMessage, Session } from "@google/genai";
import { IntentProposal } from "@/components/assistant/intent-card";
import { intentSchema, isPast, type EventIntent } from "@/lib/intent";
import {
  base64ToPcm16,
  downsample,
  floatToPcm16,
  INPUT_RATE,
  OUTPUT_RATE,
  pcm16ToBase64,
} from "@/lib/pcm";

type Line = { id: string; role: "user" | "assistant"; text: string };
type Phase = "idle" | "connecting" | "live" | "error";

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel);
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

function mergeTranscript(current: string, next: string) {
  if (!next) return current;
  if (!current) return next;
  if (next.startsWith(current)) return next;
  if (current.endsWith(next)) return current;
  return current + next;
}

function publicError(error: unknown) {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Allow microphone access to use voice chat.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found.";
  }
  if (error instanceof Error) {
    if (
      error.message === "Could not start voice chat." ||
      error.message === "Voice chat is not configured." ||
      error.message === "Unauthorized"
    ) {
      return error.message === "Unauthorized" ? "Sign in to use voice chat." : error.message;
    }
  }
  return "Could not start voice chat.";
}

function createPlaybackContext() {
  try {
    return new AudioContext({ sampleRate: OUTPUT_RATE });
  } catch {
    return new AudioContext();
  }
}

class Speaker {
  private next = 0;
  private closed = false;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(private ctx: AudioContext) {}

  play(pcm: Int16Array) {
    if (this.closed || pcm.length === 0 || this.ctx.state === "closed") return;
    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) floats[i] = (pcm[i] ?? 0) / 32768;
    const buffer = this.ctx.createBuffer(1, floats.length, OUTPUT_RATE);
    buffer.copyToChannel(floats, 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const start = Math.max(this.ctx.currentTime + 0.02, this.next);
    source.start(start);
    this.next = start + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  interrupt() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear();
    this.next = 0;
  }

  close() {
    this.closed = true;
    this.interrupt();
  }
}

async function startCapture(
  capture: AudioContext,
  stream: MediaStream,
  send: (base64: string) => void,
  alive: () => boolean,
) {
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  try {
    await capture.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const source = capture.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(capture, "pcm-capture");
  const mute = capture.createGain();
  mute.gain.value = 0;
  let pending = new Float32Array(0);
  const frame = INPUT_RATE / 10;

  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (!alive()) return;
    const chunk = event.data;
    if (!(chunk instanceof Float32Array) || chunk.length === 0) return;
    const down = downsample(chunk, capture.sampleRate, INPUT_RATE);
    const merged = new Float32Array(pending.length + down.length);
    merged.set(pending);
    merged.set(down, pending.length);
    let offset = 0;
    while (merged.length - offset >= frame) {
      send(pcm16ToBase64(floatToPcm16(merged.subarray(offset, offset + frame))));
      offset += frame;
    }
    pending = merged.slice(offset);
  };

  source.connect(node);
  node.connect(mute);
  mute.connect(capture.destination);
}

export function VoiceChat() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draftUser, setDraftUser] = useState("");
  const [draftAssistant, setDraftAssistant] = useState("");
  const [proposal, setProposal] = useState<{ intent: EventIntent; toolCallId: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const resources = useRef<{ release: (intentional: boolean) => void } | null>(null);
  const run = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resources.current?.release(true);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, draftUser, draftAssistant, proposal]);

  async function start() {
    if (resources.current || phase === "connecting" || phase === "live") return;
    const generation = ++run.current;
    setPhase("connecting");
    setError(null);
    setNotice(null);

    const playbackCtx = createPlaybackContext();
    const captureCtx = new AudioContext();
    const speaker = new Speaker(playbackCtx);
    let stream: MediaStream | undefined;
    let session: Session | undefined;
    let released = false;
    const alive = () => mounted.current && run.current === generation;

    function release(intentional: boolean) {
      if (released) return;
      released = true;
      try {
        session?.close();
      } catch {
        // The socket may already be closed.
      }
      stream?.getTracks().forEach((track) => track.stop());
      speaker.close();
      void playbackCtx.close().catch(() => {});
      void captureCtx.close().catch(() => {});
      if (resources.current?.release === release) resources.current = null;
      if (!intentional && alive()) {
        setPhase("idle");
        setNotice("Voice chat ended.");
      }
    }

    resources.current = { release };

    try {
      await Promise.all([playbackCtx.resume(), captureCtx.resume()]);
      if (!alive()) {
        release(true);
        return;
      }

      const streamPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      let token: string;
      let model: string;
      try {
        const response = await fetch("/api/voice", { method: "POST" });
        const body = (await response.json().catch(() => null)) as {
          token?: string;
          model?: string;
          error?: string;
        } | null;
        if (!response.ok || !body?.token || !body.model) {
          throw new Error(body?.error ?? "Could not start voice chat.");
        }
        token = body.token;
        model = body.model;
        stream = await streamPromise;
      } catch (cause) {
        void streamPromise.then((open) => open.getTracks().forEach((track) => track.stop())).catch(() => {});
        throw cause;
      }

      if (!alive()) {
        release(true);
        return;
      }

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const buffers = { user: "", assistant: "" };
      // Gemini call ids (e.g. "call_834691") repeat across sessions. createEvent dedupes on
      // (owner, tool call id), so a repeat would reopen an old event instead of creating this one.
      const sessionId = crypto.randomUUID();
      const proposalId = (callId: string) => `voice:${sessionId}:${callId}`;

      function flush(role: "user" | "assistant") {
        const text = buffers[role].trim();
        if (!text) return;
        buffers[role] = "";
        if (role === "user") setDraftUser("");
        else setDraftAssistant("");
        setLines((prev) => [...prev, { id: crypto.randomUUID(), role, text }]);
      }

      function take(
        role: "user" | "assistant",
        transcription: { text?: string; finished?: boolean } | undefined,
      ) {
        if (!transcription) return;
        if (role === "assistant" && buffers.user.trim()) flush("user");
        buffers[role] = mergeTranscript(buffers[role], transcription.text ?? "");
        if (role === "user") setDraftUser(buffers[role]);
        else setDraftAssistant(buffers[role]);
        if (transcription.finished) flush(role);
      }

      function onTool(call: FunctionCall) {
        const name = call.name ?? "";
        if (!session) return;
        if (name !== "propose_event_intent") {
          session.sendToolResponse({
            functionResponses: [{ id: call.id, name, response: { error: "Unknown tool." } }],
          });
          return;
        }
        const parsed = intentSchema.safeParse(call.args);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const field = issue?.path.join(".") || "details";
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name,
                response: { error: `Invalid ${field}: ${issue?.message ?? "check the value"}. Ask the user to correct it.` },
              },
            ],
          });
          return;
        }
        if (isPast(parsed.data)) {
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name,
                response: {
                  error:
                    "The dates are in the past. Fixed dates must start in the future; a flexible window must end in the future.",
                },
              },
            ],
          });
          return;
        }
        setProposal({ intent: parsed.data, toolCallId: proposalId(call.id || crypto.randomUUID()) });
        session.sendToolResponse({
          functionResponses: [
            { id: call.id, name, response: { status: "awaiting_user_confirmation" } },
          ],
        });
      }

      function onMessage(message: LiveServerMessage) {
        if (!alive()) return;
        const content = message.serverContent;
        if (content?.interrupted) {
          speaker.interrupt();
          buffers.assistant = "";
          setDraftAssistant("");
        }
        for (const part of content?.modelTurn?.parts ?? []) {
          const data = part.inlineData?.data;
          const mime = part.inlineData?.mimeType ?? "";
          if (typeof data === "string" && mime.startsWith("audio/")) speaker.play(base64ToPcm16(data));
        }
        take("user", content?.inputTranscription);
        take("assistant", content?.outputTranscription);
        if (content?.turnComplete && buffers.assistant.trim()) flush("assistant");
        for (const call of message.toolCall?.functionCalls ?? []) onTool(call);
        const cancelled = message.toolCallCancellation?.ids;
        if (cancelled?.length) {
          setProposal((current) =>
            current && cancelled.some((id) => proposalId(id) === current.toolCallId) ? null : current,
          );
        }
        if (message.goAway) setNotice("This voice session is ending soon.");
      }

      session = await new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1beta" },
      }).live.connect({
        model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {},
          onmessage: onMessage,
          onerror: () => {
            console.error("[voice] connection error");
            if (!alive()) return;
            release(true);
            setPhase("error");
            setError("The voice connection dropped. Try again.");
          },
          onclose: () => {
            if (!alive() || released) return;
            release(false);
          },
        },
      });

      if (!alive()) {
        release(true);
        return;
      }

      await startCapture(
        captureCtx,
        stream,
        (audio) => {
          if (!alive()) return;
          session?.sendRealtimeInput({ audio: { data: audio, mimeType: "audio/pcm;rate=16000" } });
        },
        alive,
      );

      if (!alive()) {
        release(true);
        return;
      }
      setPhase("live");
    } catch (cause) {
      console.error("[voice]", publicError(cause));
      release(true);
      if (!alive()) return;
      setPhase("error");
      setError(publicError(cause));
    }
  }

  function stop() {
    run.current += 1;
    resources.current?.release(true);
    setPhase("idle");
    setDraftUser("");
    setDraftAssistant("");
  }

  const active = phase === "connecting" || phase === "live";

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {lines.length === 0 && !draftUser && !draftAssistant && (
          <p className="text-ink-2">
            Talk through the event: what it&apos;s about, where, when, how many guests, and your
            budget. You&apos;ll confirm the details before anything is created.
          </p>
        )}

        {lines.map((line) => (
          <Bubble key={line.id} role={line.role} text={line.text} />
        ))}
        {draftUser && <Bubble role="user" text={draftUser} draft />}
        {draftAssistant && <Bubble role="assistant" text={draftAssistant} draft />}
        {proposal && (
          // key: a new proposal must not keep the old card's error or pending state.
          <IntentProposal key={proposal.toolCallId} intent={proposal.intent} toolCallId={proposal.toolCallId} />
        )}
        <div ref={endRef} />

        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-background pb-6 pt-2">
          <div className="flex min-h-5 flex-col gap-1 text-sm text-ink-2">
            <p role="status">
              {phase === "live" && (
                <span className="inline-flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-accent" />
                  </span>
                  Listening
                </span>
              )}
              {phase === "connecting" && "Connecting…"}
            </p>
            {notice && <p>{notice}</p>}
          </div>
          {error && (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          )}
          {active ? (
            <button
              type="button"
              onClick={stop}
              className="self-start rounded-full border border-rule bg-card px-4 py-2 text-sm font-medium transition-transform duration-[var(--dur-micro)] active:scale-[0.98]"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              className="self-start rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-[transform,opacity] duration-[var(--dur-micro)] active:scale-[0.98]"
            >
              Start voice chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, text, draft }: { role: "user" | "assistant"; text: string; draft?: boolean }) {
  const className = draft ? "opacity-70" : undefined;
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <p
          className={`max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2 leading-7 text-paper ${className ?? ""}`}
        >
          {text}
        </p>
      </div>
    );
  }
  return <p className={`whitespace-pre-wrap leading-7 ${className ?? ""}`}>{text}</p>;
}
