"use client";

import { useState } from "react";
import { installerMessage, isPlausiblePhone } from "@/lib/whatsapp";
import Dialog, { field, labelText } from "./Dialog";
import SendStep from "./SendStep";

const TRADES = ["Plumber", "Mason", "Helper", "Contractor", "Other"];
const EXPERIENCE = ["Under 2 years", "2 to 5 years", "5 to 10 years", "Over 10 years"];

// "Become a RainGrid installer": a short application sent over WhatsApp
// (or previewed in demo mode).
export default function BecomeInstaller({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState(TRADES[0]);
  const [area, setArea] = useState("");
  const [experience, setExperience] = useState(EXPERIENCE[1]);
  const [tried, setTried] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const nameOk = name.trim().length >= 2;
  const phoneOk = isPlausiblePhone(phone);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!nameOk || !phoneOk) return;
    setText(installerMessage({ name, phone, trade, area, experience }));
  };

  return (
    <Dialog title={text ? "Send your application" : "Become a RainGrid installer"} onClose={onClose}>
      {text ? (
        <SendStep text={text} onBack={() => setText(null)} onDone={onClose} />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <p className="text-[13px] text-muted">
            RainGrid is looking for plumbers and masons in Islamabad to fit gutters, first-flush diverters, tanks and recharge
            wells. Pilot installers are trained and vetted before they get jobs.
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
              <span className={labelText}>Trade</span>
              <select value={trade} onChange={(e) => setTrade(e.target.value)} className={field}>
                {TRADES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelText}>Experience</span>
              <select value={experience} onChange={(e) => setExperience(e.target.value)} className={field}>
                {EXPERIENCE.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelText}>Areas you work in</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. G-11, G-10, F-10" className={field} />
          </label>
          <button type="submit" className="btn-primary w-full rounded-xl px-4 py-3 font-semibold">
            Continue
          </button>
        </form>
      )}
    </Dialog>
  );
}
