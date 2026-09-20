"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type FormRow = { employeeId: string; employeeName: string; missing: string[] };
type FormsData = {
  month: string;
  sourceRunCount: number;
  companyMissing: string[];
  rows: FormRow[];
  company: { statutorySignatureDataUrl: string };
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

export default function GovernmentFormsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<FormsData | null>(null);
  const [form, setForm] = useState<"nhi" | "ssb">("nhi");
  const [signedDate, setSignedDate] = useState(currentDate());
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"nhi" | "ssb" | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureHasInk, setSignatureHasInk] = useState(false);
  const [penWidth, setPenWidth] = useState(1.5);
  const [error, setError] = useState("");
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingSignatureRef = useRef(false);
  const signaturePointRef = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/payroll/statutory-forms?month=${encodeURIComponent(month)}`, {
        headers: { ...authHeaders() }
      });
      setData(await readApiData<FormsData>(response));
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : "Government forms could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    let active = true;
    let objectUrl = "";
    setPreviewLoading(true);
    setPreviewUrl("");
    setError("");
    void fetch(`${apiBase()}/payroll/statutory-forms/${form}/preview.svg?month=${encodeURIComponent(month)}&signedDate=${encodeURIComponent(signedDate)}`, {
      headers: { ...authHeaders() }
    })
      .then(async (response) => {
        if (!response.ok) await readApiData(response, "The official preview could not be created.");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "The official preview could not be created.");
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data, form, month, signedDate]);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const saved = data?.company.statutorySignatureDataUrl;
    setSignatureHasInk(Boolean(saved));
    if (!saved) return;
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    };
    image.src = saved;
  }, [data?.company.statutorySignatureDataUrl]);

  const employeeWarnings = data?.rows.filter((row) => row.missing.length) ?? [];
  const isIncomplete = Boolean(data && (data.companyMissing.length || employeeWarnings.length));
  const canDownload = Boolean(data && previewUrl);

  async function download(kind: "nhi" | "ssb") {
    setDownloading(kind);
    setError("");
    try {
      const response = await fetch(
        `${apiBase()}/payroll/statutory-forms/${kind}.pdf?month=${encodeURIComponent(month)}&signedDate=${encodeURIComponent(signedDate)}`,
        { headers: { ...authHeaders() } }
      );
      if (!response.ok) await readApiData(response, "The official form could not be created.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = kind === "nhi" ? `NHI-Form-K-${month}.pdf` : `SSB-Forms-I-II-${month}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The official form could not be created.");
    } finally {
      setDownloading(null);
    }
  }

  function signaturePoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) * (canvas.width / bounds.width),
      y: (clientY - bounds.top) * (canvas.height / bounds.height)
    };
  }

  function startSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = signaturePoint(event.currentTarget, event.clientX, event.clientY);
    drawingSignatureRef.current = true;
    setSignatureHasInk(true);
    signaturePointRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }

  function drawSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingSignatureRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const scale = canvas.width / bounds.width;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples) {
      const previous = signaturePointRef.current;
      const point = signaturePoint(canvas, sample.clientX, sample.clientY);
      if (!previous) {
        signaturePointRef.current = point;
        continue;
      }
      const midpoint = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
      const pressure = sample.pointerType === "pen" && sample.pressure > 0 ? sample.pressure : 0.5;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.quadraticCurveTo(midpoint.x, midpoint.y, point.x, point.y);
      context.lineWidth = penWidth * scale * (0.8 + pressure * 0.4);
      context.stroke();
      signaturePointRef.current = point;
    }
  }

  function endSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingSignatureRef.current = false;
    signaturePointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function clearSignature() {
    const canvas = signatureCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureHasInk(false);
    if (data?.company.statutorySignatureDataUrl) await saveSignature("");
  }

  async function saveSignature(value?: string) {
    const canvas = signatureCanvasRef.current;
    if (!canvas && value === undefined) return;
    setSavingSignature(true);
    setError("");
    try {
      const signature = value ?? canvas!.toDataURL("image/png");
      const response = await fetch(`${apiBase()}/settings/org`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ statutorySignatureDataUrl: signature })
      });
      if (!response.ok) await readApiData(response, "The signature could not be saved.");
      if (value === "") {
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureHasInk(false);
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The signature could not be saved.");
    } finally {
      setSavingSignature(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Payroll</p>
          <h1 className="font-serif text-3xl text-slate-950">Government forms</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-700">Contribution month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2" />
          </label>
          <button type="button" onClick={() => void load()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Refresh</button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {loading ? <p className="text-sm text-slate-600">Loading payroll entries...</p> : null}

      {data && isIncomplete ? (
        <section className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">
          <h2 className="font-bold">Complete these details before creating the forms</h2>
          {data.companyMissing.length ? <p className="mt-1"><Link href="/dashboard/settings" className="font-semibold underline">Company settings</Link>: {data.companyMissing.join(", ")}</p> : null}
          {employeeWarnings.map((row) => (
            <p key={row.employeeId} className="mt-1"><Link href={`/dashboard/people/employees/${row.employeeId}`} className="font-semibold underline">{row.employeeName}</Link>: {row.missing.join(", ")}</p>
          ))}
        </section>
      ) : null}

      {data && data.sourceRunCount === 0 ? (
        <section className="border-l-4 border-slate-400 bg-white p-4 text-sm text-slate-700">
          No finalized, exported, or paid payroll was found for {displayMonth(month)}.
        </section>
      ) : null}

      <section className="grid gap-5 border border-slate-300 bg-white p-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <h2 className="font-serif text-xl text-slate-950">Digital signature</h2>
          <div className="mt-3 flex max-w-4xl items-center gap-3">
            <label htmlFor="signature-pen-width" className="text-sm font-medium text-slate-700">Pen width</label>
            <input
              id="signature-pen-width"
              type="range"
              min="0.8"
              max="3"
              step="0.1"
              value={penWidth}
              onChange={(event) => setPenWidth(Number(event.target.value))}
              className="w-48"
            />
            <span className="text-sm text-slate-600">{penWidth.toFixed(1)}</span>
          </div>
          <canvas
            ref={signatureCanvasRef}
            width={1200}
            height={220}
            aria-label="Draw employer signature"
            onPointerDown={startSignature}
            onPointerMove={drawSignature}
            onPointerUp={endSignature}
            onPointerCancel={endSignature}
            className="mt-3 h-40 w-full max-w-4xl touch-none border border-slate-300 bg-white"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={savingSignature || !signatureHasInk} onClick={() => void saveSignature()} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {savingSignature ? "Saving..." : "Save signature"}
            </button>
            <button type="button" disabled={savingSignature || !signatureHasInk} onClick={() => void clearSignature()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
              Clear signature
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Date signed
            <input type="date" value={signedDate} onChange={(event) => setSignedDate(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
          </label>
          <button type="button" onClick={() => setSignedDate(currentDate())} className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Use today</button>
          <p className="mt-3 text-sm text-slate-600">The saved signature and selected date appear on both official forms.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-300 bg-white p-5">
          <p className="text-xs font-bold uppercase text-emerald-800">Official BVI template</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-950">NHI Form K</h2>
          <p className="mt-2 text-sm text-slate-600">National Health Insurance contribution remittance form, including continuation pages when required.</p>
          <button type="button" disabled={!canDownload || downloading !== null} onClick={() => void download("nhi")} className="mt-5 w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {downloading === "nhi" ? "Creating official PDF..." : "Download current NHI Form K"}
          </button>
        </div>

        <div className="rounded-md border border-slate-300 bg-white p-5">
          <p className="text-xs font-bold uppercase text-emerald-800">Official BVI template</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-950">SSB Forms I / II</h2>
          <p className="mt-2 text-sm text-slate-600">Social Security monthly remittance form with Form II continuation pages when required.</p>
          <button type="button" disabled={!canDownload || downloading !== null} onClick={() => void download("ssb")} className="mt-5 w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {downloading === "ssb" ? "Creating official PDF..." : "Download current SSB Forms I / II"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Official form preview">
            <button type="button" onClick={() => setForm("nhi")} className={`rounded-md px-4 py-2 text-sm font-semibold ${form === "nhi" ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700"}`}>NHI Form K preview</button>
            <button type="button" onClick={() => setForm("ssb")} className={`rounded-md px-4 py-2 text-sm font-semibold ${form === "ssb" ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700"}`}>SSB Forms I / II preview</button>
          </div>
          {previewLoading ? <p className="text-sm text-slate-600">Updating official preview...</p> : null}
        </div>
        {previewUrl ? (
          <div className="overflow-auto border border-slate-300 bg-slate-100 p-3 sm:p-5">
          <img
            key={previewUrl}
            alt={form === "nhi" ? "NHI Form K live preview" : "SSB Forms I and II live preview"}
            src={previewUrl}
            className="mx-auto h-auto min-w-[760px] max-w-full bg-white shadow-sm"
          />
          </div>
        ) : null}
      </section>

      {data ? <p className="text-sm text-slate-600">Payroll source: {data.sourceRunCount} finalized, exported, or paid run{data.sourceRunCount === 1 ? "" : "s"} for {displayMonth(month)}.</p> : null}
    </main>
  );
}
