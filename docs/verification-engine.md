# Verification Engine

Verification produces a confidence/trust score, not proof of authenticity. The engine is designed to discourage obvious misuse, explain risk, and preserve auditability while keeping the golden path functional without optional AI.

## Inputs

- Capture source: `camera`, `gallery`, or `offline_camera_queued`.
- Image files, dimensions, MIME type, byte size, and timestamps.
- SHA-256 hash for exact duplicate detection.
- Perceptual hash for visually similar duplicate detection.
- Collector-declared category, quantity, condition, and region.
- Optional metadata: approximate location, device/session id, capture time, and online/offline state.
- Final recycler physical weight after receipt.

## MVP Checks

| Check | Purpose | Deterministic fallback | Failure behavior |
| --- | --- | --- | --- |
| Upload validation | Accept only safe image types and size bounds. | MIME, extension, dimensions, byte limit. | Reject upload with message. |
| Image quality | Ensure usable evidence. | Blur/brightness/resolution thresholds. | Score penalty or require retake. |
| SHA-256 duplicate | Detect exact reused images. | Hash every image server-side. | Existing hash flags lot. |
| Perceptual duplicate | Detect visually similar reused images. | pHash distance threshold. | Score penalty or flag. |
| E-waste presence | Check that image likely contains e-waste. | If AI unavailable, use manual category confirmation plus quality and multi-angle checks. | Low confidence, not authenticity failure. |
| Category classification | Suggest material category. | Collector selects from material categories; recycler can later dispute. | Require confirmation. |
| Multi-angle evidence | Reward front/back/serial/scale/context views. | Count unique angle labels and pHash diversity. | Score penalty if too few. |
| Quantity plausibility | Compare declared quantity/weight to category bounds and image count. | Rule table by material category. | Flag large mismatch. |
| Final physical verification | Establish commercial truth. | Recycler measured weight. | Variance above threshold flags/disputes. |

## Deterministic MVP Score

Start at 50. Add or subtract:

- +10 camera capture, +5 offline camera queued, +0 gallery upload.
- +10 image quality passes for all required images; -15 for poor quality.
- -35 exact duplicate found.
- -20 perceptual duplicate distance below threshold against another lot.
- +10 AI or manual e-waste presence positive; -20 negative/unknown after review.
- +10 category confidence or collector-confirmed category with safety guide shown.
- +10 at least three distinct angles; +5 two angles; -10 one angle.
- +10 quantity plausible; -15 quantity implausible.
- +10 metadata/session signals consistent; -10 inconsistent.

Clamp to 0-100.

Confidence bands:

- HIGH: 75-100. Can proceed to listing after pricing.
- MEDIUM: 50-74. Can proceed with visible risk explanation; recyclers see caveats.
- LOW: 0-49. Do not list automatically; route to correction, rejection, or admin review.

## AI Unavailable Behavior

If optional AI classification fails, times out, or is not configured, create a `verification_checks` row with `provider='fallback'` and `is_fallback=true`. Use deterministic checks only, ask the collector to confirm category, and keep the workflow available. Do not block listing solely because AI is unavailable if minimum evidence and confidence rules pass.

## Security Limitations

Known bypasses include photographing someone else's e-waste, staging old material, manipulating metadata, using high-quality duplicate variants, or entering false quantity estimates. The MVP mitigates these through hashes, pHash, multi-angle prompts, plausibility checks, trace events, recycler inspection, and final physical weight verification. It does not guarantee provenance or authenticity.

## Lifecycle Integration

`CAPTURED -> VERIFYING` starts verification. `VERIFYING -> VERIFIED` requires HIGH or acceptable MEDIUM confidence. `VERIFYING -> REJECTED` handles unusable or clearly invalid evidence. `VERIFYING -> FLAGGED` handles duplicates, implausible quantity, safety concerns, or suspected abuse.