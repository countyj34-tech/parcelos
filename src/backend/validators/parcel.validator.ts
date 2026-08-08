import { z } from "zod";
import type { ParcelStatusCode } from "@/backend/database/types";

const phoneRegex = /^\+?[1-9]\d{6,14}$/;

export const createParcelSchema = z.object({
  sender_name: z.string().min(2).max(120),
  sender_phone: z.string().regex(phoneRegex, "Invalid phone number"),
  sender_email: z.string().email().optional().nullable(),
  receiver_name: z.string().min(2).max(120),
  receiver_phone: z.string().regex(phoneRegex, "Invalid phone number"),
  receiver_email: z.string().email().optional().nullable(),
  origin_branch_id: z.string().uuid(),
  destination_branch_id: z.string().uuid(),
  category_id: z.string().uuid().optional().nullable(),
  weight_kg: z.number().positive().max(10000).optional().nullable(),
  declared_value_cents: z.number().int().min(0).optional(),
  shipping_amount_cents: z.number().int().min(0),
  currency_code: z.string().length(3),
  description: z.string().max(500).optional().nullable(),
});

export const updateParcelStatusSchema = z.object({
  status: z.enum([
    "waiting_for_dropoff",
    "reception_verification",
    "awaiting_payment",
    "label_printed",
    "received",
    "dispatched",
    "in_transit",
    "at_destination_branch",
    "ready_for_collection",
    "collected",
    "cancelled",
    "returned",
  ] satisfies [ParcelStatusCode, ...ParcelStatusCode[]]),
  branch_id: z.string().uuid().optional(),
});

export const parcelListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: updateParcelStatusSchema.shape.status.optional(),
  search: z.string().max(100).optional(),
});

export type CreateParcelDto = z.infer<typeof createParcelSchema>;
export type UpdateParcelStatusDto = z.infer<typeof updateParcelStatusSchema>;
export type ParcelListQueryDto = z.infer<typeof parcelListQuerySchema>;

export const createCompanySchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  country_code: z.string().length(2),
  currency_code: z.string().length(3).default("USD"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  subdomain: z.string().min(3).max(120),
  default_language: z.string().default("en"),
  timezone: z.string().default("Africa/Lusaka"),
  plan_code: z.enum(["starter", "professional", "enterprise", "custom"]),
  trial_days: z.number().int().min(0).max(90).default(14),
  admin_full_name: z.string().min(2),
  admin_email: z.string().email(),
  admin_phone: z.string().optional(),
});

export type CreateCompanyDto = z.infer<typeof createCompanySchema>;
