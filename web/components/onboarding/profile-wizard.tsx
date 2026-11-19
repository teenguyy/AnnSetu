"use client";

import { Check, Clock, LocateFixed, Plus, Trash2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, inputClass } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LocationPicker = dynamic(() => import("./location-picker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-[18px] bg-surface" />,
});

export type OrgDraft = {
  id?: string;
  kind: "donor" | "ngo";
  org_type: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  about: string;
  operating_hours: Record<string, string>;
  pickup_windows: string[];
  fssai_number: string;
  area_served: string;
  beneficiaries_per_day: string;
  logo_path: string | null;
  no_certificate: boolean;
  no_cert_explanation: string;
  no_cert_references: string;
  status?: string;
  rejection_note?: string | null;
};

const TYPES = {
  donor: [
    ["restaurant", "Restaurant"], ["hotel", "Hotel"], ["canteen", "Canteen"], ["caterer", "Caterer"],
    ["event_organiser", "Event organiser"], ["food_business", "Food business"], ["community_kitchen", "Community kitchen"],
  ],
  ngo: [
    ["ngo", "NGO"], ["shelter", "Shelter"], ["orphanage", "Orphanage"], ["old_age_home", "Old-age home"],
    ["community_kitchen", "Community kitchen"], ["community_group", "Local community group"],
  ],
} as const;
const NO_CERT_TYPES = { donor: ["community_kitchen"], ngo: ["ngo", "community_group", "community_kitchen"] };

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]] as const;

const STEPS = ["Organisation", "Location", "About & hours", "Details", "Review"] as const;
type Errors = Record<string, string>;

function validate(step: number, d: OrgDraft): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.name.trim().length < 2) e.name = "Enter your organisation’s name";
    if (!d.org_type) e.org_type = "Choose a type";
    if (d.contact_person.trim().length < 2) e.contact_person = "Enter a contact person";
    if (!/^\+?[0-9 ]{7,20}$/.test(d.phone.trim())) e.phone = "Enter a valid phone number, e.g. +91 98765 43210";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = "Enter a valid email";
  }
  if (step === 1) {
    if (d.address.trim().length < 5) e.address = "Enter the full address";
    if (d.city.trim().length < 2) e.city = "Enter the city";
    if (!d.state) e.state = "Choose the state";
    if (!/^[0-9]{6}$/.test(d.pincode.trim())) e.pincode = "Pincode has 6 digits";
    if (d.lat === null || d.lng === null) e.location = "Drop a pin on the map or use your location";
  }
  if (step === 2) {
    if (d.about.trim().length < 40) e.about = `Tell us a little more (${d.about.trim().length}/40 characters)`;
    if (Object.keys(d.operating_hours).length === 0) e.hours = "Add operating hours for at least one day";
    if (d.pickup_windows.length === 0) e.windows = "Add at least one pickup window";
  }
  if (step === 3) {
    if (d.kind === "ngo" && d.area_served.trim().length < 2) e.area_served = "Describe the area you serve";
    if (d.kind === "ngo" && !(Number(d.beneficiaries_per_day) >= 1)) e.beneficiaries_per_day = "Approximate number of people per day";
    if (d.fssai_number && !/^[0-9]{14}$/.test(d.fssai_number)) e.fssai_number = "FSSAI numbers have 14 digits";
    if (d.no_certificate && d.no_cert_explanation.trim().length < 50) e.no_cert_explanation = "Explain who you serve and since when (at least 50 characters)";
  }
  return e;
}

function toRow(d: OrgDraft) {
  return {
    org_type: d.org_type,
    name: d.name.trim(),
    contact_person: d.contact_person.trim() || null,
    phone: d.phone.trim() || null,
    email: d.email.trim() || null,
    address: d.address.trim() || null,
    city: d.city.trim() || null,
    state: d.state || null,
    pincode: d.pincode.trim() || null,
    location: d.lat !== null && d.lng !== null ? `SRID=4326;POINT(${d.lng} ${d.lat})` : null,
    about: d.about.trim() || null,
    operating_hours: d.operating_hours,
    pickup_windows: d.pickup_windows,
    fssai_number: d.fssai_number.trim() || null,
    area_served: d.area_served.trim() || null,
    beneficiaries_per_day: d.beneficiaries_per_day ? Number(d.beneficiaries_per_day) : null,
    logo_path: d.logo_path,
    no_certificate: d.no_certificate,
    no_cert_explanation: d.no_certificate ? d.no_cert_explanation.trim() || null : null,
    no_cert_references: d.no_certificate ? d.no_cert_references.trim() || null : null,
  };
}

export function ProfileWizard({ initial, userId }: { initial: OrgDraft; userId: string }) {
  const router = useRouter();
  const [d, setD] = useState<OrgDraft>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState("");
  const [locating, setLocating] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ open: "09:00", close: "21:00" });
  const [windowDraft, setWindowDraft] = useState({ from: "19:00", to: "21:00" });

  const set = <K extends keyof OrgDraft>(k: K, v: OrgDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const supabase = createClient();
  const noCertAllowed = (NO_CERT_TYPES[d.kind] as readonly string[]).includes(d.org_type);

  const save = async (): Promise<string | null> => {
    const row = toRow(d);
    if (!d.id) {
      const { data, error } = await supabase
        .from("organizations")
        .insert({ ...row, owner_id: userId, kind: d.kind })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      set("id", data.id);
      return data.id;
    }
    const { error } = await supabase.from("organizations").update(row).eq("id", d.id);
    if (error) throw new Error(error.message.includes("locked after verification") ? error.message : `Couldn’t save: ${error.message}`);
    return d.id;
  };

  const next = async () => {
    const e = validate(step, d);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setAlert("");
    try {
      await save();
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setAlert(err instanceof Error ? err.message : "Couldn’t save");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setAlert("");
    try {
      await save();
      const { error } = await supabase.rpc("complete_my_profile");
      if (error) throw new Error(error.message);
      router.replace("/dashboard?welcome=1");
      router.refresh();
    } catch (err) {
      setAlert(err instanceof Error ? err.message : "Couldn’t submit");
      setBusy(false);
    }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return setErrors((e) => ({ ...e, location: "Your browser can’t share location; drop a pin instead." }));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setD((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setErrors((e) => ({ ...e, location: "Location permission was denied; drop a pin on the map instead." }));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const uploadLogo = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) return setAlert("Logo must be PNG, JPG, WebP or SVG.");
    if (file.size > 1024 * 1024) return setAlert("Logo must be 1 MB or smaller.");
    setBusy(true);
    try {
      const orgId = await save();
      const path = `${orgId}/logo-${Date.now()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
      const { error } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      set("logo_path", path);
      setAlert("");
    } catch (err) {
      setAlert(err instanceof Error ? `Logo upload failed: ${err.message}` : "Logo upload failed");
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = (TYPES[d.kind] as readonly (readonly [string, string])[]).find(([v]) => v === d.org_type)?.[1] ?? "";

  return (
    <div>
      {initial.status === "rejected" && initial.rejection_note && (
        <FormAlert>Verification feedback from AnnSetu: “{initial.rejection_note}”. Update your details and submit again.</FormAlert>
      )}
      <ol aria-label="Progress" className="mb-8 mt-4 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={cn("block h-1.5 rounded-full transition-colors", i <= step ? "bg-ocean" : "bg-line")} />
            <span className={cn("mt-2 hidden text-xs font-medium sm:block", i === step ? "text-text" : "text-muted")} aria-current={i === step ? "step" : undefined}>
              {s}
            </span>
          </li>
        ))}
      </ol>
      <h2 className="font-display text-2xl font-semibold">{STEPS[step]}</h2>
      <p className="sr-only" aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      <div className="mt-6 space-y-4">
        {step === 0 && (
          <>
            <Field id="name" label="Organisation name" value={d.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoComplete="organization" />
            <label htmlFor="org_type" className="block text-sm font-medium">
              Type
              <select id="org_type" value={d.org_type} onChange={(e) => set("org_type", e.target.value)} className={inputClass} aria-invalid={!!errors.org_type}>
                <option value="">Choose…</option>
                {TYPES[d.kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {errors.org_type && <span className="mt-1 block text-sm text-danger">{errors.org_type}</span>}
            </label>
            <Field id="contact_person" label="Contact person" value={d.contact_person} onChange={(e) => set("contact_person", e.target.value)} error={errors.contact_person} autoComplete="name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="phone" label="Phone" type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} autoComplete="tel" hint="Used for pickups; verified by OTP later" />
              <Field id="org_email" label="Email" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} error={errors.email} autoComplete="email" />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field id="address" label="Full address" value={d.address} onChange={(e) => set("address", e.target.value)} error={errors.address} autoComplete="street-address" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="city" label="City" value={d.city} onChange={(e) => set("city", e.target.value)} error={errors.city} autoComplete="address-level2" />
              <label htmlFor="state" className="block text-sm font-medium">
                State
                <select id="state" value={d.state} onChange={(e) => set("state", e.target.value)} className={inputClass} aria-invalid={!!errors.state}>
                  <option value="">Choose…</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {errors.state && <span className="mt-1 block text-sm text-danger">{errors.state}</span>}
              </label>
              <Field id="pincode" label="Pincode" inputMode="numeric" value={d.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} error={errors.pincode} autoComplete="postal-code" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Location on the map</p>
                <Button type="button" variant="ghost" size="sm" onClick={locate} disabled={locating} className="ring-1 ring-line">
                  <LocateFixed className="size-4" aria-hidden /> {locating ? "Locating…" : "Use my location"}
                </Button>
              </div>
              <p className="mb-2 text-xs text-muted">Tap the map to drop a pin, then drag it to your exact gate. Used for distance and directions.</p>
              <LocationPicker value={d.lat !== null && d.lng !== null ? { lat: d.lat, lng: d.lng } : null} onChange={(v) => setD((x) => ({ ...x, lat: v.lat, lng: v.lng }))} />
              {d.lat !== null && d.lng !== null && <p className="mt-1 text-xs text-muted">Pinned at {d.lat.toFixed(5)}, {d.lng.toFixed(5)}</p>}
              {errors.location && <p className="mt-1 text-sm text-danger">{errors.location}</p>}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label htmlFor="about" className="block text-sm font-medium">
              About your organisation
              <textarea id="about" rows={5} value={d.about} onChange={(e) => set("about", e.target.value)} className={cn(inputClass, "h-auto py-3")} aria-invalid={!!errors.about} maxLength={2000} />
              <span className={cn("mt-1 block text-xs", errors.about ? "text-danger" : "text-muted")}>{errors.about ?? `${d.about.trim().length} characters (minimum 40)`}</span>
            </label>
            <fieldset>
              <legend className="flex items-center gap-2 text-sm font-medium"><Clock className="size-4" aria-hidden /> Operating hours</legend>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted">Opens<input type="time" value={hoursDraft.open} onChange={(e) => setHoursDraft((h) => ({ ...h, open: e.target.value }))} className={cn(inputClass, "w-32")} /></label>
                <label className="text-xs text-muted">Closes<input type="time" value={hoursDraft.close} onChange={(e) => setHoursDraft((h) => ({ ...h, close: e.target.value }))} className={cn(inputClass, "w-32")} /></label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {DAYS.map(([k, l]) => {
                  const on = k in d.operating_hours;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const h = { ...d.operating_hours };
                        if (on) delete h[k];
                        else h[k] = `${hoursDraft.open}-${hoursDraft.close}`;
                        set("operating_hours", h);
                      }}
                      className={cn("min-h-11 rounded-full px-4 text-sm font-semibold ring-1", on ? "bg-ink text-cream ring-ink dark:bg-sunshine dark:text-ink" : "bg-surface-2 ring-line")}
                    >
                      {l}{on && <span className="ml-1 font-normal opacity-80">{d.operating_hours[k]}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">Set the times, then tap each day you’re open.</p>
              {errors.hours && <p className="mt-1 text-sm text-danger">{errors.hours}</p>}
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">{d.kind === "donor" ? "When can food be picked up?" : "When can your representatives collect?"}</legend>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted">From<input type="time" value={windowDraft.from} onChange={(e) => setWindowDraft((w) => ({ ...w, from: e.target.value }))} className={cn(inputClass, "w-32")} /></label>
                <label className="text-xs text-muted">To<input type="time" value={windowDraft.to} onChange={(e) => setWindowDraft((w) => ({ ...w, to: e.target.value }))} className={cn(inputClass, "w-32")} /></label>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  className="ring-1 ring-line"
                  onClick={() => {
                    const w = `${windowDraft.from}-${windowDraft.to}`;
                    if (windowDraft.from >= windowDraft.to) return setErrors((e) => ({ ...e, windows: "The window must end after it starts" }));
                    if (!d.pickup_windows.includes(w)) set("pickup_windows", [...d.pickup_windows, w]);
                    setErrors((e) => ({ ...e, windows: "" }));
                  }}
                >
                  <Plus className="size-4" aria-hidden /> Add window
                </Button>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {d.pickup_windows.map((w) => (
                  <li key={w} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-4 pr-1 ring-1 ring-line">
                    {w.replace("-", " – ")}
                    <button type="button" aria-label={`Remove ${w}`} onClick={() => set("pickup_windows", d.pickup_windows.filter((x) => x !== w))} className="grid size-9 place-items-center rounded-full hover:bg-bg">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              {errors.windows && <p className="mt-1 text-sm text-danger">{errors.windows}</p>}
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            {d.kind === "ngo" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="area_served" label="Area served" value={d.area_served} onChange={(e) => set("area_served", e.target.value)} error={errors.area_served} hint="Neighbourhoods or districts" />
                <Field id="beneficiaries" label="People served per day (approx.)" inputMode="numeric" value={d.beneficiaries_per_day} onChange={(e) => set("beneficiaries_per_day", e.target.value.replace(/\D/g, "").slice(0, 7))} error={errors.beneficiaries_per_day} />
              </div>
            ) : (
              <Field id="fssai" label="FSSAI licence number (optional)" inputMode="numeric" value={d.fssai_number} onChange={(e) => set("fssai_number", e.target.value.replace(/\D/g, "").slice(0, 14))} error={errors.fssai_number} hint="14 digits. You’ll upload the licence itself in Documents." />
            )}
            <div>
              <p className="text-sm font-medium">Logo (optional)</p>
              <label className="mt-2 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-5 font-label text-sm font-semibold ring-1 ring-line hover:ring-ocean">
                <Upload className="size-4" aria-hidden /> {d.logo_path ? "Replace logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              </label>
              {d.logo_path && <p className="mt-1 flex items-center gap-1 text-xs text-success"><Check className="size-3.5" aria-hidden /> Logo uploaded</p>}
            </div>
            {noCertAllowed && (
              <div className="rounded-[18px] bg-surface p-5 ring-1 ring-line">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={d.no_certificate} onChange={(e) => set("no_certificate", e.target.checked)} className="mt-1 size-5 accent-[var(--ocean)]" />
                  <span>
                    <span className="block font-semibold">We don’t have a registration certificate</span>
                    <span className="text-sm text-muted">We’ll review your request manually.</span>
                  </span>
                </label>
                {d.no_certificate && (
                  <div className="mt-4 space-y-4">
                    <label htmlFor="ncx" className="block text-sm font-medium">
                      Who do you serve, and since when?
                      <textarea id="ncx" rows={4} value={d.no_cert_explanation} onChange={(e) => set("no_cert_explanation", e.target.value)} className={cn(inputClass, "h-auto py-3")} aria-invalid={!!errors.no_cert_explanation} maxLength={3000} />
                      {errors.no_cert_explanation && <span className="mt-1 block text-sm text-danger">{errors.no_cert_explanation}</span>}
                    </label>
                    <Field id="ncr" label="References (optional)" value={d.no_cert_references} onChange={(e) => set("no_cert_references", e.target.value)} hint="Names and phone numbers of people who know your work" />
                    <p className="text-sm text-muted">You can add photos, letters or ID as supporting proof in Documents after submitting.</p>
                    <p className="rounded-[14px] bg-sunshine/40 px-4 py-3 text-sm font-semibold text-ink">Your request will be reviewed within 3–5 business days.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <dl className="divide-y divide-line overflow-hidden rounded-[18px] bg-surface-2 ring-1 ring-line">
            {[
              ["Organisation", `${d.name} · ${typeLabel}`],
              ["Contact", `${d.contact_person} · ${d.phone} · ${d.email}`],
              ["Address", `${d.address}, ${d.city}, ${d.state} ${d.pincode}`],
              ["Hours", Object.entries(d.operating_hours).map(([k, v]) => `${k} ${v}`).join(", ")],
              ["Pickup windows", d.pickup_windows.join(", ")],
              ...(d.kind === "ngo" ? [["Serves", `${d.area_served} · ~${d.beneficiaries_per_day} people/day`]] : d.fssai_number ? [["FSSAI", d.fssai_number]] : []),
              ...(d.no_certificate ? [["Verification", "Manual review (no certificate), 3–5 business days"]] : []),
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {alert && <div className="mt-5"><FormAlert>{alert}</FormAlert></div>}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="lg" className="ring-1 ring-line" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="solid" size="lg" arrow onClick={next} disabled={busy}>{busy ? "Saving…" : "Save & continue"}</Button>
        ) : (
          <Button type="button" variant="primary" size="lg" arrow onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</Button>
        )}
      </div>
    </div>
  );
}
