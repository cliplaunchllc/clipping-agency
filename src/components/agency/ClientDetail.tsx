"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ExternalLink, Check, ChevronLeft, Save, Upload, FileText } from "lucide-react";

interface Link { id: string; label: string; url: string; }
interface OnboardingStep { id: string; title: string; description: string | null; linkUrl: string | null; order: number; completed: boolean; }
interface Clipper { id: string; name: string | null; email: string; status: string; }

interface ClientData {
  id: string;
  name: string;
  status: string;
  campaignType: "manual" | "cpm";
  contractUrl: string | null;
  campaignTrackerUrl: string | null;
  welcomePageUrl: string | null;
  dealLengthDays: number | null;
  dealStartDate: string | null;
  dealEndDate: string | null;
  pageCount: number | null;
  clipsPerDay: number | null;
  archivedAt: string | null;
  createdAt: string;
  clipCount: number;
  links: Link[];
  onboardingSteps: OnboardingStep[];
  clippers: Clipper[];
  loginUser: { id: string; email: string } | null;
}

const inputStyle: React.CSSProperties = {
  background: "var(--border-subtle)",
  border: "1px solid var(--border-default)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

export default function ClientDetail({ client: initial }: { client: ClientData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [client, setClient] = useState(initial);
  const [activeTab, setActiveTab] = useState<"settings" | "onboarding">("settings");

  // Deal terms state — auto-open edit if ?edit=1 in URL
  const [startDate, setStartDate] = useState(initial.dealStartDate ? initial.dealStartDate.slice(0, 10) : "");
  const [savingStartDate, setSavingStartDate] = useState(false);
  const [startDateSaved, setStartDateSaved] = useState(false);
  const [contractUrl, setContractUrl] = useState(initial.contractUrl ?? "");
  const [savingContract, setSavingContract] = useState(false);
  const [contractSaved, setContractSaved] = useState(false);
  const contractFileRef = useRef<HTMLInputElement>(null);
  const [trackerUrl, setTrackerUrl] = useState(initial.campaignTrackerUrl ?? "");
  const [savingTracker, setSavingTracker] = useState(false);
  const [trackerSaved, setTrackerSaved] = useState(false);
  const [welcomeUrl, setWelcomeUrl] = useState(initial.welcomePageUrl ?? "");
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [welcomeSaved, setWelcomeSaved] = useState(false);

  // Client login state
  const [loginEmail, setLoginEmail] = useState(initial.loginUser?.email ?? "");
  const [loginPassword, setLoginPassword] = useState("");
  const [savingLogin, setSavingLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [currentLoginEmail, setCurrentLoginEmail] = useState(initial.loginUser?.email ?? "");

  // Links state
  const [links, setLinks] = useState<Link[]>(initial.links);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Onboarding state
  const [steps, setSteps] = useState<OnboardingStep[]>(initial.onboardingSteps);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDesc, setNewStepDesc] = useState("");
  const [newStepLink, setNewStepLink] = useState("");
  const [stepSaving, setStepSaving] = useState(false);

  async function handleContractUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingContract(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const res = await fetch(`/api/agency/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractUrl: dataUrl }),
      });
      if (res.ok) {
        setContractUrl(dataUrl);
        setContractSaved(true);
        setTimeout(() => setContractSaved(false), 2500);
      }
      setSavingContract(false);
    };
    reader.readAsDataURL(file);
  }

  async function saveWelcomeUrl() {
    setSavingWelcome(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ welcomePageUrl: welcomeUrl }),
    });
    if (res.ok) { setWelcomeSaved(true); setTimeout(() => setWelcomeSaved(false), 2500); }
    setSavingWelcome(false);
  }

  async function saveTrackerUrl() {
    setSavingTracker(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignTrackerUrl: trackerUrl }),
    });
    if (res.ok) { setTrackerSaved(true); setTimeout(() => setTrackerSaved(false), 2500); }
    setSavingTracker(false);
  }

  async function saveStartDate() {
    setSavingStartDate(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealStartDate: startDate || null }),
    });
    if (res.ok) { setStartDateSaved(true); setTimeout(() => setStartDateSaved(false), 2500); }
    setSavingStartDate(false);
  }

  async function saveLogin() {
    setSavingLogin(true);
    setLoginMsg(null);
    const body: Record<string, string> = {};
    if (loginEmail && loginEmail !== currentLoginEmail) body.email = loginEmail;
    if (loginPassword) body.newPassword = loginPassword;
    if (Object.keys(body).length === 0) {
      setLoginMsg({ type: "err", text: "No changes to save" });
      setSavingLogin(false);
      return;
    }
    const res = await fetch(`/api/agency/clients/${client.id}/user`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginMsg({ type: "err", text: data.error || "Failed to update" });
    } else {
      setLoginMsg({ type: "ok", text: "Login updated" });
      if (data.email) { setCurrentLoginEmail(data.email); setLoginEmail(data.email); }
      setLoginPassword("");
      setTimeout(() => setLoginMsg(null), 3000);
    }
    setSavingLogin(false);
  }

  async function addLink() {
    if (!newLabel || !newUrl) return;
    setLinkSaving(true);
    const res = await fetch(`/api/agency/clients/${client.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel, url: newUrl }),
    });
    if (res.ok) {
      const link = await res.json();
      setLinks((prev) => [...prev, link]);
      setNewLabel(""); setNewUrl("");
    }
    setLinkSaving(false);
  }

  async function deleteLink(linkId: string) {
    const res = await fetch(`/api/agency/clients/${client.id}/links`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  async function addStep() {
    if (!newStepTitle) return;
    setStepSaving(true);
    const res = await fetch(`/api/agency/clients/${client.id}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newStepTitle, description: newStepDesc, linkUrl: newStepLink || null }),
    });
    if (res.ok) {
      const step = await res.json();
      setSteps((prev) => [...prev, step]);
      setNewStepTitle(""); setNewStepDesc(""); setNewStepLink("");
    }
    setStepSaving(false);
  }

  async function toggleStep(stepId: string, completed: boolean) {
    const res = await fetch(`/api/agency/clients/${client.id}/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, completed }),
    });
    if (res.ok) setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, completed } : s));
  }

  async function deleteStep(stepId: string) {
    const res = await fetch(`/api/agency/clients/${client.id}/onboarding`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    });
    if (res.ok) setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  const completedSteps = steps.filter((s) => s.completed).length;
  const onboardingPct = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  const tabs = [
    { id: "settings", label: "Settings" },
    { id: "onboarding", label: `Onboarding (${completedSteps}/${steps.length})` },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Back + Header */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs mb-6"
        style={{ color: "var(--text-secondary)" }}>
        <ChevronLeft size={14} /> Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
              {client.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                {client.name}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: client.status === "active" ? "var(--success)" : "var(--warning)" }}>{client.status}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium relative tab-btn"
            style={{ color: activeTab === t.id ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {t.label}
            {activeTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {/* SETTINGS */}
      {activeTab === "settings" && (
        <div className="rounded-xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>

          {/* Campaign Tracker URL — always visible */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Campaign Tracker URL</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>The live tracking link shared with the client on their dashboard overview.</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={trackerUrl}
                onChange={(e) => setTrackerUrl(e.target.value)}
                placeholder="https://..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={saveTrackerUrl}
                disabled={savingTracker}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                style={{ background: trackerSaved ? "rgba(61,255,162,0.15)" : "var(--accent-muted)", border: `1px solid ${trackerSaved ? "rgba(61,255,162,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: trackerSaved ? "var(--success)" : "var(--accent)" }}
              >
                {trackerSaved ? <><Check size={12} /> Saved</> : savingTracker ? "Saving…" : <><Save size={12} /> Save</>}
              </button>
            </div>
          </div>

          {/* Welcome Page URL */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Welcome Page URL</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>The onboarding welcome page link shown to the client in their Onboarding tab.</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={welcomeUrl}
                onChange={(e) => setWelcomeUrl(e.target.value)}
                placeholder="https://..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={saveWelcomeUrl}
                disabled={savingWelcome}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                style={{ background: welcomeSaved ? "rgba(61,255,162,0.15)" : "var(--accent-muted)", border: `1px solid ${welcomeSaved ? "rgba(61,255,162,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: welcomeSaved ? "var(--success)" : "var(--accent)" }}
              >
                {welcomeSaved ? <><Check size={12} /> Saved</> : savingWelcome ? "Saving…" : <><Save size={12} /> Save</>}
              </button>
            </div>
          </div>

          {/* Campaign type — static CPM badge */}
          <div className="rounded-xl p-4 mb-6 flex items-center justify-between" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>Campaign Type</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>CPM clients see the Ongoing Reports tab on their dashboard.</p>
            </div>
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
              CPM Based
            </span>
          </div>

          {/* Contract — PDF upload */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Signed Agreement</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Upload a PDF contract — visible to the client as a download on their dashboard.</p>
            <div className="flex items-center gap-3">
              <input
                ref={contractFileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleContractUpload}
              />
              <button
                onClick={() => contractFileRef.current?.click()}
                disabled={savingContract}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: savingContract ? "var(--border-subtle)" : "var(--accent-muted)", border: `1px solid ${contractSaved ? "rgba(61,255,162,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: contractSaved ? "var(--success)" : "var(--accent)" }}
              >
                {contractSaved ? <><Check size={12} /> Uploaded</> : savingContract ? "Uploading…" : <><Upload size={12} /> Upload PDF</>}
              </button>
              {contractUrl && contractUrl.startsWith("data:") && (
                <a
                  href={contractUrl}
                  download="contract.pdf"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <FileText size={12} /> Download current
                </a>
              )}
              {contractUrl && !contractUrl.startsWith("data:") && (
                <a
                  href={contractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <ExternalLink size={12} /> View current
                </a>
              )}
            </div>
          </div>

          {/* Campaign Start Date */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Campaign Start Date</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>The date this client&apos;s campaign began.</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ ...inputStyle, flex: 1, colorScheme: "dark" }}
              />
              <button
                onClick={saveStartDate}
                disabled={savingStartDate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                style={{ background: startDateSaved ? "rgba(61,255,162,0.15)" : "var(--accent-muted)", border: `1px solid ${startDateSaved ? "rgba(61,255,162,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: startDateSaved ? "var(--success)" : "var(--accent)" }}
              >
                {startDateSaved ? <><Check size={12} /> Saved</> : savingStartDate ? "Saving…" : <><Save size={12} /> Save</>}
              </button>
            </div>
          </div>

          {/* Client Login */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Client Login</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
              {currentLoginEmail
                ? <>Current login email: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{currentLoginEmail}</span></>
                : "No client login account found for this client."}
            </p>
            {initial.loginUser && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="client@example.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>New Password <span style={{ color: "var(--text-tertiary)" }}>(leave blank to keep current)</span></label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                  />
                </div>
                {loginMsg && (
                  <div className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: loginMsg.type === "ok" ? "rgba(61,255,162,0.08)" : "rgba(255,71,87,0.1)",
                      color: loginMsg.type === "ok" ? "var(--success)" : "var(--danger)",
                      border: `1px solid ${loginMsg.type === "ok" ? "rgba(61,255,162,0.2)" : "rgba(255,71,87,0.2)"}`,
                    }}>
                    {loginMsg.text}
                  </div>
                )}
                <button
                  onClick={saveLogin}
                  disabled={savingLogin}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--accent-muted)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)", opacity: savingLogin ? 0.6 : 1 }}
                >
                  <Save size={12} /> {savingLogin ? "Saving…" : "Save Login"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONBOARDING */}
      {activeTab === "onboarding" && (
        <div className="space-y-4">
          {/* Progress */}
          {steps.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Progress</span>
                <span className="text-xs font-medium" style={{ color: "var(--success)" }}>{onboardingPct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "var(--border-default)" }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${onboardingPct}%`, background: "linear-gradient(90deg, #3DFFA2, #FF3B3B)" }} />
              </div>
            </div>
          )}

          {/* Steps list */}
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-4 p-4 rounded-xl"
                style={{ background: "var(--bg-surface)", border: `1px solid ${step.completed ? "rgba(61,255,162,0.15)" : "var(--border-default)"}` }}>
                <button onClick={() => toggleStep(step.id, !step.completed)}
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all check-circle"
                  style={{ background: step.completed ? "color-mix(in srgb, var(--success) 20%, transparent)" : "var(--border-subtle)", border: `1px solid ${step.completed ? "var(--success)" : "rgba(255,255,255,0.15)"}` }}>
                  {step.completed && <Check size={11} color="var(--success)" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: step.completed ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: step.completed ? "line-through" : "none" }}>
                    {i + 1}. {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{step.description}</p>
                  )}
                  {step.linkUrl && (
                    <a href={step.linkUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-1"
                      style={{ color: "var(--accent)" }}>
                      <ExternalLink size={10} /> {step.linkUrl}
                    </a>
                  )}
                </div>
                <button onClick={() => deleteStep(step.id)} className="p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
                  <Trash2 size={12} color="var(--danger)" />
                </button>
              </div>
            ))}
          </div>

          {/* Add step */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Add Step</h2>
            <div className="space-y-3">
              <input value={newStepTitle} onChange={(e) => setNewStepTitle(e.target.value)}
                placeholder="Step title (e.g. Sign contract)" style={inputStyle} />
              <input value={newStepDesc} onChange={(e) => setNewStepDesc(e.target.value)}
                placeholder="Description (optional)" style={inputStyle} />
              <input type="url" value={newStepLink} onChange={(e) => setNewStepLink(e.target.value)}
                placeholder="Link URL (optional, e.g. https://welcome.example.com)" style={inputStyle} />
              <button onClick={addStep} disabled={stepSaving || !newStepTitle}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg"
                style={{ background: "var(--accent-muted)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)", opacity: !newStepTitle ? 0.5 : 1 }}>
                <Plus size={12} /> {stepSaving ? "Adding..." : "Add Step"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
