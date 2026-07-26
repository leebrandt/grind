import { GrindUserError } from "./errors.js";

export function parseDate(input: string, now?: Date): string {
  const raw = input.trim().toLowerCase();
  if (!raw) throw new GrindUserError("Empty date string");

  const ref = now ?? new Date();

  // Relative: today / tomorrow
  if (raw === "today") return fmt(ref);
  if (raw === "tomorrow") {
    const d = new Date(ref);
    d.setDate(d.getDate() + 1);
    return fmt(d);
  }

  // Relative: Nd / Ndays
  const dayMatch = raw.match(/^(\d+)d(?:ays?)?$/);
  if (dayMatch) {
    const d = new Date(ref);
    d.setDate(d.getDate() + Number(dayMatch[1]));
    return fmt(d);
  }

  // Relative: Nw / Nweek / Nweeks
  const weekMatch = raw.match(/^(\d+)w(?:eeks?)?$/);
  if (weekMatch) {
    const d = new Date(ref);
    d.setDate(d.getDate() + Number(weekMatch[1]) * 7);
    return fmt(d);
  }

  // Absolute: YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return buildAndValidate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // Absolute: YYYYMMDD
  const yyyymmddMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmddMatch) {
    return buildAndValidate(Number(yyyymmddMatch[1]), Number(yyyymmddMatch[2]), Number(yyyymmddMatch[3]));
  }

  // Absolute: MMDDYY
  const mmddyyMatch = raw.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (mmddyyMatch) {
    const m = Number(mmddyyMatch[1]);
    const d = Number(mmddyyMatch[2]);
    const y = Number(mmddyyMatch[3]) + 2000;
    return buildAndValidate(y, m, d);
  }

  // Absolute: MMDD (4 digits, not matched by earlier patterns)
  const mmddMatch = raw.match(/^(\d{2})(\d{2})$/);
  if (mmddMatch) {
    const m = Number(mmddMatch[1]);
    const d = Number(mmddMatch[2]);
    const y = ref.getFullYear();
    return buildAndValidate(y, m, d);
  }

  throw new GrindUserError(`Unparseable date: "${input}"`);
}

function buildAndValidate(year: number, month: number, day: number): string {
  if (month < 1 || month > 12) throw new GrindUserError(`Invalid month: ${month}`);
  if (day < 1 || day > 31) throw new GrindUserError(`Invalid day: ${day}`);

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new GrindUserError(`Invalid date: ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
