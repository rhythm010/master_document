import crypto from "node:crypto";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

import { config } from "./config";
import type { DbQueryStep, RunContext, SeedDefinition } from "./types";
import { assertSafeIdentifier, substitute } from "./utils";

let sharedPool: Pool | null = null;

/** Get or create the shared PostgreSQL connection pool. */
export function getSharedPool(databaseUrl?: string): Pool {
  if (!sharedPool) {
    const connString = databaseUrl || process.env.DATABASE_URL;
    if (!connString) {
      throw new Error("DATABASE_URL is required to create database pool");
    }
    sharedPool = new Pool({
      connectionString: connString,
      max: config.database.poolSize,
      idleTimeoutMillis: config.database.poolMaxIdleTimeMs,
    });
  }
  return sharedPool;
}

/** Close the shared database pool (should be called at process exit). */
export async function closeSharedPool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}

/** Create a PostgreSQL pool using the provided DATABASE_URL. */
export function createDbPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

/** Run a lightweight SELECT 1 to verify the database is reachable. */
export async function checkDatabase(pool: Pool): Promise<string> {
  try {
    await pool.query("SELECT 1;");
    return "OK";
  } catch {
    return "FAIL";
  }
}

/** Safely read the first defined key from an object. */
function pick<T>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined) {
      return obj[key] as T;
    }
  }
  return undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function ensureFutureWindow(context: RunContext): { startAtIso: string; endAtIso: string } {
  const existingStartAt = context["START_AT"];
  const existingEndAt = context["END_AT"];

  if (typeof existingStartAt === "string" && typeof existingEndAt === "string") {
    return { startAtIso: existingStartAt, endAtIso: existingEndAt };
  }

  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    10,
    0,
    0,
    0
  ));

  if (start.getTime() <= Date.now()) {
    start.setUTCHours(start.getUTCHours() + 1, 0, 0, 0);
  }

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const startAtIso = start.toISOString();
  const endAtIso = end.toISOString();

  context["START_AT"] = startAtIso;
  context["END_AT"] = endAtIso;

  return { startAtIso, endAtIso };
}

async function resolvePasswordHash(values: Record<string, unknown>): Promise<string> {
  const existing = pick<string>(values, ["passwordHash", "password_hash"]);
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const password = pick<string>(values, ["password"]);
  if (typeof password === "string" && password.length > 0) {
    // PERFORMANCE: Reduced from 10 to 4 rounds for test performance (70% faster hashing)
    // 4 rounds = ~15-30ms vs 10 rounds = ~50-100ms. Sufficient for tests (not validating password strength, only auth flow)
    const rounds = Number(process.env.BCRYPT_ROUNDS || "4");
    return bcrypt.hash(password, rounds);
  }

  // Minimal viable default; these accounts authenticate via JWT tokens in tests.
  return "seeded_hash_not_used";
}

function signBearerToken(payload: { sub: string; role: string; email: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set (required to seed Bearer auth tokens)");
  }

  const ttlSeconds = Number(process.env.AUTH_ACCESS_TOKEN_TTL || "3600");
  return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

function coerceCount(seed: Record<string, unknown>): number {
  const raw = seed["count"];
  if (raw === undefined || raw === null) {
    return 1;
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
}

/** Apply seed data entries using raw SQL inserts with ON CONFLICT for idempotency. */
export async function applySeedData(
  pool: Pool,
  seedData: SeedDefinition[] | undefined,
  context: RunContext
): Promise<string[]> {
  const actions: string[] = [];
  if (!seedData || seedData.length === 0) {
    return actions;
  }

  for (const seed of seedData as Array<Record<string, unknown>>) {
    const entity = String(seed.entity || "");
    const count = coerceCount(seed);

    if (entity === "venue") {
      // Parallel insert for multiple venues
      const venuePromises = [];
      for (let i = 0; i < count; i++) {
        const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
        const rendered = substitute(valuesRaw, context) as Record<string, unknown>;

        const id = String(pick(rendered, ["id"]) ?? crypto.randomUUID());
        const venueType = String(pick(rendered, ["venueType", "venue_type"]) ?? "MALL");
        const name = String(pick(rendered, ["name"]) ?? `Seed Venue ${context["RUN_ID"] ?? ""}`);
        const address = String(pick(rendered, ["address"]) ?? "1 Seed Street");
        const latitude = Number(pick(rendered, ["latitude"]) ?? 25.23);
        const longitude = Number(pick(rendered, ["longitude"]) ?? 55.3);
        const operatingHoursStart = String(pick(rendered, ["operatingHoursStart", "operating_hours_start"]) ?? "09:00:00");
        const operatingHoursEnd = String(pick(rendered, ["operatingHoursEnd", "operating_hours_end"]) ?? "21:00:00");

        const text =
          "INSERT INTO venues (id, name, address, venue_type, latitude, longitude, operating_hours_start, operating_hours_end) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) " +
          "ON CONFLICT (id) DO UPDATE SET " +
          "name = EXCLUDED.name, address = EXCLUDED.address, venue_type = EXCLUDED.venue_type, " +
          "latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, " +
          "operating_hours_start = EXCLUDED.operating_hours_start, operating_hours_end = EXCLUDED.operating_hours_end;";

        venuePromises.push(
          pool.query(text, [
            id,
            name,
            address,
            venueType,
            latitude,
            longitude,
            operatingHoursStart,
            operatingHoursEnd
          ]).then(() => {
            if (context["ORIGINAL_VENUE_ID"] === undefined) {
              context["ORIGINAL_VENUE_ID"] = id;
            } else if (context["TARGET_VENUE_ID"] === undefined) {
              context["TARGET_VENUE_ID"] = id;
            }

            if (context["VENUE_ID"] === undefined) {
              context["VENUE_ID"] = id;
            }
            actions.push(`Seeded venue ${id}`);
          })
        );
      }
      await Promise.all(venuePromises);

      continue;
    }

    if (entity === "user") {
      // Parallel insert for multiple users (password hashing will happen concurrently)
      const userPromises = [];
      for (let i = 0; i < count; i++) {
        const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
        const rendered = substitute(valuesRaw, context) as Record<string, unknown>;

        const role = String(pick(rendered, ["role"]) ?? seed.role ?? "CLIENT");
        const id = String(pick(rendered, ["id"]) ?? crypto.randomUUID());
        const email = String(
          pick(rendered, ["email"]) ??
            `${role.toLowerCase()}.${context["RUN_ID"] ?? "run"}.${i}.${id}@test.local`
        );
        const name = String(pick(rendered, ["name"]) ?? `Seed ${role}`);
        const nickname = String(pick(rendered, ["nickname"]) ?? `${role.toLowerCase()}_${context["RUN_ID"] ?? "run"}`);
        const emailVerifiedRaw = pick(rendered, ["emailVerified", "email_verified"]);
        const emailVerified = typeof emailVerifiedRaw === "boolean" ? emailVerifiedRaw : Boolean(seed.emailVerified ?? true);
        const biometricRaw = pick(rendered, ["biometricAuthEnabled", "biometric_auth_enabled"]);
        const biometricAuthEnabled = typeof biometricRaw === "boolean" ? biometricRaw : false;

        userPromises.push(
          resolvePasswordHash(rendered).then(async (passwordHash) => {
            const text =
              "INSERT INTO users (id, role, name, nickname, email, password_hash, email_verified, biometric_auth_enabled) " +
              "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) " +
              "ON CONFLICT (id) DO UPDATE SET " +
              "role = EXCLUDED.role, name = EXCLUDED.name, nickname = EXCLUDED.nickname, email = EXCLUDED.email, " +
              "password_hash = EXCLUDED.password_hash, email_verified = EXCLUDED.email_verified, " +
              "biometric_auth_enabled = EXCLUDED.biometric_auth_enabled;";

            await pool.query(text, [
              id,
              role,
              name,
              nickname,
              email,
              passwordHash,
              emailVerified,
              biometricAuthEnabled
            ]);

            if (role === "CLIENT") {
              // Mirror venue/booking multi-seed support: capture the first two client ids.
              if (context["ORIGINAL_CLIENT_ID"] === undefined) {
                context["ORIGINAL_CLIENT_ID"] = id;
              } else if (context["TARGET_CLIENT_ID"] === undefined) {
                context["TARGET_CLIENT_ID"] = id;
              }

              if (context["CLIENT_ID"] === undefined) {
                context["CLIENT_ID"] = id;
              }
              if (context["CLIENT_EMAIL"] === undefined) {
                context["CLIENT_EMAIL"] = email;
              }
              if (context["CLIENT_ACCESS_TOKEN"] === undefined) {
                context["CLIENT_ACCESS_TOKEN"] = signBearerToken({ sub: id, role, email });
              }
            }

            actions.push(`Seeded user ${id} (${role})`);
          })
        );
      }
      await Promise.all(userPromises);

      continue;
    }

    if (entity === "companion_profile") {
      for (let i = 0; i < count; i++) {
        const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
        const rendered = substitute(valuesRaw, context) as Record<string, unknown>;

        const designation = String(pick(rendered, ["designation"]) ?? seed.designation ?? "VICE_CAPTAIN");
        const userId = String(pick(rendered, ["userId", "user_id"]) ?? crypto.randomUUID());

        // Ensure companion user exists.
        const companionEmail = String(
          pick(rendered, ["email"]) ??
            `companion.${designation.toLowerCase()}.${context["RUN_ID"] ?? "run"}.${i}.${userId}@test.local`
        );
        const userText =
          "INSERT INTO users (id, role, name, nickname, email, password_hash, email_verified, biometric_auth_enabled) " +
          "VALUES ($1, 'COMPANION', $2, $3, $4, $5, $6, $7) " +
          "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;";

        await pool.query(userText, [
          userId,
          `Seed Companion ${designation}`,
          `seed_${designation.toLowerCase()}_${context["RUN_ID"] ?? "run"}`,
          companionEmail,
          "seeded_hash_not_used",
          true,
          false
        ]);

        // Mint companion Bearer tokens for test-runner API requests.
        // (User entity seeding currently mints client tokens only.)
        const companionAccessToken = signBearerToken({ sub: userId, role: "COMPANION", email: companionEmail });
        if (context["COMPANION_ACCESS_TOKEN"] === undefined) {
          context["COMPANION_ACCESS_TOKEN"] = companionAccessToken;
        }
        if (designation === "CAPTAIN" && context["CAPTAIN_ACCESS_TOKEN"] === undefined) {
          context["CAPTAIN_ACCESS_TOKEN"] = companionAccessToken;
        }
        if (designation === "VICE_CAPTAIN" && context["VICE_CAPTAIN_ACCESS_TOKEN"] === undefined) {
          context["VICE_CAPTAIN_ACCESS_TOKEN"] = companionAccessToken;
        }

        const profileId = String(pick(rendered, ["id"]) ?? crypto.randomUUID());
        const isActiveRaw = pick(rendered, ["isActive", "is_active"]);
        const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : Boolean(seed.isActive ?? true);
        const languages = (pick<string[]>(rendered, ["languages"]) ?? []) as string[];
        const profilePictureUrl = String(pick(rendered, ["profilePictureUrl", "profile_picture_url"]) ?? "");
        const averageRating = Number(pick(rendered, ["averageRating", "average_rating"]) ?? 0);

        const text =
          "INSERT INTO companion_profiles (id, user_id, designation, is_active, languages, profile_picture_url, average_rating) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7) " +
          "ON CONFLICT (id) DO UPDATE SET " +
          "user_id = EXCLUDED.user_id, designation = EXCLUDED.designation, is_active = EXCLUDED.is_active, " +
          "languages = EXCLUDED.languages, profile_picture_url = EXCLUDED.profile_picture_url, average_rating = EXCLUDED.average_rating;";

        await pool.query(text, [
          profileId,
          userId,
          designation,
          isActive,
          languages,
          profilePictureUrl,
          averageRating
        ]);

        if (designation === "CAPTAIN" && context["CAPTAIN_ID"] === undefined) {
          context["CAPTAIN_ID"] = userId;
        }
        if (designation === "VICE_CAPTAIN" && context["VICE_CAPTAIN_ID"] === undefined) {
          context["VICE_CAPTAIN_ID"] = userId;
        }

        actions.push(`Seeded companion_profile ${profileId} (${designation})`);
      }

      continue;
    }

    if (entity === "companion_venue_assignment") {
      const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
      const rendered = substitute(valuesRaw, context) as Record<string, unknown>;
      const companionId = String(pick(rendered, ["companionId", "companion_id"]) ?? "");
      const venueId = String(pick(rendered, ["venueId", "venue_id"]) ?? "");
      if (!isUuid(companionId) || !isUuid(venueId)) {
        throw new Error("companion_venue_assignment requires companionId and venueId");
      }

      await pool.query(
        "INSERT INTO companion_venue_assignments (companion_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [companionId, venueId]
      );
      actions.push(`Seeded companion_venue_assignment ${companionId} -> ${venueId}`);
      continue;
    }

    if (entity === "roster_slot") {
      const { startAtIso, endAtIso } = ensureFutureWindow(context);
      const venueId = String(context["VENUE_ID"] ?? "");
      const captainId = String(context["CAPTAIN_ID"] ?? "");
      const viceCaptainId = String(context["VICE_CAPTAIN_ID"] ?? "");
      const bookingId = context["BOOKING_ID"] ? String(context["BOOKING_ID"]) : null;

      const status = String(seed.status ?? pick((seed.values ?? {}) as Record<string, unknown>, ["status"]) ?? "AVAILABLE");
      const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
      const rendered = substitute(valuesRaw, context) as Record<string, unknown>;

      const explicitVenue = pick<string>(rendered, ["venueId", "venue_id"]);
      const explicitStartAt = pick<string>(rendered, ["startAt", "start_at"]);
      const explicitEndAt = pick<string>(rendered, ["endAt", "end_at"]);

      const originalVenueId = String(context["ORIGINAL_VENUE_ID"] ?? "");
      const targetVenueId = String(context["TARGET_VENUE_ID"] ?? "");
      const originalStartAt = String(context["ORIGINAL_START_AT"] ?? "");
      const originalEndAt = String(context["ORIGINAL_END_AT"] ?? "");
      const targetStartAt = String(context["TARGET_START_AT"] ?? "");
      const targetEndAt = String(context["TARGET_END_AT"] ?? "");

      // Heuristic support for internal-edit tests that seed two venues and two windows.
      const inferredVenueId =
        status === "BOOKED" && originalVenueId ? originalVenueId :
        status === "AVAILABLE" && targetVenueId ? targetVenueId :
        venueId;

      const inferredStartAt =
        status === "BOOKED" && originalStartAt ? originalStartAt :
        status === "AVAILABLE" && targetStartAt ? targetStartAt :
        startAtIso;

      const inferredEndAt =
        status === "BOOKED" && originalEndAt ? originalEndAt :
        status === "AVAILABLE" && targetEndAt ? targetEndAt :
        endAtIso;

      const rowVenueId = String(explicitVenue ?? inferredVenueId);
      const startAt = String(explicitStartAt ?? inferredStartAt);
      const endAt = String(explicitEndAt ?? inferredEndAt);

      const renderedBookingId = pick<string | null>(rendered, ["bookingId", "booking_id"]);
      let bookingIdValue = renderedBookingId !== undefined ? renderedBookingId : status === "BOOKED" ? bookingId : null;

      const companions: string[] = [];
      const explicitCompanion = pick<string>(rendered, ["companionId", "companion_id"]);
      if (typeof explicitCompanion === "string" && explicitCompanion.length > 0) {
        companions.push(explicitCompanion);
      } else {
        if (captainId) {
          companions.push(captainId);
        }
        if (viceCaptainId) {
          companions.push(viceCaptainId);
        }
      }

      if (!rowVenueId) {
        throw new Error("roster_slot seeding requires a venueId (VENUE_ID context key missing)");
      }
      if (companions.length === 0) {
        throw new Error("roster_slot seeding requires companion ids (CAPTAIN_ID / VICE_CAPTAIN_ID missing)");
      }
      if (status === "BOOKED" && !bookingIdValue) {
        // Self-heal: some scenarios reserve slots with "BOOKED" status to simulate
        // unavailability, without impacting the primary scenario client.

        const placeholderClientId = crypto.randomUUID();
        const placeholderEmail = `placeholder.client.${context["RUN_ID"] ?? "run"}.${placeholderClientId}@test.local`;

        await pool.query(
          "INSERT INTO users (id, role, name, nickname, email, password_hash, email_verified, biometric_auth_enabled) " +
            "VALUES ($1, 'CLIENT', $2, $3, $4, $5, true, false) ON CONFLICT (id) DO NOTHING;",
          [
            placeholderClientId,
            "Placeholder Client",
            `placeholder_${context["RUN_ID"] ?? "run"}`,
            placeholderEmail,
            "seeded_hash_not_used"
          ]
        );

        const placeholderBookingId = crypto.randomUUID();
        const qrCode = `qr_${placeholderBookingId}`;
        const pinCode = "111111";
        const bookingColor = "BLUE";
        const comMatchQrCode = `com_qr_${placeholderBookingId}`;
        const comMatchPinCode = "222222";

        const bookingInsert =
          "INSERT INTO bookings (id, client_id, venue_id, start_at, end_at, status, qr_code, pin_code, booking_color, com_match_qr_code, com_match_pin_code, extended_at) " +
          "VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', $6, $7, $8, $9, $10, NULL) " +
          "ON CONFLICT (id) DO NOTHING;";

        await pool.query(bookingInsert, [
          placeholderBookingId,
          placeholderClientId,
          rowVenueId,
          startAt,
          endAt,
          qrCode,
          pinCode,
          bookingColor,
          comMatchQrCode,
          comMatchPinCode
        ]);

        bookingIdValue = placeholderBookingId;
        actions.push(`Seeded placeholder booking ${placeholderBookingId} for BOOKED roster_slot`);
      }

      // Seed one slot per companion (minimum viable for booking happy paths).
      for (const companionId of companions.slice(0, count)) {
        const id = String(pick(rendered, ["id"]) ?? crypto.randomUUID());

        const text =
          "INSERT INTO roster_slots (id, venue_id, companion_id, booking_id, start_at, end_at, status) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7) " +
          "ON CONFLICT (venue_id, companion_id, start_at, end_at) DO UPDATE SET " +
          "booking_id = EXCLUDED.booking_id, status = EXCLUDED.status;";

        await pool.query(text, [
          id,
          rowVenueId,
          companionId,
          bookingIdValue,
          startAt,
          endAt,
          status
        ]);

        await pool.query(
          "INSERT INTO companion_venue_assignments (companion_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
          [companionId, rowVenueId]
        );

        actions.push(`Seeded roster_slot ${id} (${status})`);
      }

      continue;
    }

    if (entity === "booking") {
      for (let i = 0; i < count; i++) {
        const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
        const rendered = substitute(valuesRaw, context) as Record<string, unknown>;

        const id = String(pick(rendered, ["id"]) ?? crypto.randomUUID());
        const clientId = String(pick(rendered, ["clientId", "client_id"]) ?? context["CLIENT_ID"] ?? "");
        const venueId = String(pick(rendered, ["venueId", "venue_id"]) ?? context["VENUE_ID"] ?? "");
        if (!clientId || !venueId) {
          throw new Error("booking seeding requires CLIENT_ID and VENUE_ID");
        }

        const { startAtIso, endAtIso } = ensureFutureWindow(context);
        const startAt = String(pick(rendered, ["startAt", "start_at"]) ?? startAtIso);
        const endAt = String(pick(rendered, ["endAt", "end_at"]) ?? endAtIso);
        const status = String(pick(rendered, ["status"]) ?? seed.status ?? "CONFIRMED");

        const qrCode = String(pick(rendered, ["qrCode", "qr_code"]) ?? `qr_${id}`);
        const pinCode = String(pick(rendered, ["pinCode", "pin_code"]) ?? "111111");
        const bookingColor = String(pick(rendered, ["bookingColor", "booking_color"]) ?? "BLUE");
        const comMatchQrCode = String(pick(rendered, ["comMatchQrCode", "com_match_qr_code"]) ?? `com_qr_${id}`);
        const comMatchPinCode = String(pick(rendered, ["comMatchPinCode", "com_match_pin_code"]) ?? "222222");
        const extendedAt = pick<string | null>(rendered, ["extendedAt", "extended_at"]) ?? seed.extended_at ?? null;

        const text =
          "INSERT INTO bookings (id, client_id, venue_id, start_at, end_at, status, qr_code, pin_code, booking_color, com_match_qr_code, com_match_pin_code, extended_at) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) " +
          "ON CONFLICT (id) DO UPDATE SET " +
          "client_id = EXCLUDED.client_id, venue_id = EXCLUDED.venue_id, start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at, " +
          "status = EXCLUDED.status, qr_code = EXCLUDED.qr_code, pin_code = EXCLUDED.pin_code, booking_color = EXCLUDED.booking_color, " +
          "com_match_qr_code = EXCLUDED.com_match_qr_code, com_match_pin_code = EXCLUDED.com_match_pin_code, extended_at = EXCLUDED.extended_at;";

        await pool.query(text, [
          id,
          clientId,
          venueId,
          startAt,
          endAt,
          status,
          qrCode,
          pinCode,
          bookingColor,
          comMatchQrCode,
          comMatchPinCode,
          extendedAt
        ]);

        // Mirror venue seeding: capture the first two booking ids for multi-booking scenarios.
        if (context["ORIGINAL_BOOKING_ID"] === undefined) {
          context["ORIGINAL_BOOKING_ID"] = id;
        } else if (context["TARGET_BOOKING_ID"] === undefined) {
          context["TARGET_BOOKING_ID"] = id;
        }

        // Backwards-compatible keys used by existing tests.
        if (context["BOOKING_ID"] === undefined) {
          context["BOOKING_ID"] = id;
        }
        if (context["EXISTING_BOOKING_ID"] === undefined) {
          context["EXISTING_BOOKING_ID"] = id;
        }
        if (context["BOOKING_START_AT"] === undefined) {
          context["BOOKING_START_AT"] = startAt;
        }
        if (context["BOOKING_END_AT"] === undefined) {
          context["BOOKING_END_AT"] = endAt;
        }

        // Store "original" booking fields used by internal-edit scenarios.
        if (context["ORIGINAL_START_AT"] === undefined) {
          context["ORIGINAL_START_AT"] = startAt;
        }
        if (context["ORIGINAL_END_AT"] === undefined) {
          context["ORIGINAL_END_AT"] = endAt;
        }
        if (context["ORIGINAL_QR_CODE"] === undefined) {
          context["ORIGINAL_QR_CODE"] = qrCode;
        }
        if (context["ORIGINAL_PIN_CODE"] === undefined) {
          context["ORIGINAL_PIN_CODE"] = pinCode;
        }
        if (context["ORIGINAL_BOOKING_COLOR"] === undefined) {
          context["ORIGINAL_BOOKING_COLOR"] = bookingColor;
        }
        if (context["ORIGINAL_COM_MATCH_QR"] === undefined) {
          context["ORIGINAL_COM_MATCH_QR"] = comMatchQrCode;
        }
        if (context["ORIGINAL_COM_MATCH_PIN"] === undefined) {
          context["ORIGINAL_COM_MATCH_PIN"] = comMatchPinCode;
        }

        // Default target edit window used by internal-edit scenarios.
        if (context["TARGET_START_AT"] === undefined || context["TARGET_END_AT"] === undefined) {
          try {
            const startMs = Date.parse(startAt);
            const endMs = Date.parse(endAt);
            if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
              const delta = 24 * 60 * 60 * 1000;
              context["TARGET_START_AT"] = new Date(startMs + delta).toISOString();
              context["TARGET_END_AT"] = new Date(endMs + delta).toISOString();
            }
          } catch {
            // ignore
          }
        }

        actions.push(`Seeded booking ${id} (${status})`);
      }

      continue;
    }

    if (entity === "booking_companion_assignment") {
      const bookingId = String(context["BOOKING_ID"] ?? "");
      const captainId = String(context["CAPTAIN_ID"] ?? "");
      const viceCaptainId = String(context["VICE_CAPTAIN_ID"] ?? "");
      if (!bookingId || !captainId || !viceCaptainId) {
        throw new Error("booking_companion_assignment seeding requires BOOKING_ID, CAPTAIN_ID, and VICE_CAPTAIN_ID");
      }

      const valuesRaw = (seed.values ?? {}) as Record<string, unknown>;
      const rendered = substitute(valuesRaw, context) as Record<string, unknown>;

      const presenceStatus = String(pick(rendered, ["presenceStatus", "presence_status"]) ?? seed.presence_status ?? "ASSIGNED");
      const selfMatchStatus = String(pick(rendered, ["selfMatchStatus", "self_match_status"]) ?? seed.self_match_status ?? "NOT_MATCHED");
      const clientMatchStatus = String(pick(rendered, ["clientMatchStatus", "client_match_status"]) ?? seed.client_match_status ?? "WAITING_FOR_CLIENT");

      const assignments = [
        { designation: "CAPTAIN", companionId: captainId },
        { designation: "VICE_CAPTAIN", companionId: viceCaptainId }
      ];

      for (const entry of assignments) {
        const id = crypto.randomUUID();
        const text =
          "INSERT INTO booking_companion_assignments (id, booking_id, companion_id, designation, presence_status, self_match_status, client_match_status) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7) " +
          "ON CONFLICT (booking_id, designation) DO UPDATE SET " +
          "companion_id = EXCLUDED.companion_id, presence_status = EXCLUDED.presence_status, self_match_status = EXCLUDED.self_match_status, client_match_status = EXCLUDED.client_match_status;";

        await pool.query(text, [
          id,
          bookingId,
          entry.companionId,
          entry.designation,
          presenceStatus,
          selfMatchStatus,
          clientMatchStatus
        ]);

        actions.push(`Seeded booking_companion_assignment (${entry.designation})`);
      }

      continue;
    }

    throw new Error(`Unsupported seed entity: ${entity}`);
  }

  return actions;
}

/** Execute a simple parameterized SELECT query for a dbQuery step. */
export async function executeDbQuery(
  pool: Pool,
  step: DbQueryStep,
  context: RunContext
): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }>{
  // If step has a custom query, use it directly
  if (step.query) {
    const queryText = substitute(step.query, context);
    const result = await pool.query(queryText);
    return { rows: result.rows as Array<Record<string, unknown>>, rowCount: result.rowCount || 0 };
  }

  // Otherwise construct simple SELECT from target and where
  if (typeof step.target !== "string" || step.target.trim().length === 0) {
    throw new Error("dbQuery step requires either a query field or a non-empty target");
  }

  const targetRaw = substitute(step.target, context);
  const target = assertSafeIdentifier(String(targetRaw), "table");
  let queryText = `SELECT * FROM "${target}"`;
  const params: Array<string> = [];

  if (step.where) {
    const fieldRaw = substitute(step.where.field, context);
    const field = assertSafeIdentifier(String(fieldRaw), "column");
    const valueRaw = substitute(step.where.value, context);
    params.push(String(valueRaw));
    queryText += ` WHERE "${field}" = $1`;
  }

  queryText += ";";

  const result = await pool.query(queryText, params);
  return { rows: result.rows as Array<Record<string, unknown>>, rowCount: result.rowCount || 0 };
}
