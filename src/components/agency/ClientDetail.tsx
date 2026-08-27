"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, Check, ChevronLeft, Save } from "lucide-react";

interface Link { id: string; label: string; url: string; }
interface OnboardingStep { id: string; title: string; description: string | null; linkUrl: string | null; order: number; completed: boolean; }
interface Clipper { id: string; name: string | null; email: string; status: string; }

interface ClientData {
  id: string;
  name: string;
  status: string;
  dealLengthDays: number | null;
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
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#F5F6FA",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

export default function ClientDetail({ client: initial }: { client: ClientData }) {
  const router = useRouter();
  const [client, setClient] = useState(initial);
  const [activeTab, setActiveTab] = useState<"deal" | "links" | "onboarding" | "clippers">("deal");

  // Deal terms state
  const [dealEdit, setDealEdit] = useState(false);
  const [dealForm, setDealForm] = useState({
    name: initial.name,
    dealLengthDays: initial.dealLengthDays?.toString() ?? "",
    pageCount: initial.pageCount?.toString() ?? "",
    clipsPerDay: initial.clipsPerDay?.toString() ?? "",
  });
  const [dealSaving, setDealSaving] = useState(false);

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
        style={{ color: "#8A93A6" }}>
        <ChevronLeft size={14} /> Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B" }}>
              {client.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                {client.name}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>
                {client.clipCount} clips · {client.clippers.length} clippers ·{" "}
                <span style={{ color: client.status === "active" ? "#3DFFA2" : "#FFA500" }}>{client.status}</span>
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
            style={{ color: activeTab === t.id ? "#F5F6FA" : "#8A93A6" }}>
            {t.label}
            {activeTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
          </button>
        ))}
      </div>

      {/* DEAL TERMS */}
      {activeTab === "deal" && (
        <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Deal Terms</h2>
            {dealEdit ? (
              <div className="flex items-center gap-2">
                <button onClick={() => { setDealEdit(false); setDealForm({ name: client.name, dealLengthDays: client.dealLengthDays?.toString() ?? "", pageCount: client.pageCount?.toString() ?? "", clipsPerDay: client.clipsPerDay?.toString() ?? "" }); }}
                  className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "#8A93A6" }}>Cancel</button>
                <button onClick={saveDeal} disabled={dealSaving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "#FF3B3B" }}>
                  <Save size={12} /> {dealSaving ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <button onClick={() => setDealEdit(true)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#8A93A6" }}>
                Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {dealEdit ? (
              <>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client Name</label>
                  <input value={dealForm.name} onChange={(e) => setDealForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Deal Length (days)</label>
                  <input type="number" value={dealForm.dealLengthDays} onChange={(e) => setDealForm((f) => ({ ...f, dealLengthDays: e.target.value }))} placeholder="e.g. 30" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Pages</label>
                  <input type="number" value={dealForm.pageCount} onChange={(e) => setDealForm((f) => ({ ...f, pageCount: e.target.value }))} placeholder="e.g. 5" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Clips / Day</label>
                  <input type="number" value={dealForm.clipsPerDay} onChange={(e) => setDealForm((f) => ({ ...f, clipsPerDay: e.target.value }))} placeholder="e.g. 3" style={inputStyle} />
                </div>
              </>
            ) : (
              <>
                {[
                  { label: "Client Name", value: client.name },
                  { label: "Deal Length", value: client.dealLengthDays ? `${client.dealLengthDays} days` : "—" },
                  { label: "Pages", value: client.pageCount?.toString() ?? "—" },
                  { label: "Clips / Day", value: client.clipsPerDay?.toString() ?? "—" },
                  { label: "Total Clips", value: client.clipCount.toString() },
                  { label: "Started", value: new Date(client.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs mb-1" style={{ color: "#8A93A6" }}>{item.label}</p>
                    <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{item.value}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* LINKS */}
      {activeTab === "links" && (
        <div className="space-y-4">
          {/* Add link form */}
          <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Add Link</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Label</label>
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Onboarding doc, Brand assets..." style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>URL</label>
                <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>
            </div>
            <button onClick={addLink} disabled={linkSaving || !newLabel || !newUrl}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg"
              style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B", opacity: (!newLabel || !newUrl) ? 0.5 : 1 }}>
              <Plus size={12} /> {linkSaving ? "Adding..." : "Add Link"}
            </button>
          </div>

          {/* Links list */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            {links.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm" style={{ color: "#8A93A6" }}>No links yet — add one above</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {links.map((link) => (
                  <div key={link.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{link.label}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#8A93A6" }}>{link.url}</p>
                    </div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5">
                      <ExternalLink size={13} color="#8A93A6" />
                    </a>
                    <button onClick={() => deleteLink(link.id)} className="p-1.5 rounded-lg hover:bg-white/5">
                      <Trash2 size={13} color="#FF4757" />
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
            <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "#8A93A6" }}>Progress</span>
                <span className="text-xs font-medium" style={{ color: "#3DFFA2" }}>{onboardingPct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${onboardingPct}%`, background: "linear-gradient(90deg, #3DFFA2, #FF3B3B)" }} />
              </div>
            </div>
          )}

          {/* Steps list */}
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-4 p-4 rounded-2xl"
                style={{ background: "#0B0E17", border: `1px solid ${step.completed ? "rgba(61,255,162,0.15)" : "rgba(255,255,255,0.08)"}` }}>
                <button onClick={() => toggleStep(step.id, !step.completed)}
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all check-circle"
                  style={{ background: step.completed ? "rgba(61,255,162,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${step.completed ? "#3DFFA2" : "rgba(255,255,255,0.15)"}` }}>
                  {step.completed && <Check size={11} color="#3DFFA2" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: step.completed ? "#8A93A6" : "#F5F6FA", textDecoration: step.completed ? "line-through" : "none" }}>
                    {i + 1}. {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>{step.description}</p>
                  )}
                  {step.linkUrl && (
                    <a href={step.linkUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-1"
                      style={{ color: "#FF3B3B" }}>
                      <ExternalLink size={10} /> {step.linkUrl}
                    </a>
                  )}
                </div>
                <button onClick={() => deleteStep(step.id)} className="p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
                  <Trash2 size={12} color="#FF4757" />
                </button>
              </div>
            ))}
          </div>

          {/* Add step */}
          <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Add Step</h2>
            <div className="space-y-3">
              <input value={newStepTitle} onChange={(e) => setNewStepTitle(e.target.value)}
                placeholder="Step title (e.g. Sign contract)" style={inputStyle} />
              <input value={newStepDesc} onChange={(e) => setNewStepDesc(e.target.value)}
                placeholder="Description (optional)" style={inputStyle} />
              <input type="url" value={newStepLink} onChange={(e) => setNewStepLink(e.target.value)}
                placeholder="Link URL (optional, e.g. https://welcome.example.com)" style={inputStyle} />
              <button onClick={addStep} disabled={stepSaving || !newStepTitle}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg"
                style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B", opacity: !newStepTitle ? 0.5 : 1 }}>
                <Plus size={12} /> {stepSaving ? "Adding..." : "Add Step"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIPPERS */}
      {activeTab === "clippers" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Clipper", "Email", "Status"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {client.clippers.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < client.clippers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{c.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{c.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded-full"
                      style={{ background: c.status === "active" ? "rgba(61,255,162,0.1)" : "rgba(255,165,0,0.1)", color: c.status === "active" ? "#3DFFA2" : "#FFA500" }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {client.clippers.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No clippers assigned</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
