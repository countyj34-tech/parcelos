/** Shared parcel UI types — keep out of mock-data so production bundles stay lean. */

export type ParcelStatus =
  | "Waiting for Drop-off"
  | "Received"
  | "Dispatched"
  | "In Transit"
  | "Arrived"
  | "Ready for Collection"
  | "Collected";

export const PARCEL_FLOW: ParcelStatus[] = [
  "Waiting for Drop-off",
  "Received",
  "Dispatched",
  "In Transit",
  "Arrived",
  "Ready for Collection",
  "Collected",
];

export type Parcel = {
  id?: string;
  tracking: string;
  sender: string;
  senderPhone: string;
  receiver: string;
  receiverPhone: string;
  origin: string;
  destination: string;
  status: ParcelStatus;
  payment: "Paid" | "Unpaid" | "Cash on Collection";
  amount: number;
  branch: string;
  weight: string;
  category: string;
  declaredValue: number;
  created: string;
};

/** Map UI status labels to DB status codes (primary match). */
export const UI_STATUS_TO_DB: Record<ParcelStatus, string[]> = {
  "Waiting for Drop-off": ["waiting_for_dropoff", "awaiting_payment"],
  Received: ["received", "reception_verification", "label_printed"],
  Dispatched: ["dispatched"],
  "In Transit": ["in_transit"],
  Arrived: ["at_destination_branch", "returned"],
  "Ready for Collection": ["ready_for_collection"],
  Collected: ["collected"],
};

export const UI_PAYMENT_TO_DB: Record<Parcel["payment"], string> = {
  Paid: "paid",
  Unpaid: "unpaid",
  "Cash on Collection": "cash_on_collection",
};
