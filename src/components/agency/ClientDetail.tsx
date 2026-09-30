"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ExternalLink, Check, ChevronLeft, Save } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"deal" | "links" | "onboarding" | "clippers">("deal");

  // Deal terms state — auto-open edit if ?edit=1 in URL
  const [dealEdit, setDealEdit] = useState(() => searchParams.get("edit") === "1");
  const [dealForm, setDealForm] = useState({
    name: initial.name,
    dealLengthDays: initial.dealLengthDays?.toString() ?? "",
    dealStartDate: initial.dealStartDate ? initial.dealStartDate.slice(0, 10) : "",
    pageCount: initial.pageCount?.toString() ?? "",   // repurposed as # clippers
    clipsPerDay: initial.clipsPerDay?.toString() ?? "",
  });
  const [dealSaving, setDealSaving] = useState(false);
  const [campaignType, setCampaignType] = useState<"manual" | "cpm">(initial.campaignType);
  const [savingType, setSavingType] = useState(false);
  const [contractUrl, setContractUrl] = useState(initial.contractUrl ?? "");
  const [savingContract, setSavingContract] = useState(false);
  const [contractSaved, setContractSaved] = useState(false);
  const [trackerUrl, setTrackerUrl] = useState(initial.campaignTrackerUrl ?? "");
  const [savingTracker, setSavingTracker] = useState(false);
  const [trackerSaved, setTrackerSaved] = useState(false);

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

  async function toggleCampaignType(type: "manual" | "cpm") {
    setSavingType(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignType: type }),
    });
    if (res.ok) setCampaignType(type);
    setSavingType(false);
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

  async function saveContractUrl() {
    setSavingContract(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractUrl }),
    });
    if (res.ok) { setContractSaved(true); setTimeout(() => setContractSaved(false), 2500); }
    setSavingContract(false);
  }

  async function saveDeal() {
    setDealSaving(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dealForm),
    });
    if (res.ok) {
      setClient((prev) => ({
        ...prev,
        name: dealForm.name,
        dealLengthDays: dealForm.dealLengthDays ? Number(dealForm.dealLengthDays) : null,
        dealStartDate: dealForm.dealStartDate ? dealForm.dealStartDate : null,
        pageCount: dealForm.pageCount ? Number(dealForm.pageCount) : null,
        clipsPerDay: dealForm.clipsPerDay ? Number(dealForm.clipsPerDay) : null,
      }));
      setDealEdit(false);
    }
    setDealSaving(false);
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
    { id: "deal", label: "Deal Terms" },
    { id: "links", label: `Links (${links.length})` },
    { id: "onboarding", label: `Onboarding (${completedSteps}/${steps.length})` },
    { id: "clippers", label: `Clippers (${client.clippers.length})` },
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
                {client.clipCount} clips · {client.clippers.length} clippers ·{" "}
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

      {/* DEAL TERMS */}
      {activeTab === "deal" && (
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

          {/* Campaign type — always visible */}
          <div className="rounded-xl p-4 mb-6 flex items-center justify-between" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>Campaign Type</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>CPM clients see the Ongoing Reports tab on their dashboard.</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}>
              {(["manual", "cpm"] as const).map((t) => (
                <button
                  key={t}
                  disabled={savingType}
                  onClick={() => toggleCampaignType(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: campaignType === t ? (t === "cpm" ? "var(--accent-muted)" : "var(--border-subtle)") : "transparent",
                    color: campaignType === t ? (t === "cpm" ? "var(--accent)" : "var(--text-primary)") : "var(--text-tertiary)",
                    border: campaignType === t ? `1px solid ${t === "cpm" ? "var(--accent-border)" : "var(--border-strong)"}` : "1px solid transparent",
                  }}
                >
                  {t === "cpm" ? "CPM Based" : "Manual"}
                </button>
              ))}
            </div>
          </div>

          {/* Contract URL (CPM only) — always visible when CPM */}
          {campaignType === "cpm" && (
            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Signed Agreement</p>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Link to the signed contract — visible to the client on their dashboard.</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={saveContractUrl}
                  disabled={savingContract}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{ background: contractSaved ? "rgba(61,255,162,0.15)" : "var(--accent-muted)", border: `1px solid ${contractSaved ? "rgba(61,255,162,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: contractSaved ? "var(--success)" : "var(--accent)" }}
                >
                  {contractSaved ? <><Check size={12} /> Saved</> : savingContract ? "Saving…" : <><Save size={12} /> Save</>}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Deal Terms</h2>
            {dealEdit ? (
              <div className="flex items-center gap-2">
                <button onClick={() => { setDealEdit(false); setDealForm({ name: client.name, dealLengthDays: client.dealLengthDays?.toString() ?? "", dealStartDate: client.dealStartDate ? client.dealStartDate.slice(0, 10) : "", pageCount: client.pageCount?.toString() ?? "", clipsPerDay: client.clipsPerDay?.toString() ?? "" }); }}
                  className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={saveDeal} disabled={dealSaving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent)" }}>
                  <Save size={12} /> {dealSaving ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <button onClick={() => setDealEdit(true)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                Edit
              </button>
            )}
          </div>

          {dealEdit ? (
            <>
              {/* Formula hint */}
              <div className="rounded-xl px-4 py-3 mb-6 text-xs" style={{ background: "rgba(61,255,162,0.06)", border: "1px solid rgba(61,255,162,0.15)", color: "var(--text-secondary)" }}>
                Goal = <span style={{ color: "var(--text-primary)" }}>Clippers</span> × <span style={{ color: "var(--text-primary)" }}>3 platforms</span> (TikTok · Instagram · YouTube) × <span style={{ color: "var(--text-primary)" }}>Clips/day</span> × <span style={{ color: "var(--text-primary)" }}>Deal length</span>
                {dealForm.pageCount && dealForm.clipsPerDay && dealForm.dealLengthDays ? (
                  <span className="ml-2" style={{ color: "var(--success)" }}>
                    = {Number(dealForm.pageCount) * 3 * Number(dealForm.clipsPerDay) * Number(dealForm.dealLengthDays)} total clips
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Client Name</label>
                  <input value={dealForm.name} onChange={(e) => setDealForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Number of Clippers</label>
                  <input type="number" value={dealForm.pageCount} onChange={(e) => setDealForm((f) => ({ ...f, pageCount: e.target.value }))} placeholder="e.g. 5" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Clips / Day <span style={{ color: "var(--text-tertiary)" }}>(per clipper, per platform)</span></label>
                  <input type="number" value={dealForm.clipsPerDay} onChange={(e) => setDealForm((f) => ({ ...f, clipsPerDay: e.target.value }))} placeholder="e.g. 3" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Deal Length (days)</label>
                  <input type="number" value={dealForm.dealLengthDays} onChange={(e) => setDealForm((f) => ({ ...f, dealLengthDays: e.target.value }))} placeholder="e.g. 30" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Deal Start Date</label>
                  <input type="date" value={dealForm.dealStartDate} onChange={(e) => setDealForm((f) => ({ ...f, dealStartDate: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
                <div className="rounded-xl p-4 flex flex-col justify-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Deal End Date <span style={{ color: "var(--text-tertiary)" }}>(auto-computed)</span></p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {dealForm.dealStartDate && dealForm.dealLengthDays
                      ? new Date(new Date(dealForm.dealStartDate).getTime() + Number(dealForm.dealLengthDays) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Formula summary */}
              {client.pageCount && client.clipsPerDay && client.dealLengthDays && (
                <div className="rounded-xl px-4 py-3 mb-6 text-xs" style={{ background: "rgba(61,255,162,0.06)", border: "1px solid rgba(61,255,162,0.15)", color: "var(--text-secondary)" }}>
                  {client.pageCount} clipper{client.pageCount !== 1 ? "s" : ""} × 3 platforms × {client.clipsPerDay} clips/day × {client.dealLengthDays} days
                  <span className="ml-2 font-semibold" style={{ color: "var(--success)" }}>= {client.pageCount * 3 * client.clipsPerDay * client.dealLengthDays} total clips</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Client Name", value: client.name },
                  { label: "Number of Clippers", value: client.pageCount?.toString() ?? "—" },
                  { label: "Pages per Clipper", value: "3 (TikTok · Instagram · YouTube)" },
                  { label: "Clips / Day", value: client.clipsPerDay ? `${client.clipsPerDay} per clipper, per platform` : "—" },
                  { label: "Deal Length", value: client.dealLengthDays ? `${client.dealLengthDays} days` : "—" },
                  { label: "Deal Start", value: client.dealStartDate ? new Date(client.dealStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—" },
                  { label: "Deal End", value: client.dealStartDate && client.dealLengthDays ? new Date(new Date(client.dealStartDate).getTime() + client.dealLengthDays * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—" },
                  { label: "Total Clips Submitted", value: client.clipCount.toString() },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: "var(--bg-hover)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* LINKS */}
      {activeTab === "links" && (
        <div className="space-y-4">
          {/* Add link form */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Add Link</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Label</label>
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Onboarding doc, Brand assets..." style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>URL</label>
                <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>
            </div>
            <button onClick={addLink} disabled={linkSaving || !newLabel || !newUrl}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg"
              style={{ background: "var(--accent-muted)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)", opacity: (!newLabel || !newUrl) ? 0.5 : 1 }}>
              <Plus size={12} /> {linkSaving ? "Adding..." : "Add Link"}
            </button>
          </div>

          {/* Links list */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            {links.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm" style={{ color: "var(--text-secondary)" }}>No links yet — add one above</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {links.map((link) => (
                  <div key={link.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{link.label}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{link.url}</p>
                    </div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5">
                      <ExternalLink size={13} color="#8A93A6" />
                    </a>
                    <button onClick={() => deleteLink(link.id)} className="p-1.5 rounded-lg hover:bg-white/5">
                      <Trash2 size={13} color="var(--danger)" />
                    </button>
                  </div>
                ))}
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

      {/* CLIPPERS */}
      {activeTab === "clippers" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Clipper", "Email", "Status"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {client.clippers.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < client.clippers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "var(--text-secondary)" }}>{c.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded-full"
                      style={{ background: c.status === "active" ? "color-mix(in srgb, var(--success) 10%, transparent)" : "rgba(255,165,0,0.1)", color: c.status === "active" ? "var(--success)" : "var(--warning)" }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {client.clippers.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>No clippers assigned</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
