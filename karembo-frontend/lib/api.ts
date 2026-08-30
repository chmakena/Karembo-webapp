import type {
  AdminOverview,
  AvailabilityResponse,
  Booking,
  BookingList,
  BookingStatus,
  Category,
  CustomerSummary,
  DayAvailability,
  Service,
  Session,
  StaffMember,
  TimeOff,
  UserProfile,
  WorkingHour,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8080";

/** Where the session token lives. Read directly so a stale React closure can't
 *  send an old token after a re-login. */
const TOKEN_KEY = "karembo.token";

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/** An error carrying the API's own message, so the UI can show what the server
 *  actually said rather than a generic failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** The slot was taken between loading availability and confirming. */
  get isConflict() {
    return this.status === 409;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Attach the bearer token. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = readToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // A network-level failure is distinct from an API error and needs its own
    // message — "failed to fetch" tells a user nothing actionable.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      0,
      "network_error",
      "Could not reach the Karembo server. Check that the backend is running.",
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const detail = (payload as { error?: { code?: string; message?: string } } | null)
      ?.error;
    throw new ApiError(
      response.status,
      detail?.code ?? "unknown",
      detail?.message ?? `Request failed with status ${response.status}.`,
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

/** The full API surface, grouped the way the UI consumes it. */
export const api = {
  health: () => request<{ status: string }>("/health", { auth: false }),

  auth: {
    register: (body: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
    }) => request<Session>("/auth/register", { method: "POST", body, auth: false }),

    login: (body: { email: string; password: string }) =>
      request<Session>("/auth/login", { method: "POST", body, auth: false }),

    me: () => request<UserProfile>("/auth/me"),

    updateProfile: (body: { full_name?: string; phone?: string }) =>
      request<UserProfile>("/auth/me", { method: "PATCH", body }),

    changePassword: (body: { current_password: string; new_password: string }) =>
      request<void>("/auth/password", { method: "POST", body }),
  },

  catalogue: {
    services: (category?: string) =>
      request<Service[]>(`/services${query({ category })}`, { auth: false }),

    categories: () => request<Category[]>("/categories", { auth: false }),

    service: (slug: string) =>
      request<Service>(`/services/${encodeURIComponent(slug)}`, { auth: false }),

    staff: (serviceId?: string) =>
      request<StaffMember[]>(`/staff${query({ service_id: serviceId })}`, {
        auth: false,
      }),

    availability: (params: { staffId: string; serviceId: string; date: string }) =>
      request<AvailabilityResponse>(
        `/availability${query({
          staff_id: params.staffId,
          service_id: params.serviceId,
          date: params.date,
        })}`,
        { auth: false },
      ),

    availabilityDays: (params: {
      staffId: string;
      serviceId: string;
      from: string;
      to: string;
    }) =>
      request<DayAvailability[]>(
        `/availability/days${query({
          staff_id: params.staffId,
          service_id: params.serviceId,
          from: params.from,
          to: params.to,
        })}`,
        { auth: false },
      ),
  },

  bookings: {
    list: (window: "upcoming" | "past" = "upcoming") =>
      request<BookingList>(`/bookings${query({ window })}`),

    get: (id: string) => request<Booking>(`/bookings/${id}`),

    create: (body: {
      staff_id: string;
      service_id: string;
      starts_at: string;
      notes?: string;
    }) => request<Booking>("/bookings", { method: "POST", body }),

    cancel: (id: string, reason?: string) =>
      request<Booking>(`/bookings/${id}/cancel`, {
        method: "POST",
        body: { reason },
      }),

    reschedule: (id: string, body: { starts_at: string; staff_id?: string }) =>
      request<Booking>(`/bookings/${id}/reschedule`, { method: "POST", body }),
  },

  admin: {
    overview: () => request<AdminOverview>("/admin/overview"),

    bookings: (filters: {
      status?: BookingStatus | "";
      staff_id?: string;
      from?: string;
      to?: string;
      search?: string;
    } = {}) => request<Booking[]>(`/admin/bookings${query(filters)}`),

    setBookingStatus: (
      id: string,
      body: { status: BookingStatus; cancellation_reason?: string },
    ) => request<Booking>(`/admin/bookings/${id}/status`, { method: "PATCH", body }),

    services: () => request<Service[]>("/admin/services"),

    createService: (body: {
      name: string;
      slug: string;
      description?: string;
      category: string;
      duration_min: number;
      price_cents: number;
    }) => request<Service>("/admin/services", { method: "POST", body }),

    updateService: (
      id: string,
      body: Partial<{
        name: string;
        description: string;
        category: string;
        duration_min: number;
        price_cents: number;
        is_active: boolean;
      }>,
    ) => request<Service>(`/admin/services/${id}`, { method: "PATCH", body }),

    retireService: (id: string) =>
      request<void>(`/admin/services/${id}`, { method: "DELETE" }),

    staff: () => request<StaffMember[]>("/admin/staff"),

    createStaff: (body: {
      display_name: string;
      title?: string;
      bio?: string;
    }) => request<StaffMember>("/admin/staff", { method: "POST", body }),

    updateStaff: (
      id: string,
      body: Partial<{
        display_name: string;
        title: string;
        bio: string;
        is_active: boolean;
      }>,
    ) => request<StaffMember>(`/admin/staff/${id}`, { method: "PATCH", body }),

    setStaffServices: (id: string, serviceIds: string[]) =>
      request<{ staff_id: string; service_ids: string[] }>(
        `/admin/staff/${id}/services`,
        { method: "PUT", body: { service_ids: serviceIds } },
      ),

    workingHours: (id: string) =>
      request<WorkingHour[]>(`/admin/staff/${id}/working-hours`),

    setWorkingHours: (
      id: string,
      shifts: { weekday: number; start_time: string; end_time: string }[],
    ) =>
      request<WorkingHour[]>(`/admin/staff/${id}/working-hours`, {
        method: "PUT",
        body: { shifts },
      }),

    timeOff: (id: string) => request<TimeOff[]>(`/admin/staff/${id}/time-off`),

    createTimeOff: (
      id: string,
      body: { starts_at: string; ends_at: string; reason?: string },
    ) =>
      request<{ time_off: TimeOff; clashing_bookings: number }>(
        `/admin/staff/${id}/time-off`,
        { method: "POST", body },
      ),

    deleteTimeOff: (id: string) =>
      request<void>(`/admin/time-off/${id}`, { method: "DELETE" }),

    customers: (search?: string) =>
      request<CustomerSummary[]>(`/admin/customers${query({ search })}`),
  },
};
