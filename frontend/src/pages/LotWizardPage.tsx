import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Check, ChevronLeft, ChevronRight, Save, Upload } from "lucide-react";
import { getMaterials } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { conditionOptions, pickupPreferenceOptions, type DraftEvidence, type LocalDraftLot, type MaterialCategory } from "../collector/lot-types";
import { fallbackMaterials, materialName } from "../collector/materials";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { getDraft, markCaptured, saveDraft, saveEvidence } from "../offline/draftRepository";
import { runSync } from "../offline/syncService";

const steps = ["Category", "Evidence", "Condition", "Quantity & Weight", "Pickup", "Review"] as const;
type Errors = Record<string, string>;

export function LotWizardPage() {
  const { lotId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<LocalDraftLot | null>(null);
  const [materials, setMaterials] = useState<MaterialCategory[]>([...fallbackMaterials]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      if (!lotId) return;
      setDraft((await getDraft(lotId)) ?? null);
    }
    void load();
  }, [lotId]);

  useEffect(() => {
    async function loadMaterials() {
      if (!token) return;
      try {
        setMaterials(await getMaterials(token));
      } catch {
        setMaterials([...fallbackMaterials]);
      }
    }
    void loadMaterials();
  }, [token]);

  const selectedMaterial = useMemo(() => materialName(materials, draft?.materialCategoryId), [draft?.materialCategoryId, materials]);

  if (!draft) {
    return <section className="rounded-lg bg-white p-6 shadow-sm" role="status">Loading local draft...</section>;
  }

  const activeDraft = draft;

  if (activeDraft.lotStatus !== "DRAFT") {
    return (
      <section className="rounded-lg bg-white p-6 shadow-sm" role="alert">
        <h1 className="text-2xl font-bold">This lot is already captured.</h1>
        <p className="mt-2 text-slate-600">CAPTURED lots cannot be edited as DRAFT. Evidence captured. Verification is the next step.</p>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 font-semibold text-white" to={`/collector/lots/${activeDraft.localId}`}>View Lot</Link>
      </section>
    );
  }

  function update(patch: Partial<LocalDraftLot>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setErrors({});
  }

  function validate(targetStep = step): Errors {
    const nextErrors: Errors = {};
    if (targetStep >= 0 && !activeDraft.materialCategoryId) nextErrors.material = "Choose the type of e-waste.";
    if (targetStep >= 1 && activeDraft.evidence.length < 1) nextErrors.evidence = "Add at least one photo before submitting.";
    if (targetStep >= 2 && !activeDraft.condition) nextErrors.condition = "Choose the condition.";
    if (targetStep >= 3) {
      if (!activeDraft.quantity || activeDraft.quantity <= 0 || activeDraft.quantity > 10000) nextErrors.quantity = "Enter a quantity greater than 0.";
      if (!activeDraft.estimatedWeightKg || activeDraft.estimatedWeightKg <= 0 || activeDraft.estimatedWeightKg > 10000) nextErrors.weight = "Enter an approximate weight greater than 0 kg.";
    }
    if (targetStep >= 4) {
      if (!activeDraft.pickupCityArea || activeDraft.pickupCityArea.trim().length < 2) nextErrors.city = "Enter a city or pickup area.";
      if (!activeDraft.pickupPinCode || activeDraft.pickupPinCode.trim().length < 3) nextErrors.pin = "Enter a PIN or postal code.";
      if (!activeDraft.pickupPreference) nextErrors.pickup = "Choose a pickup preference.";
    }
    return nextErrors;
  }

  async function persist(showMessage = true) {
    setBusy(true);
    try {
      const saved = await saveDraft(activeDraft);
      setDraft(saved);
      if (showMessage) setMessage("Draft saved on this device.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function continueStep() {
    const nextErrors = validate(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await persist(false);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 5 - activeDraft.evidence.length);
    const accepted: DraftEvidence[] = [];
    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) {
        setErrors({ evidence: "Use JPEG, PNG, or WebP images up to 5 MB." });
        continue;
      }
      accepted.push({
        localId: crypto.randomUUID(),
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        angleLabel: `Photo ${activeDraft.evidence.length + accepted.length + 1}`,
        previewDataUrl: await fileToDataUrl(file),
      });
    }
    const saved = await saveEvidence(activeDraft, [...activeDraft.evidence, ...accepted]);
    setDraft(saved);
    setMessage("Photo evidence saved locally. It has not been verified yet.");
  }

  async function submitCapture() {
    const nextErrors = validate(4);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !token) return;
    setBusy(true);
    try {
      const saved = await saveDraft(activeDraft);
      await runSync(token);
      const refreshed = (await getDraft(saved.localId)) ?? saved;
      const captured = await markCaptured(refreshed);
      await runSync(token);
      const finalDraft = (await getDraft(captured.localId)) ?? captured;
      setMessage("Lot submitted as CAPTURED. Verification is the next step.");
      navigate(`/collector/lots/${finalDraft.localId}`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not submit lot. Your draft is still saved on this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">Step {step + 1} of {steps.length}</p>
        <h1 className="mt-1 text-2xl font-bold">Create E-Waste Lot</h1>
        <div className="mt-4 grid grid-cols-6 gap-1" aria-label="Progress">
          {steps.map((label, index) => <span key={label} className={`h-2 rounded-full ${index <= step ? "bg-emerald-700" : "bg-slate-200"}`} />)}
        </div>
        <p className="mt-3 text-sm text-slate-600">{steps[step]}</p>
        <div className="mt-2"><SyncStatusBadge status={activeDraft.syncStatus} /></div>
      </div>
      {message ? <p className="rounded-lg bg-slate-100 p-3 text-sm" role="status">{message}</p> : null}
      <div className="rounded-lg bg-white p-4 shadow-sm">{renderStep(activeDraft)}</div>
      <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-white p-3 shadow-sm">
        <button className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 px-4 font-semibold" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button"><ChevronLeft size={18} /> Back</button>
        <button className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 px-4 font-semibold" disabled={busy} onClick={() => void persist()} type="button"><Save size={18} /> Save lot</button>
        {step < steps.length - 1 ? <button className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-4 font-semibold text-white" disabled={busy} onClick={() => void continueStep()} type="button">Continue <ChevronRight size={18} /></button> : <button className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-4 font-semibold text-white" disabled={busy} onClick={() => void submitCapture()} type="button"><Check size={18} /> Submit captured lot</button>}
      </div>
    </section>
  );

  function renderStep(current: LocalDraftLot) {
    if (step === 0) return <CategoryStep current={current} materials={materials} errors={errors} update={update} />;
    if (step === 1) return <EvidenceStep current={current} errors={errors} handleFiles={handleFiles} removePhoto={(photoId) => void saveEvidence(current, current.evidence.filter((item) => item.localId !== photoId)).then(setDraft)} />;
    if (step === 2) return <ConditionStep current={current} errors={errors} update={update} />;
    if (step === 3) return <QuantityStep current={current} errors={errors} update={update} />;
    if (step === 4) return <PickupStep current={current} errors={errors} update={update} />;
    return <ReviewStep current={current} selectedMaterial={selectedMaterial} />;
  }
}

function CategoryStep({ current, materials, errors, update }: { current: LocalDraftLot; materials: MaterialCategory[]; errors: Errors; update: (patch: Partial<LocalDraftLot>) => void }) {
  return <div><h2 className="text-xl font-bold">What type of e-waste do you have?</h2><div className="mt-4 grid grid-cols-2 gap-2">{materials.map((material) => <button className={`min-h-16 rounded-lg border p-3 text-left font-semibold ${current.materialCategoryId === material.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`} key={material.id} onClick={() => update({ materialCategoryId: material.id })} type="button">{material.name}</button>)}</div>{errors.material ? <p className="mt-2 text-sm text-red-700">{errors.material}</p> : null}</div>;
}

function EvidenceStep({ current, errors, handleFiles, removePhoto }: { current: LocalDraftLot; errors: Errors; handleFiles: (event: ChangeEvent<HTMLInputElement>) => void; removePhoto: (photoId: string) => void }) {
  return <div><h2 className="text-xl font-bold">Photo evidence</h2><p className="mt-2 text-slate-600">Add 1 to 5 photos. Three photos are recommended for stronger verification later.</p><label className="mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg bg-emerald-700 px-4 font-semibold text-white"><Camera size={18} /> Take or choose photo<input accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" multiple onChange={(event) => void handleFiles(event)} type="file" /></label><label className="ml-2 mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 font-semibold"><Upload size={18} /> Gallery<input accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => void handleFiles(event)} type="file" /></label>{errors.evidence ? <p className="mt-2 text-sm text-red-700">{errors.evidence}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{current.evidence.map((photo) => <div key={photo.localId}><img alt={photo.angleLabel} className="aspect-square rounded-lg object-cover" src={photo.previewDataUrl} /><button className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 text-sm" onClick={() => removePhoto(photo.localId)} type="button">Remove</button></div>)}</div></div>;
}

function ConditionStep({ current, errors, update }: { current: LocalDraftLot; errors: Errors; update: (patch: Partial<LocalDraftLot>) => void }) {
  return <div><h2 className="text-xl font-bold">Condition</h2><div className="mt-4 grid gap-2">{conditionOptions.map((option) => <button className={`min-h-12 rounded-lg border px-4 text-left font-semibold ${current.condition === option.value ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`} key={option.value} onClick={() => update({ condition: option.value })} type="button">{option.label}</button>)}</div>{errors.condition ? <p className="mt-2 text-sm text-red-700">{errors.condition}</p> : null}</div>;
}

function QuantityStep({ current, errors, update }: { current: LocalDraftLot; errors: Errors; update: (patch: Partial<LocalDraftLot>) => void }) {
  return <div><h2 className="text-xl font-bold">Quantity and weight</h2><label className="mt-4 block font-medium">Number of items<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4" min="1" onChange={(event) => update({ quantity: Number(event.target.value) })} type="number" value={current.quantity ?? ""} /></label>{errors.quantity ? <p className="mt-1 text-sm text-red-700">{errors.quantity}</p> : null}<label className="mt-4 block font-medium">Approximate weight in kg<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4" min="0.1" step="0.1" onChange={(event) => update({ estimatedWeightKg: Number(event.target.value) })} type="number" value={current.estimatedWeightKg ?? ""} /></label>{errors.weight ? <p className="mt-1 text-sm text-red-700">{errors.weight}</p> : null}<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Approximate weight is okay. The recycler will verify the final weight during handover.</p></div>;
}

function PickupStep({ current, errors, update }: { current: LocalDraftLot; errors: Errors; update: (patch: Partial<LocalDraftLot>) => void }) {
  return <div><h2 className="text-xl font-bold">Pickup information</h2><label className="mt-4 block font-medium">City / Area<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4" onChange={(event) => update({ pickupCityArea: event.target.value })} value={current.pickupCityArea ?? ""} /></label>{errors.city ? <p className="mt-1 text-sm text-red-700">{errors.city}</p> : null}<label className="mt-4 block font-medium">PIN code<input className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4" onChange={(event) => update({ pickupPinCode: event.target.value })} value={current.pickupPinCode ?? ""} /></label>{errors.pin ? <p className="mt-1 text-sm text-red-700">{errors.pin}</p> : null}<div className="mt-4 grid gap-2">{pickupPreferenceOptions.map((option) => <button className={`min-h-12 rounded-lg border px-4 text-left font-semibold ${current.pickupPreference === option.value ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`} key={option.value} onClick={() => update({ pickupPreference: option.value })} type="button">{option.label}</button>)}</div>{errors.pickup ? <p className="mt-1 text-sm text-red-700">{errors.pickup}</p> : null}</div>;
}

function ReviewStep({ current, selectedMaterial }: { current: LocalDraftLot; selectedMaterial: string }) {
  return <div><h2 className="text-xl font-bold">Review lot</h2><dl className="mt-4 grid gap-3"><div><dt className="text-sm text-slate-500">Category</dt><dd className="font-semibold">{selectedMaterial}</dd></div><div><dt className="text-sm text-slate-500">Photos</dt><dd className="font-semibold">{current.evidence.length} uploaded</dd></div><div><dt className="text-sm text-slate-500">Condition</dt><dd className="font-semibold">{current.condition}</dd></div><div><dt className="text-sm text-slate-500">Quantity</dt><dd className="font-semibold">{current.quantity} pieces</dd></div><div><dt className="text-sm text-slate-500">Estimated weight</dt><dd className="font-semibold">{current.estimatedWeightKg} kg</dd></div><div><dt className="text-sm text-slate-500">Pickup</dt><dd className="font-semibold">{current.pickupCityArea}, {current.pickupPinCode} - {current.pickupPreference}</dd></div></dl><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This lot has NOT yet been verified or priced. Recycler matching has not happened yet.</p></div>;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}