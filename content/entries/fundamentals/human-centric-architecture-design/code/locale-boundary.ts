type CanonicalAppointment = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  clinicCode: string;
};

type AppointmentView = {
  id: string;
  date: string;
  time: string;
  duration: string;
  clinicName: string;
};

export function localizeAppointment(
  appointment: CanonicalAppointment,
  locale: string,
  timeZone: string,
  clinicNames: Record<string, string>,
): AppointmentView {
  const startsAt = new Date(appointment.startsAt);

  return {
    id: appointment.id,
    date: new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeZone,
    }).format(startsAt),
    time: new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      timeZone,
    }).format(startsAt),
    duration: new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'minute',
      unitDisplay: 'long',
    }).format(appointment.durationMinutes),
    clinicName: clinicNames[locale] ?? clinicNames.en ?? appointment.clinicCode,
  };
}

// Keep timestamps, durations, and identifiers canonical in storage.
// Apply language, direction, local names, and formatting at the delivery boundary.
