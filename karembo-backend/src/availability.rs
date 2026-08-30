use chrono::{DateTime, Datelike, Duration, FixedOffset, NaiveDate, NaiveTime, TimeZone, Utc};

use crate::models::AvailableSlot;

/// A half-open interval `[start, end)` during which a stylist is unavailable.
///
/// Both live bookings and approved time off reduce to this shape, so the slot
/// generator does not need to care which one blocked a given window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BusyInterval {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl BusyInterval {
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    /// Half-open overlap: an appointment ending exactly when another starts is
    /// not a clash, which is what makes back-to-back bookings possible.
    fn overlaps(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> bool {
        start < self.end && end > self.start
    }
}

/// A recurring shift, expressed in the salon's local wall-clock time.
#[derive(Debug, Clone, Copy)]
pub struct Shift {
    pub start: NaiveTime,
    pub end: NaiveTime,
}

/// Inputs for a single day's slot computation.
pub struct SlotQuery<'a> {
    /// The calendar date being asked about, in salon-local time.
    pub date: NaiveDate,
    /// The salon's UTC offset (see `Config::utc_offset_hours`).
    pub offset: FixedOffset,
    /// How long the requested service takes.
    pub service_duration_min: i64,
    /// The stylist's shifts for this weekday.
    pub shifts: &'a [Shift],
    /// Bookings and time off that already occupy the calendar.
    pub busy: &'a [BusyInterval],
    /// Reference "now", so callers (and tests) control the clock.
    pub now: DateTime<Utc>,
    /// Minimum notice before a slot may be booked.
    pub lead_minutes: i64,
    /// Spacing between candidate start times.
    pub step_minutes: i64,
}

/// Compute the bookable start times for one stylist, one service, one day.
///
/// A candidate start time survives only if the whole appointment fits inside a
/// single shift, clears the booking lead time, and overlaps nothing already on
/// the calendar. Appointments are never split across a break: a 90-minute service
/// cannot straddle the 13:00-14:00 gap between two shifts, because each shift is
/// walked independently.
pub fn compute_slots(query: &SlotQuery<'_>) -> Vec<AvailableSlot> {
    let mut slots = Vec::new();

    if query.service_duration_min <= 0 || query.step_minutes <= 0 {
        return slots;
    }

    let duration = Duration::minutes(query.service_duration_min);
    let step = Duration::minutes(query.step_minutes);
    let earliest_start = query.now + Duration::minutes(query.lead_minutes);

    for shift in query.shifts {
        // Resolve the shift's wall-clock bounds into absolute instants. A fixed
        // offset has no DST gaps, so this mapping is always unambiguous.
        let Some(shift_start) = local_instant(query.date, shift.start, query.offset) else {
            continue;
        };
        let Some(shift_end) = local_instant(query.date, shift.end, query.offset) else {
            continue;
        };

        let mut candidate = shift_start;

        while candidate + duration <= shift_end {
            let candidate_end = candidate + duration;

            let too_soon = candidate < earliest_start;
            let clashes = query
                .busy
                .iter()
                .any(|interval| interval.overlaps(candidate, candidate_end));

            if !too_soon && !clashes {
                slots.push(AvailableSlot {
                    starts_at: candidate,
                    ends_at: candidate_end,
                });
            }

            candidate += step;
        }
    }

    slots.sort_by_key(|slot| slot.starts_at);
    slots
}

/// Turn a salon-local date and time into an absolute instant.
fn local_instant(
    date: NaiveDate,
    time: NaiveTime,
    offset: FixedOffset,
) -> Option<DateTime<Utc>> {
    offset
        .from_local_datetime(&date.and_time(time))
        .single()
        .map(|dt| dt.with_timezone(&Utc))
}

/// The ISO weekday (1 = Monday .. 7 = Sunday) matching the `working_hours.weekday` column.
pub fn iso_weekday(date: NaiveDate) -> i16 {
    date.weekday().number_from_monday() as i16
}

/// The absolute window covering one salon-local day, used to fetch the day's
/// bookings. Widened by a day on each side so an appointment that starts the
/// previous evening and runs past midnight is still seen as busy.
pub fn day_window(date: NaiveDate, offset: FixedOffset) -> (DateTime<Utc>, DateTime<Utc>) {
    let start_of_day = date.and_time(NaiveTime::MIN);
    let base = offset
        .from_local_datetime(&start_of_day)
        .single()
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|| Utc.from_utc_datetime(&start_of_day));

    (base - Duration::days(1), base + Duration::days(2))
}

#[cfg(test)]
mod tests {
    use super::*;

    const EAT_OFFSET_SECS: i32 = 3 * 3600;

    fn offset() -> FixedOffset {
        FixedOffset::east_opt(EAT_OFFSET_SECS).unwrap()
    }

    fn date() -> NaiveDate {
        // 2026-09-08 is a Tuesday.
        NaiveDate::from_ymd_opt(2026, 9, 8).unwrap()
    }

    fn at(hour: u32, minute: u32) -> DateTime<Utc> {
        local_instant(
            date(),
            NaiveTime::from_hms_opt(hour, minute, 0).unwrap(),
            offset(),
        )
        .unwrap()
    }

    fn shift(from: (u32, u32), to: (u32, u32)) -> Shift {
        Shift {
            start: NaiveTime::from_hms_opt(from.0, from.1, 0).unwrap(),
            end: NaiveTime::from_hms_opt(to.0, to.1, 0).unwrap(),
        }
    }

    /// A query with the clock set well before the day, so lead time never interferes.
    fn query<'a>(
        shifts: &'a [Shift],
        busy: &'a [BusyInterval],
        duration: i64,
    ) -> SlotQuery<'a> {
        SlotQuery {
            date: date(),
            offset: offset(),
            service_duration_min: duration,
            shifts,
            busy,
            now: at(0, 0) - Duration::days(3),
            lead_minutes: 60,
            step_minutes: 15,
        }
    }

    fn local_times(slots: &[AvailableSlot]) -> Vec<String> {
        slots
            .iter()
            .map(|slot| {
                slot.starts_at
                    .with_timezone(&offset())
                    .format("%H:%M")
                    .to_string()
            })
            .collect()
    }

    #[test]
    fn walks_a_shift_in_steps() {
        let shifts = [shift((9, 0), (11, 0))];
        let slots = compute_slots(&query(&shifts, &[], 60));

        // 09:00, 09:15 .. 10:00 — the last slot must still end by 11:00.
        assert_eq!(
            local_times(&slots),
            vec!["09:00", "09:15", "09:30", "09:45", "10:00"]
        );
    }

    #[test]
    fn never_offers_a_slot_that_overruns_the_shift() {
        let shifts = [shift((9, 0), (10, 0))];
        let slots = compute_slots(&query(&shifts, &[], 90));
        assert!(
            slots.is_empty(),
            "a 90-minute service cannot fit a 60-minute shift"
        );
    }

    #[test]
    fn an_appointment_cannot_straddle_a_break() {
        // Two shifts with a 13:00-14:00 break. A 90-minute service must not be
        // offered at 12:00 (which would run through the break).
        let shifts = [shift((9, 0), (13, 0)), shift((14, 0), (18, 0))];
        let slots = compute_slots(&query(&shifts, &[], 90));
        let times = local_times(&slots);

        assert!(times.contains(&"11:30".to_string()), "11:30-13:00 fits");
        assert!(!times.contains(&"12:00".to_string()), "12:00-13:30 crosses the break");
        assert!(times.contains(&"14:00".to_string()), "afternoon shift resumes");
        assert!(!times.contains(&"17:00".to_string()), "17:00-18:30 overruns the shift");
        assert!(times.contains(&"16:30".to_string()), "16:30-18:00 fits exactly");
    }

    #[test]
    fn an_existing_booking_blocks_overlapping_slots() {
        let shifts = [shift((9, 0), (12, 0))];
        let busy = [BusyInterval::new(at(10, 0), at(11, 0))];
        let slots = compute_slots(&query(&shifts, &busy, 60));
        let times = local_times(&slots);

        assert_eq!(times, vec!["09:00", "11:00"]);
        assert!(!times.contains(&"09:30".to_string()), "09:30-10:30 overlaps");
        assert!(!times.contains(&"10:00".to_string()), "exact overlap");
        assert!(!times.contains(&"10:30".to_string()), "10:30-11:30 overlaps");
    }

    #[test]
    fn back_to_back_booking_is_allowed() {
        // A slot starting exactly when an existing booking ends is bookable —
        // this mirrors the half-open range used by the database constraint.
        let shifts = [shift((9, 0), (11, 0))];
        let busy = [BusyInterval::new(at(9, 0), at(10, 0))];
        let slots = compute_slots(&query(&shifts, &busy, 60));

        assert_eq!(local_times(&slots), vec!["10:00"]);
    }

    #[test]
    fn time_off_blocks_the_whole_window() {
        let shifts = [shift((9, 0), (13, 0))];
        let busy = [BusyInterval::new(at(9, 0), at(13, 0))];
        let slots = compute_slots(&query(&shifts, &busy, 60));
        assert!(slots.is_empty(), "a full-day absence leaves nothing bookable");
    }

    #[test]
    fn lead_time_hides_slots_that_are_too_soon() {
        let shifts = [shift((9, 0), (12, 0))];
        let mut q = query(&shifts, &[], 60);
        // It is 09:30 on the day itself, with a 60-minute notice requirement,
        // so nothing before 10:30 may be offered.
        q.now = at(9, 30);
        let slots = compute_slots(&q);

        // 11:00 is the last start that still ends by 12:00.
        assert_eq!(local_times(&slots), vec!["10:30", "10:45", "11:00"]);
    }

    #[test]
    fn no_shifts_means_no_slots() {
        let slots = compute_slots(&query(&[], &[], 60));
        assert!(slots.is_empty(), "a day off yields nothing");
    }

    #[test]
    fn results_are_sorted_even_across_shifts() {
        // Deliberately pass the afternoon shift first.
        let shifts = [shift((14, 0), (16, 0)), shift((9, 0), (11, 0))];
        let slots = compute_slots(&query(&shifts, &[], 60));
        let times = local_times(&slots);

        let mut sorted = times.clone();
        sorted.sort();
        assert_eq!(times, sorted);
        assert_eq!(times.first().map(String::as_str), Some("09:00"));
    }

    #[test]
    fn zero_duration_service_yields_nothing() {
        let shifts = [shift((9, 0), (17, 0))];
        assert!(compute_slots(&query(&shifts, &[], 0)).is_empty());
    }

    #[test]
    fn iso_weekday_matches_the_schema_convention() {
        // 2026-09-07 is a Monday, 2026-09-13 the following Sunday.
        assert_eq!(iso_weekday(NaiveDate::from_ymd_opt(2026, 9, 7).unwrap()), 1);
        assert_eq!(iso_weekday(NaiveDate::from_ymd_opt(2026, 9, 8).unwrap()), 2);
        assert_eq!(iso_weekday(NaiveDate::from_ymd_opt(2026, 9, 13).unwrap()), 7);
    }

    #[test]
    fn day_window_brackets_the_local_day() {
        let (from, to) = day_window(date(), offset());
        // Local midnight on 2026-09-08 in UTC+3 is 21:00 UTC the previous day.
        assert!(from < at(0, 0), "window opens before the local day starts");
        assert!(to > at(23, 59), "window closes after the local day ends");
    }

    #[test]
    fn slots_are_reported_in_utc_but_align_to_local_wall_clock() {
        let shifts = [shift((9, 0), (10, 0))];
        let slots = compute_slots(&query(&shifts, &[], 60));
        assert_eq!(slots.len(), 1);
        // 09:00 EAT is 06:00 UTC.
        assert_eq!(slots[0].starts_at.format("%H:%M").to_string(), "06:00");
    }
}
