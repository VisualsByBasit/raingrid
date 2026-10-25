"use client";

import { useState } from "react";
import { PACKAGES, type PackageId } from "@/config/packages";
import { isPlausiblePhone, visitMessage, type Pin } from "@/lib/whatsapp";
import Dialog, { field, labelText } from "./Dialog";
import SendStep from "./SendStep";

const TIMES = ["Weekday morning", "Weekday afternoon", "Weekday evening", "Weekend morning", "Weekend afternoon"];

export interface VisitContext {
  sector: string;
  packageId: PackageId;
  recharge: boolean;
  quote: string | null;
  roofAreaM2: number | null;
  shareLink: string;
  pins: { tank?: Pin | null; downpipe?: Pin | null };
}

// "Request a free site visit": the form, then the WhatsApp message (or its
// demo-mode preview). Roof, quote, link and pins come from the app.
export default function RequestVisit({ ctx, onClose }: { ctx: VisitContext; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState(ctx.sector);
  const [time, setTime] = useState(TIMES[3]);
  const [pkg, setPkg] = useState<PackageId>(ctx.packageId);
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const nameOk = name.trim().length >= 2;
  const phoneOk = isPlausiblePhone(phone);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!nameOk || !phoneOk) return;
    setText(
      visitMessage({
        name,
        phone,
        sector,
        time,
        packageName: PACKAGES[pkg].name,
        notes,
        roofAreaM2: ctx.roofAreaM2,
        // The shown quote belongs to the package it was made for.
        quote: pkg === ctx.packageId ? ctx.quote : null,
        recharge: ctx.recharge,
        shareLink: ctx.shareLink,
        pins: ctx.pins,
      }),
    );
  };

  return (
    <Dialog title={text ? "Send your request" : "Request a free site visit"} onClose={onClose}>
      {text ? (
        <SendStep text={text} onBack={() => setText(null)} onDone={onClose} />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <p className="text-[13px] text-muted">
            A RainGrid installer visits, checks your roof, tank spot and drains, and confirms the price. The visit is free.
          </p>
          <label className="block">
            <span className={labelText}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} aria-invalid={tried && !nameOk} />
            {tried && !nameOk && <span className="text-xs text-drain-deep">Please add your name.</span>}
          </label>
          <label className="block">
            <span className={labelText}>Phone (WhatsApp)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="03xx xxxxxxx"
              className={field}
              aria-invalid={tried && !phoneOk}
            />
            {tried && !phoneOk && <span className="text-xs text-drain-deep">Please add a number we can call back.</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelText}>Sector</span>
              <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. F-10" className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Preferred time</span>
              <select value={time} onChange={(e) => setTime(e.target.value)} className={field}>
                {TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelText}>Package</span>
            <select value={pkg} onChange={(e) => setPkg(e.target.value as PackageId)} className={field}>
              {(Object.keys(PACKAGES) as PackageId[]).map((id) => (
                <option key={id} value={id}>
                  {PACKAGES[id].name}
                  {id === ctx.packageId ? " (your quote)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelText}>Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} placeholder="Access, best landmark, anything we should know" />
          </label>
          <p className="text-[11px] text-muted">
            We add your roof size, the quote and a link to your roof. Nothing leaves this page until you send it in WhatsApp.
          </p>
          <button type="submit" className="btn-primary w-full rounded-xl px-4 py-3 font-semibold">
            Continue
          </button>
        </form>
      )}
    </Dialog>
  );
}
