const CENTRAL_TIME_ZONE = 'America/Chicago';

export function hourInCentralTime(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date).find(({ type }) => type === 'hour')?.value;

  const parsed = Number(hour);
  if (!Number.isInteger(parsed)) {
    throw new TypeError('Unable to determine the Central Time hour.');
  }

  return parsed === 24 ? 0 : parsed;
}

export function greetingForCentralTime(date = new Date()) {
  const hour = hourInCentralTime(date);
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
