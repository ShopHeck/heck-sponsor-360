import { closeAuction } from "../lib/close-auction.mjs";

// Runs daily: retries failed lock invoices and, after BID_DEADLINE, invoices
// the winning bidder on every open placement. Logic lives in ../lib/close-auction.mjs.
export default async (req) => {
  const origin = process.env.URL || new URL(req.url).origin;
  await closeAuction(origin);
  return new Response("ok");
};

export const config = { schedule: "@daily" };
