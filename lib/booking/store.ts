import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BookingAttempt, Referral } from "./model";

export type BookingStoreData = {
  attempts: BookingAttempt[];
  referrals: Referral[];
};

const DEFAULT_PATH = path.join(process.cwd(), "data", "runtime", "bookings.json");

export function bookingStorePath(): string {
  const override = process.env.BOOKING_STORE_PATH?.trim();
  return override || DEFAULT_PATH;
}

function emptyStore(): BookingStoreData {
  return { attempts: [], referrals: [] };
}

async function readStore(): Promise<BookingStoreData> {
  try {
    const raw = await readFile(bookingStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<BookingStoreData>;
    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyStore();
    }
    throw error;
  }
}

async function writeStore(store: BookingStoreData): Promise<void> {
  const filePath = bookingStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tempPath, filePath);
}

let chain: Promise<void> = Promise.resolve();

export function updateBookingStore<T>(
  change: (store: BookingStoreData) => T | Promise<T>,
): Promise<T> {
  const run = chain.then(async () => {
    const store = await readStore();
    const result = await change(store);
    await writeStore(store);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
