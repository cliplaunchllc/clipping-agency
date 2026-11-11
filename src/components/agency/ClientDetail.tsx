"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ExternalLink, Check, ChevronLeft, Save, Upload, FileText, Zap } from "lucide-react";

interface Link { id: string; label: string; url: string; }

interface CampaignStats {
  asOf: string;
  viewsTotal: number;
  viewsToday: number;
  totalSubmissions: number;
  pending: number;
  approved: number;
  rejected: number;
  amountSpent: number | null;
  effectiveCpm: number | null;
  totalBudget: number | null;
  budgetRemaining: number | null;
  tiktokViews: number;
  instagramViews: number;
  youtubeViews: number;
  platformViews: Record<string, number> | null;
  topClips: Array<{ url?: string; creator?: string; platform?: string; views?: number; [k: string]: unknown }> | null;
  status: "Strong" | "Normal" | "NeedsAttention";
  updatedAt: string;
}

interface Campaign { id: string; name: string; totalBudget: number; order: number; stats?: CampaignStats | null; }
interface OnboardingStep { id: string; title: string; description: string | null; linkUrl: string | null; order: number; completed: boolean; }
interface Clipper { id: string; name: string | null; email: string; status: string; }

interface ClientData {
  id: string;
  name: string;
  status: string;
  campaignType: "manual" | "cpm";
  contractUrl: string | null;
  campaignTrackerUrl: string | null;
  bannerUrl: string | null;
  welcomePageUrl: string | null;
  welcomeVideoUrl: string | null;
  intakeFormUrl: string | null;
  dealLengthDays: number | null;
  dealStartDate: string | null;
  dealEndDate: string | null;
  pageCount: number | null;
  clipsPerDay: number | null;
  archivedAt: string | null;
  createdAt: string;
  clipCount: number;
  links: Link[];
  campaigns: Campaign[];
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
  const [activeTab, setActiveTab] = useState<"settings">("settings");

  // Deal terms state — auto-open edit if ?edit=1 in URL
  const [startDate, setStartDate] = useState(initial.dealStartDate ? initial.dealStartDate.slice(0, 10) : "");
  const [contractUrl, setContractUrl] = useState(initial.contractUrl ?? "");
  const [savingContract, setSavingContract] = useState(false);
  const [contractSaved, setContractSaved] = useState(false);
  const contractFileRef = useRef<HTMLInputElement>(null);
  const [trackerUrl, setTrackerUrl] = useState(initial.campaignTrackerUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl ?? "");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSaved, setBannerSaved] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [welcomeUrl, setWelcomeUrl] = useState(initial.welcomePageUrl ?? "");
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState(initial.welcomeVideoUrl ?? "https://youtu.be/TEpGyDS-h_I");
  const [intakeFormUrl, setIntakeFormUrl] = useState(initial.intakeFormUrl ?? "https://docs.google.com/forms/d/e/1FAIpQLScSsg14k-6RKzGFvxk6OwWvJ4ifskFK5NaOeOWZWIklvvsk9g/viewform?usp=publish-editor");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Share link state
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  async function getShareLink() {
    setShareLoading(true);
    const res = await fetch(`/api/agency/clients/${client.id}/share-token`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.token) {
      setShareToken(data.token);
      const url = `${window.location.origin}/share/${data.token}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
    setShareLoading(false);
  }

  // Links state
  const [links, setLinks] = useState<Link[]>(initial.links);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>(initial.campaigns);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignBudget, setNewCampaignBudget] = useState("");
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editCampaignName, setEditCampaignName] = useState("");
  const [editCampaignBudget, setEditCampaignBudget] = useState("");

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

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingBanner(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const res = await fetch(`/api/agency/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerUrl: dataUrl }),
      });
      if (res.ok) {
        setBannerUrl(dataUrl);
        setBannerSaved(true);
        setTimeout(() => setBannerSaved(false), 2500);
      }
      setSavingBanner(false);
    };
    reader.readAsDataURL(file);
  }

  async function addCampaign() {
    if (!newCampaignName) return;
    setCampaignSaving(true);
    const res = await fetch(`/api/agency/clients/${client.id}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCampaignName, totalBudget: parseFloat(newCampaignBudget || "0"), order: campaigns.length + 1 }),
    });
    if (res.ok) {
      const c = await res.json();
      setCampaigns((prev) => [...prev, c]);
      setNewCampaignName(""); setNewCampaignBudget("");
    }
    setCampaignSaving(false);
  }

  async function saveCampaignEdit(campaignId: string) {
    const res = await fetch(`/api/agency/clients/${client.id}/campaigns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, name: editCampaignName, totalBudget: parseFloat(editCampaignBudget || "0") }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCampaigns((prev) => prev.map((c) => c.id === campaignId ? updated : c));
      setEditingCampaignId(null);
    }
  }

  async function deleteCampaign(campaignId: string) {
    const res = await fetch(`/api/agency/clients/${client.id}/campaigns`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (res.ok) setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
  }

  async function saveAllSettings() {
    setSavingSettings(true);
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignTrackerUrl: trackerUrl,
        welcomePageUrl: welcomeUrl,
        welcomeVideoUrl: welcomeVideoUrl,
        intakeFormUrl: intakeFormUrl,
        dealStartDate: startDate || null,
      }),
    });
    if (res.ok) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2500); }
    setSavingSettings(false);
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

  const tabs = [
    { id: "settings", label: "Settings" },
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
            <input
              type="url"
              value={trackerUrl}
              onChange={(e) => setTrackerUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          {/* Banner Image Upload */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Dashboard Banner Image</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>16:9 image shown at the top of the client&apos;s overview (YouTube thumbnail size). JPG, PNG, or WebP.</p>
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleBannerUpload}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => bannerFileRef.current?.click()}
                disabled={savingBanner}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: savingBanner ? "var(--border-subtle)" : "var(--accent-muted)", border: `1px solid ${bannerSaved ? "rgba(61,214,140,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: bannerSaved ? "var(--success)" : "var(--accent)" }}
              >
                {bannerSaved ? <><Check size={12} /> Uploaded</> : savingBanner ? "Uploading…" : <><Upload size={12} /> Upload Image</>}
              </button>
              {bannerUrl && (
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/agency/clients/${client.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bannerUrl: "" }),
                    });
                    if (res.ok) setBannerUrl("");
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--danger)" }}
                >
                  Remove
                </button>
              )}
            </div>
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="mt-3 rounded-lg w-full"
                style={{ border: "1px solid var(--border-default)", display: "block" }}
              />
            )}
          </div>

          {/* Welcome Video URL */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Welcome Video URL</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>YouTube link shown on the client&apos;s Onboarding tab as their welcome video.</p>
            <input
              type="url"
              value={welcomeVideoUrl}
              onChange={(e) => setWelcomeVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              style={inputStyle}
            />
          </div>

          {/* Intake Form URL */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Intake Form URL</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Google Form link shown on the client&apos;s Onboarding tab for intake completion.</p>
            <input
              type="url"
              value={intakeFormUrl}
              onChange={(e) => setIntakeFormUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/..."
              style={inputStyle}
            />
          </div>

          {/* Campaigns */}
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Campaigns</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Track budget per campaign. Reports can be linked to a campaign to show spent vs. available.</p>
            {/* Existing campaigns */}
            {campaigns.length > 0 && (
              <div className="space-y-2 mb-3">
                {campaigns.map((camp, i) => (
                  <div key={camp.id} className="rounded-lg p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                    {editingCampaignId === camp.id ? (
                      <div className="flex gap-2">
                        <input value={editCampaignName} onChange={(e) => setEditCampaignName(e.target.value)} placeholder="Campaign name" style={{ ...inputStyle, flex: 2 }} />
                        <input type="number" value={editCampaignBudget} onChange={(e) => setEditCampaignBudget(e.target.value)} placeholder="Budget $" style={{ ...inputStyle, flex: 1 }} />
                        <button onClick={() => saveCampaignEdit(camp.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                          style={{ background: "rgba(61,214,140,0.15)", border: "1px solid rgba(61,214,140,0.3)", color: "var(--success)" }}>
                          <Check size={11} /> Save
                        </button>
                        <button onClick={() => setEditingCampaignId(null)} className="px-2 py-1.5 rounded-lg text-xs flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>×</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Campaign {i + 1}: {camp.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {camp.totalBudget > 0 ? `$${camp.totalBudget.toLocaleString()} budget` : "No budget set"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingCampaignId(camp.id); setEditCampaignName(camp.name); setEditCampaignBudget(camp.totalBudget.toString()); }}
                            className="p-1.5 rounded-lg text-xs" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                            Edit
                          </button>
                          <button onClick={() => deleteCampaign(camp.id)} className="p-1.5 rounded-lg">
                            <Trash2 size={12} color="var(--danger)" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Add campaign */}
            <div className="flex gap-2">
              <input value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder={campaigns.length === 0 ? "Campaign 1 name (e.g. Summer 2026)" : `Campaign ${campaigns.length + 1} name`}
                style={{ ...inputStyle, flex: 2 }} />
              <input type="number" value={newCampaignBudget} onChange={(e) => setNewCampaignBudget(e.target.value)}
                placeholder="Budget $" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addCampaign} disabled={campaignSaving || !newCampaignName}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                style={{ background: "var(--accent-muted)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)", opacity: !newCampaignName ? 0.5 : 1 }}>
                <Plus size={11} /> {campaignSaving ? "..." : "Add"}
              </button>
            </div>
          </div>

          {/* Live Campaign Stats */}
          {campaigns.some((c) => c.stats) && (
            <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={12} style={{ color: "var(--accent)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Live Campaign Stats</p>
                <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,59,59,0.08)", color: "var(--accent)", border: "1px solid rgba(255,59,59,0.18)" }}>Grok</span>
              </div>
              <div className="space-y-3">
                {campaigns.filter((c) => c.stats).map((camp) => {
                  const s = camp.stats!;
                  const updatedAgo = (() => {
                    const diff = Date.now() - new Date(s.updatedAt).getTime();
                    const mins = Math.floor(diff / 60_000);
                    if (mins < 60) return `${mins}m ago`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}h ago`;
                    return `${Math.floor(hrs / 24)}d ago`;
                  })();
                  const budget = s.totalBudget ?? camp.totalBudget;
                  const spent = s.amountSpent ?? 0;
                  const budgetPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                  const statusColor = s.status === "Strong" ? "var(--success)" : s.status === "NeedsAttention" ? "var(--accent)" : "var(--text-tertiary)";
                  return (
                    <div key={camp.id} className="rounded-lg p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{camp.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold" style={{ background: `${statusColor}1A`, color: statusColor, border: `1px solid ${statusColor}40` }}>
                            {s.status === "NeedsAttention" ? "Needs Attention" : s.status}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>· {updatedAgo}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 mb-2">
                        {[
                          { label: "Views Total", value: s.viewsTotal >= 1_000_000 ? `${(s.viewsTotal / 1_000_000).toFixed(1)}M` : s.viewsTotal >= 1_000 ? `${(s.viewsTotal / 1_000).toFixed(1)}K` : String(s.viewsTotal) },
                          { label: "Today", value: s.viewsToday >= 1_000 ? `${(s.viewsToday / 1_000).toFixed(1)}K` : String(s.viewsToday) },
                          { label: "Approved", value: String(s.approved) },
                          { label: "Submissions", value: String(s.totalSubmissions) },
                          ...(s.amountSpent != null ? [{ label: "Spent", value: `$${s.amountSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}` }] : []),
                          ...(s.effectiveCpm != null ? [{ label: "Eff. CPM", value: `$${s.effectiveCpm.toFixed(2)}` }] : []),
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{label}</p>
                            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                          </div>
                        ))}
                      </div>
                      {budget > 0 && (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>Budget used</span>
                            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)", fontSize: 10 }}>
                              ${spent.toLocaleString("en-US", { maximumFractionDigits: 0 })} / ${budget.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-default)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${budgetPct}%`, background: budgetPct > 90 ? "var(--accent)" : "var(--success)" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                style={{ background: savingContract ? "var(--border-subtle)" : "var(--accent-muted)", border: `1px solid ${contractSaved ? "rgba(61,214,140,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: contractSaved ? "var(--success)" : "var(--accent)" }}
              >
                {contractSaved ? <><Check size={12} /> Uploaded</> : savingContract ? "Uploading…" : <><Upload size={12} /> Upload PDF</>}
              </button>
              {contractUrl && contractUrl.startsWith("data:") && (
                <button
                  onClick={() => {
                    const [meta, b64] = contractUrl.split(",");
                    const mime = meta.split(":")[1].split(";")[0];
                    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
                    const blob = new Blob([bytes], { type: mime });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = "contract.pdf";
                    a.click();
                    URL.revokeObjectURL(blobUrl);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <FileText size={12} /> Download current
                </button>
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
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </div>

          {/* Client Share Link */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Client Dashboard Link</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
              Share a private link with your client so they can view their campaign analytics — no login required.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={getShareLink}
                disabled={shareLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: shareCopied ? "rgba(61,214,140,0.1)" : "var(--accent-muted)",
                  border: `1px solid ${shareCopied ? "rgba(61,214,140,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`,
                  color: shareCopied ? "var(--success)" : "var(--accent)",
                  opacity: shareLoading ? 0.6 : 1,
                }}
              >
                {shareCopied ? <><Check size={12} /> Copied!</> : shareLoading ? "Generating…" : <><ExternalLink size={12} /> Copy Share Link</>}
              </button>
              {shareToken && (
                <a
                  href={`/share/${shareToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)", textDecoration: "underline" }}
                >
                  Open preview
                </a>
              )}
            </div>
          </div>

          {/* Single save for URL + date fields */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveAllSettings}
              disabled={savingSettings}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: settingsSaved ? "rgba(61,214,140,0.15)" : "var(--accent-muted)", border: `1px solid ${settingsSaved ? "rgba(61,214,140,0.3)" : "color-mix(in srgb, var(--accent) 20%, transparent)"}`, color: settingsSaved ? "var(--success)" : "var(--accent)", opacity: savingSettings ? 0.6 : 1 }}
            >
              {settingsSaved ? <><Check size={14} /> Settings Saved</> : savingSettings ? "Saving…" : <><Save size={14} /> Save Settings</>}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
