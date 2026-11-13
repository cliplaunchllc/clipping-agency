"use client";

import { useState } from "react";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VideoEmbed({ videoId, url }: { videoId: string; url: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
  return (
    <div className="mt-4" style={{ maxWidth: 460 }}>
      {playing ? (
        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        </div>
      ) : (
        <div
          onClick={() => setPlaying(true)}
          className="relative rounded-xl overflow-hidden cursor-pointer"
          style={{ aspectRatio: "16/9", background: "#000" }}
        >
          <img
            src={thumbSrc}
            alt="Welcome video"
            onError={() => setThumbSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#111" stroke="none">
                <polygon points="6 3 20 12 6 21 6 3"/>
              </svg>
            </div>
          </div>
        </div>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-secondary)", textDecoration: "none" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
        Watch fullscreen
      </a>
    </div>
  );
}

interface Props {
  welcomeVideoUrl?: string | null;
  intakeFormUrl?: string | null;
}

const STEPS = [
  { number: "01", owner: "You",             title: "Watch the welcome video",                         description: "Get a quick overview of how the process works and what to expect." },
  { number: "02", owner: "You",             title: "Complete the intake form",                        description: "Tell us about your brand, goals, and niche." },
  { number: "03", owner: "You",             title: "Notify us in our dedicated communication channel", description: "Once your intake form is complete, notify us in our dedicated communication channel so we can start building your rules brief." },
  { number: "04", owner: "ClipLaunch Team", title: "We build your rules brief",                       description: "Using your intake form answers, we create a custom brief outlining exactly how your clips should be cut, framed, and posted including CTAs, messaging, and any other specifics based on your goals." },
  { number: "05", owner: "You",             title: "You approve the brief",                           description: "We will send the completed rules brief to you in our communication channel for your review. Simply give us the okay and approve it there — your campaign does not launch without your approval." },
  { number: "06", owner: "ClipLaunch Team", title: "Campaign launches",                               description: "Once approved, we launch your campaign across our clipper network and content starts getting created." },
  { number: "07", owner: "ClipLaunch Team", title: "Updates and optimization",                        description: "You will get a tracking link so you can watch everything in real time: approved clips, views, CPM, all of it. You will also have access to this dashboard, where we will post campaign reports and weekly updates so you can track your results in one place. We will keep you posted on anything worth knowing along with any adjustments we are making along the way." },
] as const;

export default function OnboardingContent({ welcomeVideoUrl, intakeFormUrl }: Props) {
  return (
    <>
      <style>{`
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes liveGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(61,214,140,0.7), 0 0 10px rgba(61,214,140,0.5); }
          50%      { box-shadow: 0 0 0 5px rgba(61,214,140,0.12), 0 0 22px rgba(61,214,140,0.55); }
        }
        @keyframes dotGlow {
          0%, 9%, 100% {
            box-shadow: none;
            border-color: rgba(255,255,255,0.08);
          }
          4.5% {
            box-shadow: 0 0 0 5px rgba(61,214,140,0.22), 0 0 22px rgba(61,214,140,0.6);
            border-color: rgba(61,214,140,0.65);
          }
        }
        @keyframes lineFill {
          0%, 100%  { transform: scaleY(0); opacity: 0; }
          1.5%      { transform: scaleY(0); opacity: 1; }
          9%        { transform: scaleY(1); opacity: 0.75; }
          12%, 99%  { transform: scaleY(1); opacity: 0; }
        }
        .ob-step   { animation: obFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .ob-header { animation: obFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .live-dot  { animation: liveGlow 2.2s ease-in-out infinite; }
        .step-dot  { animation: dotGlow  9.8s ease-in-out infinite; }
        .line-fill { animation: lineFill 9.8s ease-in-out infinite; transform-origin: top center; }
      `}</style>

      <div style={{ maxWidth: "100%" }}>
        {/* Live status pill */}
        <div className="ob-header flex items-center gap-2.5 mb-6" style={{ animationDelay: "0ms" }}>
          <div
            className="live-dot w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: "var(--accent)", boxShadow: "0 0 10px rgba(61,214,140,0.7)" }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>
            Live
          </span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>· Campaign portal is active</span>
        </div>

        {/* Header */}
        <div className="ob-header mb-10" style={{ animationDelay: "30ms" }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              marginBottom: 12,
            }}
          >
            Welcome to ClipLaunch!
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 560 }}>
            We are so excited to have you on board. Your campaign will be live within{" "}
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>3–5 business days</strong>{" "}
            from payment. Please complete the steps below as soon as possible so we can get everything moving without delay.
          </p>
        </div>

        {/* Steps */}
        {STEPS.map((step, i, arr) => {
          const isTeam = step.owner === "ClipLaunch Team";
          const badgeBg     = isTeam ? "rgba(255,255,255,0.06)" : "var(--accent-muted)";
          const badgeBorder = isTeam ? "rgba(255,255,255,0.1)"  : "var(--accent-border)";
          const badgeColor  = isTeam ? "var(--text-secondary)"  : "var(--accent)";
          const dotDelay    = `${(i * 1.4 - 9.8).toFixed(1)}s`;
          const lineDelay   = `${(i * 1.4 + 0.5 - 9.8).toFixed(1)}s`;
          return (
            <div key={step.number} className="ob-step flex gap-5" style={{ animationDelay: `${80 + i * 70}ms` }}>
              {/* Left rail */}
              <div className="flex flex-col items-center flex-shrink-0 pt-1" style={{ width: 40 }}>
                <div
                  className="step-dot w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                  style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", animationDelay: dotDelay }}
                >
                  <span className="label-mono tabular-nums">{step.number}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="relative flex-1 mt-2" style={{ width: 1, minHeight: 44, overflow: "hidden" }}>
                    <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.07)" }} />
                    <div
                      className="line-fill absolute inset-0"
                      style={{
                        background: "linear-gradient(to bottom, rgba(61,214,140,0.8) 0%, rgba(61,214,140,0.1) 100%)",
                        animationDelay: lineDelay,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Content card */}
              <div
                className={`flex-1 rounded-xl px-5 py-4 ${i < arr.length - 1 ? "mb-3" : ""}`}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                    {step.title}
                  </p>
                  <span
                    className="label-mono flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md mt-0.5"
                    style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeColor, whiteSpace: "nowrap" }}
                  >
                    {isTeam ? (
                      <>
                        <img src="/api/favicon" alt="" width={12} height={12} style={{ borderRadius: 2, objectFit: "contain", flexShrink: 0 }} />
                        ClipLaunch Team
                      </>
                    ) : "You"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {step.description}
                </p>

                {/* Step 01: YouTube embed */}
                {step.number === "01" && (() => {
                  const videoUrl = welcomeVideoUrl ?? "https://youtu.be/TEpGyDS-h_I";
                  const videoId = getYouTubeId(videoUrl);
                  return videoId ? <VideoEmbed videoId={videoId} url={videoUrl} /> : null;
                })()}

                {/* Step 02: Intake form button */}
                {step.number === "02" && (() => {
                  const formUrl = intakeFormUrl ?? "https://docs.google.com/forms/d/e/1FAIpQLScSsg14k-6RKzGFvxk6OwWvJ4ifskFK5NaOeOWZWIklvvsk9g/viewform?usp=publish-editor";
                  return (
                    <a
                      href={formUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                      style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)", textDecoration: "none" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                      Open Intake Form
                    </a>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
