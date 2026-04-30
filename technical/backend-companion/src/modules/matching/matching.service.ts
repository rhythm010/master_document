import { Prisma } from "@prisma/client";

import { prisma } from "../../shared/db/prisma";
import { logger } from "../../shared/logger";
import type { UserRole } from "../../shared/types/enums";

import { matchingErrors } from "./matching.errors";
import { matchingRepository } from "./matching.repository";
import type {
  ClientMatchStartResponseDTO,
  ClientMatchVerifyResponseDTO,
  ComMatchContextResponseDTO,
  ComMatchVerifyResponseDTO,
  CompanionLocationDTO,
  MatchingContextCompanionDTO,
  MatchingContextResponseDTO,
  MatchingLocationResponseDTO
} from "./matching.types";

const VENUE_RADIUS_METERS = 400;

export const matchingService = {
  // Return com-com matching context for an assigned companion.
  async getComMatchContext(input: {
    bookingId: string;
    companionId: string;
  }): Promise<ComMatchContextResponseDTO> {
    const booking = await matchingRepository.findMatchingContextByBookingId(prisma, input.bookingId);
    if (!booking) {
      throw matchingErrors.bookingNotFound();
    }

    ensureBookingAllowsMatchingContext(booking.status);

    const assignments = ensureAssignmentPair(booking.assignments);
    const callerAssignment = ensureCompanionAssigned(assignments, input.companionId);

    if (!areAllPresent(assignments)) {
      throw matchingErrors.presenceNotArrived();
    }

    if (callerAssignment.designation === "CAPTAIN") {
      return {
        bookingId: booking.id,
        comMatchQrCode: booking.comMatchQrCode,
        comMatchPinCode: booking.comMatchPinCode
      };
    }

    return {
      bookingId: booking.id,
      scannerEnabled: true
    };
  },

  // Verify companion-companion match using Captain QR/PIN.
  async verifyComMatch(input: {
    bookingId: string;
    companionId: string;
    verificationMethod: "QR" | "PIN";
    qrCode?: string;
    pinCode?: string;
  }): Promise<ComMatchVerifyResponseDTO> {
    const result = await prisma.$transaction(async (tx) => {
      const [booking] = await matchingRepository.lockBookingById(tx, input.bookingId);
      if (!booking) {
        throw matchingErrors.bookingNotFound();
      }

      const assignments = await matchingRepository.lockAssignmentsForBooking(tx, booking.id);
      ensureAssignmentPair(assignments);

      const callerAssignment = ensureCompanionAssigned(assignments, input.companionId);
      if (callerAssignment.designation !== "VICE_CAPTAIN") {
        throw matchingErrors.forbidden();
      }

      if (!areAllPresent(assignments)) {
        throw matchingErrors.presenceNotArrived();
      }

      if (areAllSelfMatched(assignments)) {
        ensureBookingAllowsMatchingContext(booking.status);
        return { response: { bookingId: booking.id, selfMatchStatus: "MATCHED" }, notifyClient: false };
      }

      if (booking.status !== "CONFIRMED") {
        throw matchingErrors.invalidState();
      }

      if (
        !isVerificationValid({
          method: input.verificationMethod,
          qrCode: input.qrCode,
          pinCode: input.pinCode,
          bookingQr: booking.comMatchQrCode,
          bookingPin: booking.comMatchPinCode
        })
      ) {
        throw matchingErrors.invalidQrOrPin();
      }

      const updated = await matchingRepository.updateSelfMatchStatusForBooking(
        tx,
        booking.id,
        "MATCHED"
      );
      if ((updated.count ?? 0) !== 2) {
        throw matchingErrors.internalError("Unexpected self match update count");
      }

      return { response: { bookingId: booking.id, selfMatchStatus: "MATCHED" }, notifyClient: true };
    });

    if (result.notifyClient) {
      logNotificationDeferred("COM_MATCH_VERIFIED", result.response.bookingId);
    }

    return result.response;
  },

  // Return matching page context for a client or assigned companion.
  async getMatchingContext(input: {
    bookingId: string;
    caller: { id: string; role: UserRole };
  }): Promise<MatchingContextResponseDTO> {
    const booking = await matchingRepository.findMatchingContextByBookingId(prisma, input.bookingId);
    if (!booking) {
      throw matchingErrors.bookingNotFound();
    }

    ensureBookingAllowsMatchingContext(booking.status);

    const assignments = ensureAssignmentPair(booking.assignments);
    const participantLocations = await matchingRepository.listParticipantLocations(prisma, booking.id);
    const locationMap = new Map(participantLocations.map((row) => [row.userId, row]));

    const clientLocation = locationMap.get(booking.clientId);
    const clientMatchStarted = Boolean(clientLocation);

    if (input.caller.role === "CLIENT") {
      if (input.caller.id !== booking.clientId) {
        throw matchingErrors.forbidden();
      }

      const companions = assignments.map((assignment) =>
        toCompanionSummary(booking.id, assignment)
      );

      const companionLocations: CompanionLocationDTO[] = assignments.flatMap((assignment) => {
        const row = locationMap.get(assignment.companionId);
        if (!row) {
          return [];
        }
        return [
          {
            companionId: assignment.companionId,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            updatedAt: row.updatedAt.toISOString()
          }
        ];
      });

      return {
        bookingId: booking.id,
        bookingStatus: booking.status,
        bookingColor: booking.bookingColor,
        companions,
        companionLocations,
        qrCode: booking.qrCode,
        pinCode: booking.pinCode,
        clientMatchStarted
      };
    }

    if (input.caller.role === "COMPANION") {
      const callerAssignment = ensureCompanionAssigned(assignments, input.caller.id);

      const response: MatchingContextCompanionDTO = {
        bookingId: booking.id,
        bookingStatus: booking.status,
        bookingColor: booking.bookingColor,
        clientNickname: booking.client.nickname,
        clientMatchStarted,
        canVerifyClientMatch: callerAssignment.designation === "CAPTAIN"
      };

      if (clientMatchStarted && clientLocation) {
        response.clientLocation = {
          latitude: Number(clientLocation.latitude),
          longitude: Number(clientLocation.longitude),
          updatedAt: clientLocation.updatedAt.toISOString()
        };
      }

      return response;
    }

    throw matchingErrors.forbidden();
  },

  // Start client matching by creating the client location row.
  async startClientMatch(input: {
    bookingId: string;
    clientId: string;
    latitude: unknown;
    longitude: unknown;
    gpsPermissionGranted: boolean;
    gpsEnabled: boolean;
  }): Promise<ClientMatchStartResponseDTO> {
    ensureGpsPermissions(input);
    const coordinates = parseCoordinates({ latitude: input.latitude, longitude: input.longitude });

    const booking = await matchingRepository.findBookingById(prisma, input.bookingId);
    if (!booking) {
      throw matchingErrors.bookingNotFound();
    }

    if (booking.clientId !== input.clientId) {
      throw matchingErrors.forbidden();
    }

    const assignments = await matchingRepository.findAssignmentsForBooking(prisma, booking.id);
    ensureAssignmentPair(assignments);

    const existingLocation = await matchingRepository.findParticipantLocation(prisma, {
      bookingId: booking.id,
      userId: input.clientId
    });

    if (existingLocation) {
      ensureBookingAllowsMatchingContext(booking.status);
      return {
        bookingId: booking.id,
        clientMatchStarted: true,
        locationSharingState: "TWO_WAY"
      };
    }

    if (booking.status !== "CONFIRMED") {
      throw matchingErrors.invalidState();
    }

    const venue = await matchingRepository.findVenueById(prisma, booking.venueId);
    if (!venue) {
      throw matchingErrors.internalError("Venue missing for booking");
    }

    const withinRadius = isWithinVenueRadius({
      clientLatitude: coordinates.latitude,
      clientLongitude: coordinates.longitude,
      venueLatitude: Number(venue.latitude),
      venueLongitude: Number(venue.longitude)
    });

    if (!withinRadius) {
      throw matchingErrors.outsideVenueRadius();
    }

    await matchingRepository.upsertParticipantLocation(prisma, {
      bookingId: booking.id,
      userId: input.clientId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updatedAt: new Date()
    });

    return {
      bookingId: booking.id,
      clientMatchStarted: true,
      locationSharingState: "TWO_WAY"
    };
  },

  // Verify client-companion match using client QR/PIN (Captain only).
  async verifyClientMatch(input: {
    bookingId: string;
    companionId: string;
    verificationMethod: "QR" | "PIN";
    qrCode?: string;
    pinCode?: string;
  }): Promise<ClientMatchVerifyResponseDTO> {
    return prisma.$transaction(async (tx) => {
      const [booking] = await matchingRepository.lockBookingById(tx, input.bookingId);
      if (!booking) {
        throw matchingErrors.bookingNotFound();
      }

      const assignments = await matchingRepository.lockAssignmentsForBooking(tx, booking.id);
      ensureAssignmentPair(assignments);

      const callerAssignment = ensureCompanionAssigned(assignments, input.companionId);
      if (callerAssignment.designation !== "CAPTAIN") {
        throw matchingErrors.forbidden();
      }

      if (booking.status === "ACTIVE" && areAllClientMatched(assignments)) {
        return {
          bookingId: booking.id,
          bookingStatus: "ACTIVE",
          clientMatchStatus: "CLIENT_MATCHED"
        };
      }

      if (booking.status !== "CONFIRMED") {
        throw matchingErrors.invalidState();
      }

      if (!areAllSelfMatched(assignments)) {
        throw matchingErrors.selfMatchIncomplete();
      }

      if (
        !isVerificationValid({
          method: input.verificationMethod,
          qrCode: input.qrCode,
          pinCode: input.pinCode,
          bookingQr: booking.qrCode,
          bookingPin: booking.pinCode
        })
      ) {
        throw matchingErrors.invalidQrOrPin();
      }

      const updatedAssignments = await matchingRepository.updateClientMatchStatusForBooking(
        tx,
        booking.id,
        "CLIENT_MATCHED"
      );
      if ((updatedAssignments.count ?? 0) !== 2) {
        throw matchingErrors.internalError("Unexpected client match update count");
      }

      await matchingRepository.updateBookingStatus(tx, booking.id, "ACTIVE");

      return {
        bookingId: booking.id,
        bookingStatus: "ACTIVE",
        clientMatchStatus: "CLIENT_MATCHED"
      };
    });
  },

  // Update the caller's matching location.
  async updateMatchingLocation(input: {
    bookingId: string;
    caller: { id: string; role: UserRole };
    latitude: unknown;
    longitude: unknown;
    gpsPermissionGranted: boolean;
    gpsEnabled: boolean;
  }): Promise<MatchingLocationResponseDTO> {
    ensureGpsPermissions(input);
    const coordinates = parseCoordinates({ latitude: input.latitude, longitude: input.longitude });

    const booking = await matchingRepository.findBookingById(prisma, input.bookingId);
    if (!booking) {
      throw matchingErrors.bookingNotFound();
    }

    ensureBookingAllowsMatchingContext(booking.status);

    const assignments = await matchingRepository.findAssignmentsForBooking(prisma, booking.id);
    ensureAssignmentPair(assignments);

    if (input.caller.role === "CLIENT") {
      if (input.caller.id !== booking.clientId) {
        throw matchingErrors.forbidden();
      }

      const clientLocation = await matchingRepository.findParticipantLocation(prisma, {
        bookingId: booking.id,
        userId: input.caller.id
      });

      if (!clientLocation) {
        throw matchingErrors.clientMatchNotStarted();
      }
    } else if (input.caller.role === "COMPANION") {
      ensureCompanionAssigned(assignments, input.caller.id);
    } else {
      throw matchingErrors.forbidden();
    }

    const updated = await matchingRepository.upsertParticipantLocation(prisma, {
      bookingId: booking.id,
      userId: input.caller.id,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updatedAt: new Date()
    });

    return {
      bookingId: booking.id,
      updatedAt: updated.updatedAt.toISOString()
    };
  }
};

type AssignmentRow = {
  designation: "CAPTAIN" | "VICE_CAPTAIN";
  companionId: string;
  presenceStatus: "ASSIGNED" | "ARRIVED";
  selfMatchStatus: "NOT_MATCHED" | "MATCHED";
  clientMatchStatus: "WAITING_FOR_CLIENT" | "CLIENT_MATCHED";
  companion?: {
    nickname: string;
    companionProfile: {
      languages: string[];
      profilePictureUrl: string;
      averageRating: Prisma.Decimal;
    } | null;
  };
};

// Ensure booking status is valid for matching reads/updates.
function ensureBookingAllowsMatchingContext(status: string) {
  if (status === "CONFIRMED" || status === "ACTIVE") {
    return;
  }

  throw matchingErrors.invalidState();
}

// Ensure both CAPTAIN and VICE_CAPTAIN assignments exist.
function ensureAssignmentPair(assignments: AssignmentRow[]) {
  const captain = assignments.find((row) => row.designation === "CAPTAIN");
  const viceCaptain = assignments.find((row) => row.designation === "VICE_CAPTAIN");
  if (!captain || !viceCaptain || assignments.length !== 2) {
    throw matchingErrors.invalidState();
  }

  return { captain, viceCaptain };
}

// Ensure the companion is assigned to the booking.
function ensureCompanionAssigned(assignments: AssignmentRow[], companionId: string) {
  const assignment = assignments.find((row) => row.companionId === companionId);
  if (!assignment) {
    throw matchingErrors.forbidden();
  }

  return assignment;
}

// Check whether both companions have arrived.
function areAllPresent(assignments: AssignmentRow[]) {
  return assignments.every((row) => row.presenceStatus === "ARRIVED");
}

// Check whether both companions are self-matched.
function areAllSelfMatched(assignments: AssignmentRow[]) {
  return assignments.every((row) => row.selfMatchStatus === "MATCHED");
}

// Check whether both companions are client-matched.
function areAllClientMatched(assignments: AssignmentRow[]) {
  return assignments.every((row) => row.clientMatchStatus === "CLIENT_MATCHED");
}

// Validate QR/PIN verification input against booking data.
function isVerificationValid(input: {
  method: "QR" | "PIN";
  qrCode?: string;
  pinCode?: string;
  bookingQr: string;
  bookingPin: string;
}) {
  if (input.method === "QR") {
    return Boolean(input.qrCode) && input.qrCode === input.bookingQr;
  }

  return Boolean(input.pinCode) && input.pinCode === input.bookingPin;
}

// Enforce GPS permission flags in the request payload.
function ensureGpsPermissions(input: { gpsPermissionGranted: boolean; gpsEnabled: boolean }) {
  if (!input.gpsPermissionGranted) {
    throw matchingErrors.gpsPermissionRequired();
  }

  if (!input.gpsEnabled) {
    throw matchingErrors.gpsDisabled();
  }
}

// Parse and validate incoming coordinates.
function parseCoordinates(input: { latitude: unknown; longitude: unknown }) {
  const latitude = parseCoordinate(input.latitude);
  const longitude = parseCoordinate(input.longitude);

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    throw matchingErrors.invalidCoordinates();
  }

  return { latitude, longitude };
}

// Parse a numeric coordinate from unknown input.
function parseCoordinate(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw matchingErrors.invalidCoordinates();
}

// Validate latitude range.
function isValidLatitude(value: number) {
  return value >= -90 && value <= 90;
}

// Validate longitude range.
function isValidLongitude(value: number) {
  return value >= -180 && value <= 180;
}

// Determine whether the client is within the allowed venue radius.
function isWithinVenueRadius(input: {
  clientLatitude: number;
  clientLongitude: number;
  venueLatitude: number;
  venueLongitude: number;
}) {
  const distance = calculateDistanceMeters({
    lat1: input.clientLatitude,
    lon1: input.clientLongitude,
    lat2: input.venueLatitude,
    lon2: input.venueLongitude
  });
  return distance <= VENUE_RADIUS_METERS;
}

// Calculate distance between two GPS points using the Haversine formula.
function calculateDistanceMeters(input: { lat1: number; lon1: number; lat2: number; lon2: number }) {
  const earthRadiusMeters = 6_371_000;
  const lat1Rad = toRadians(input.lat1);
  const lat2Rad = toRadians(input.lat2);
  const deltaLat = toRadians(input.lat2 - input.lat1);
  const deltaLon = toRadians(input.lon2 - input.lon1);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const a =
    sinLat * sinLat + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

// Convert degrees to radians.
function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

// Map assignment rows to a client-facing companion summary.
function toCompanionSummary(bookingId: string, assignment: AssignmentRow) {
  const profile = assignment.companion?.companionProfile;
  if (!profile || !assignment.companion) {
    logger.info({ bookingId, companionId: assignment.companionId }, "companion profile missing");
    throw matchingErrors.internalError("Companion profile missing");
  }

  return {
    id: assignment.companionId,
    displayName: assignment.companion.nickname,
    languages: profile.languages,
    averageRating: Number(profile.averageRating),
    profilePictureUrl: profile.profilePictureUrl
  };
}

// Attempt to log matching-related notification events without blocking flow.
function logNotificationDeferred(event: string, bookingId: string) {
  try {
    logger.info({ event, bookingId }, "notification deferred");
  } catch {
    // Ignore logging failures.
  }
}
