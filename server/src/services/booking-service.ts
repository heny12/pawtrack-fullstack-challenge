import { v4 as uuid } from 'uuid';
import type { Booking, BookingStatus, PaginatedResult, AuthContext } from '../types/index.js';
import { VALID_TRANSITIONS } from '../types/index.js';
import { store } from '../store/memory-store.js';
import { eventBus } from './event-emitter.js';

interface ListBookingsParams {
  tenantId: string;
  page: number;
  limit: number;
  date?: string;
  status?: BookingStatus;
}

interface CreateBookingParams {
  tenantId: string;
  petId: string;
  sitterId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  notes: string;
  createdBy: string;
}

// Very basic pessimistic pet and sitter locking to prevent concurrent booking requests
// NOTE: NOT production ready - should use proper locking mechanism (e.g. Redis, database locking)
// and abstract the locking logic out into a separate class/module
const petLocks = new Set<string>();
const sitterLocks = new Set<string>();

export class BookingService {
  /**
   * List bookings for a tenant with optional date and status filters.
   * Supports pagination.
   */
  public listBookings(params: ListBookingsParams): PaginatedResult<Booking> {
    const { tenantId, page, limit, date, status } = params;

    let bookings = store.getBookings(tenantId);

    // Filter by date if provided
    if (date) {
      // Match bookings on the requested date
      bookings = bookings.filter(b => b.scheduledDate.startsWith(date));
    }

    // Filter by status if provided
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }

    // Sort by scheduled date descending (newest first)
    bookings.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

    const total = bookings.length;
    const totalPages = Math.ceil(total / limit);

    const offset = (page - 1) * limit;
    const paginatedBookings = bookings.slice(offset, offset + limit);

    return {
      data: paginatedBookings,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Create a new booking.
   * Checks for overlapping bookings with the same sitter.
   */
  public async createBooking(params: CreateBookingParams): Promise<Booking> {
    const { tenantId, petId, sitterId, scheduledDate, startTime, endTime, notes, createdBy } = params;

    const petLockKey = `pet_${petId}`;
    const sitterLockKey = `sitter_${sitterId}`;

    if (petLocks.has(petLockKey) || sitterLocks.has(sitterLockKey)) {
      throw new Error('unable to obtain lock');
    }
    petLocks.add(petLockKey);
    sitterLocks.add(sitterLockKey);

    try {
      // Check for overlapping bookings with the same sitter
      const existingBookings = store.getAllBookings().filter(
        b => b.sitterId === sitterId && b.status !== 'cancelled',
      );

      const hasOverlap = existingBookings.some(b => {
        const existingStart = new Date(`${b.scheduledDate.split('T')[0]}T${b.startTime}`);
        const existingEnd = new Date(`${b.scheduledDate.split('T')[0]}T${b.endTime}`);
        const newStart = new Date(`${scheduledDate.split('T')[0]}T${startTime}`);
        const newEnd = new Date(`${scheduledDate.split('T')[0]}T${endTime}`);

        return newStart < existingEnd && newEnd > existingStart;
      });

      if (hasOverlap) {
        throw new Error('Sitter has an overlapping booking for this time slot');
      }

      // Simulate async operation (like a database write)
      await new Promise(resolve => setTimeout(resolve, 10));

      const now = new Date().toISOString();
      const booking: Booking = {
        id: `booking_${uuid().slice(0, 8)}`,
        tenantId,
        petId,
        sitterId,
        status: 'requested',
        scheduledDate,
        startTime,
        endTime,
        notes,
        createdAt: now,
        updatedAt: now,
        statusChangedAt: now,
        statusChangedBy: createdBy,
      };

      store.createBooking(booking);

      try {
        eventBus.emit('booking.created', {
          bookingId: booking.id,
          tenantId: booking.tenantId,
          petId: booking.petId,
          sitterId: booking.sitterId,
        });
      } catch (error) {
        // This is a non-critical operation so we can continue on failure
        console.error('Error emitting booking.created event', error);
      }

      return booking;
    } finally {
      petLocks.delete(petLockKey);
      sitterLocks.delete(sitterLockKey);
    }
  }

  /**
   * Update booking status with transition validation.
   */
  public updateStatus(
    tenantId: string,
    bookingId: string,
    newStatus: BookingStatus,
    changedBy: string,
  ): { success: boolean; booking?: Booking; error?: string } {
    const booking = store.getBooking(tenantId, bookingId);

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const allowedTransitions = VALID_TRANSITIONS[booking.status];
    if (!allowedTransitions.includes(newStatus)) {
      return {
        success: false,
        error: `Cannot transition from '${booking.status}' to '${newStatus}'`,
      };
    }

    // Overwrite status — no history kept
    const updatedBooking: Booking = {
      ...booking,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
      statusChangedBy: changedBy,
    };

    store.updateBooking(updatedBooking);

    // Overwrite status and notify listeners
    try {
      eventBus.emit('booking.statusChanged', {
        bookingId: updatedBooking.id,
        previousStatus: booking.status,
        newStatus,
        changedBy,
      });
    } catch (error) {
      // This is a non-critical operation so we can continue on failure
      console.error('Error emitting booking.statusChanged event', error);
    }

    return { success: true, booking: updatedBooking };
  }

  /**
   * Get a single booking by ID.
   */
  public getBooking(tenantId: string, bookingId: string): Booking | undefined {
    return store.getBooking(tenantId, bookingId);
  }
}

export const bookingService = new BookingService();
