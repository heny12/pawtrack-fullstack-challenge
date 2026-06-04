import type { Booking, Pet, Sitter, Tenant } from '../types/index.js';
import { tenants as seedTenants, pets as seedPets, bookings as seedBookings, sitters as seedSitters } from './seed.js';

// Memory store partitioned by tenantId
class MemoryStore {
  private tenants: Map<string, Tenant> = new Map();
  private pets: Map<string, Map<string, Pet>> = new Map();
  private bookings: Map<string, Map<string, Booking>> = new Map();
  private sitters: Map<string, Map<string, Sitter>> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.tenants.clear();
    this.pets.clear();
    this.bookings.clear();
    this.sitters.clear();

    for (const tenant of seedTenants) {
      this.tenants.set(tenant.id, { ...tenant });
    }
    for (const pet of seedPets) {
      if (!this.pets.has(pet.tenantId)) {
        this.pets.set(pet.tenantId, new Map());
      }
      this.pets.get(pet.tenantId)!.set(pet.id, { ...pet });
    }
    for (const booking of seedBookings) {
      if (!this.bookings.has(booking.tenantId)) {
        this.bookings.set(booking.tenantId, new Map());
      }
      this.bookings.get(booking.tenantId)!.set(booking.id, { ...booking });
    }
    for (const sitter of seedSitters) {
      if (!this.sitters.has(sitter.tenantId)) {
        this.sitters.set(sitter.tenantId, new Map());
      }
      this.sitters.get(sitter.tenantId)!.set(sitter.id, { ...sitter });
    }
  }

  // Tenant operations
  public getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  // Pet operations
  public getPet(tenantId: string, id: string): Pet | undefined {
    return this.pets.get(tenantId)?.get(id);
  }

  public getPets(tenantId: string): Pet[] {
    const tenantMap = this.pets.get(tenantId);
    return tenantMap ? Array.from(tenantMap.values()) : [];
  }

  // Booking operations
  public getBooking(tenantId: string, id: string): Booking | undefined {
    return this.bookings.get(tenantId)?.get(id);
  }

  public getBookings(tenantId: string): Booking[] {
    const tenantMap = this.bookings.get(tenantId);
    return tenantMap ? Array.from(tenantMap.values()) : [];
  }

  public getAllBookings(): Booking[] {
    return Array.from(this.bookings.values()).flatMap(tenantMap => Array.from(tenantMap.values()));
  }

  public createBooking(booking: Booking): Booking {
    if (!this.bookings.has(booking.tenantId)) {
      this.bookings.set(booking.tenantId, new Map());
    }
    this.bookings.get(booking.tenantId)!.set(booking.id, { ...booking });
    return booking;
  }

  public updateBooking(booking: Booking): Booking {
    if (!this.bookings.has(booking.tenantId)) {
      this.bookings.set(booking.tenantId, new Map());
    }
    this.bookings.get(booking.tenantId)!.set(booking.id, { ...booking });
    return booking;
  }

  // Sitter operations
  public getSitter(tenantId: string, id: string): Sitter | undefined {
    return this.sitters.get(tenantId)?.get(id);
  }

  public getSitters(tenantId: string): Sitter[] {
    const tenantMap = this.sitters.get(tenantId);
    return tenantMap ? Array.from(tenantMap.values()) : [];
  }
}

// Singleton instance
export const store = new MemoryStore();
