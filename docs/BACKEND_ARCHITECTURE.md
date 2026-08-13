# ParcelOS Backend Architecture

> **MTHUNZI-TECH-LABS** · Multi-tenant courier SaaS · Supabase + PostgreSQL

## Overview

ParcelOS uses a **multi-tenant SaaS architecture** where every courier company is fully isolated at the database layer via **Row Level Security (RLS)**. The platform owner (MTHUNZI-TECH-LABS) bypasses tenant isolation through security-definer helper functions.

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                   │
│  Platform Console (/admin) · Workspace (/app) · Portal        │
└──────────────────────────┬──────────────────────────────────┘
                           │ Supabase JS (JWT + RLS)
┌──────────────────────────▼──────────────────────────────────┐
│                    Supabase Platform                         │
│  Auth · PostgreSQL · Storage · Realtime · Edge Functions    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              PostgreSQL (Normalized, UUID PKs)               │
│  RLS on every table · company_id tenant isolation            │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
supabase/
├── config.toml                 # Local Supabase configuration
├── migrations/                 # Versioned SQL migrations (run in order)
│   ├── 20260312000001_extensions_and_enums.sql
│   ├── 20260312000002_platform_core.sql
│   ├── 20260312000003_subscriptions.sql
│   ├── 20260312000004_company_operations.sql
│   ├── 20260312000005_parcels.sql
│   ├── 20260312000006_payments_notifications_logs.sql
│   ├── 20260312000007_rls_helpers.sql
│   ├── 20260312000008_rls_policies.sql
│   ├── 20260312000009_storage_realtime.sql
│   └── 20260312000010_seed_reference_data.sql
└── functions/                  # Deno Edge Functions
    ├── generate-tracking-number/
    ├── subscription-validation/
    ├── audit-log/
    └── send-sms/

src/backend/
├── config/env.ts               # Environment configuration
├── database/
│   ├── client.ts               # Supabase client factories
│   └── types.ts                # TypeScript schema types
├── errors/app-error.ts         # Application error hierarchy
├── middleware/auth.middleware.ts
├── repositories/               # Data access layer (tenant-aware)
├── services/                   # Business logic layer
├── validators/                 # Zod DTO validation
└── index.ts                    # Public API exports
```

## Database Design Principles

| Rule | Implementation |
|------|----------------|
| UUID primary keys | `gen_random_uuid()` on all tables |
| Tenant isolation | `company_id` on every business table |
| Audit columns | `created_at`, `updated_at`, `created_by`, `updated_by`, `soft_delete` |
| Normalization | Separate tables for roles, permissions, tracking, history |
| Indexes | `company_id`, status, foreign keys, common query patterns |
| Constraints | FK, UNIQUE, CHECK, enum types |

## Row Level Security

Helper functions (security definer):

| Function | Purpose |
|----------|---------|
| `is_platform_owner()` | MTHUNZI staff bypass |
| `get_user_company_id()` | Tenant context from JWT |
| `get_user_role_code()` | Role-based access |
| `get_user_branch_ids()` | Branch-scoped access |
| `get_customer_id()` | Customer portal access |
| `get_driver_id()` | Driver assignment access |
| `can_access_company(uuid)` | Generic tenant check |
| `write_audit_log(...)` | Centralized audit writes |

## Parcel Workflow

```
Customer → Create Parcel → Waiting For Drop-off → Reception Verification
→ Payment → Print Labels → Received → Dispatched → Transit
→ Destination Branch → Ready For Collection → Collected
```

Every status change triggers:
1. `parcel_history` — immutable audit trail
2. `parcel_tracking` — public/customer-facing events (Realtime-enabled)

## Edge Functions

| Function | Purpose |
|----------|---------|
| `generate-tracking-number` | POS-{seq}-{country} generation |
| `subscription-validation` | Trial expiry, auto-suspend |
| `audit-log` | Authenticated audit writes |
| `send-sms` | SMS dispatch + sms_logs |

## Getting Started

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Apply migrations
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > src/backend/database/schema.types.ts

# Serve edge functions locally
supabase functions serve
```

## Security Checklist

- [x] RLS enabled on all tables
- [x] Platform owner isolated via `platform_users`
- [x] Branch-scoped parcel access for receptionists
- [x] Driver-scoped parcel access via assignments
- [x] Customer-scoped parcel access via customer_id
- [x] Storage paths prefixed with `{company_id}/`
- [x] Service role key server-only
- [x] Audit logging on critical actions
- [x] Soft delete (no hard deletes on business data)

## Scalability Notes

- Partition-ready: `parcels`, `parcel_tracking`, `audit_logs` by `company_id` or date
- Connection pooling via Supabase Supavisor
- Realtime limited to operational tables
- Indexes on all tenant + status query patterns
- Designed for 10,000+ courier companies
