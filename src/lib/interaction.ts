function validateGeometry(top: number, height: number, viewport: number, header = 0): void {
  if (![top, height, viewport].every(Number.isFinite) || height < 0 || viewport <= 0) {
    throw new RangeError("Scene geometry must be finite with a positive viewport.");
  }
  if (!Number.isFinite(header) || header < 0) throw new RangeError("The header height must be finite and nonnegative.");
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function sceneProgress(top: number, height: number, viewport: number, header = 0): number {
  validateGeometry(top, height, viewport, header);
  const available = Math.max(1, viewport - header);
  return clamp((header + available * 0.9 - top) / (available * 0.56 + Math.min(height, available) * 0.3));
}

export function serviceProgress(top: number, height: number, viewport: number, header = 0): number {
  validateGeometry(top, height, viewport, header);
  const available = Math.max(1, viewport - header);
  // Keep the main transition around the artwork's center, not its first edge entering view.
  const center = top + height / 2;
  return clamp((header + available * 0.72 - center) / (available * 0.4));
}

export function travelProgress(top: number, travel: number, start: number): number {
  if (![top, travel, start].every(Number.isFinite) || travel <= 0 || start < 0) {
    throw new RangeError("Scroll travel must be positive with a finite top and nonnegative start.");
  }
  return clamp((start - top) / travel);
}

export function stageProgress(progress: number, start: number, end: number): number {
  if (![progress, start, end].every(Number.isFinite) || start < 0 || end > 1 || start >= end) {
    throw new RangeError("An animation stage must have an increasing range within zero and one.");
  }
  return clamp((progress - start) / (end - start));
}

export function canPinHero(width: number, viewport: number, header: number, content: number): boolean {
  if (![width, viewport, header, content].every(Number.isFinite) || width <= 0 || viewport <= 0 || header < 0 || content <= 0) {
    throw new RangeError("Sticky eligibility requires positive viewport/content sizes and a nonnegative header.");
  }
  return width >= 1100 && viewport >= 780 && content <= viewport - header - 8;
}
