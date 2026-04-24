type TimeParts = {
  hours: number;
  minutes: number;
};

// Merge a date with a time string/Date into a single Date instance.
export function combineDateAndTime(date: Date, timeInput: string | Date) {
  const { hours, minutes } = getTimeParts(timeInput);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

// Extract hours/minutes from a string or Date input.
function getTimeParts(timeInput: string | Date): TimeParts {
  if (typeof timeInput === "string") {
    return parseTimeString(timeInput);
  }

  return {
    hours: timeInput.getUTCHours(),
    minutes: timeInput.getUTCMinutes()
  };
}

// Parse an HH:mm string into hours/minutes.
function parseTimeString(value: string): TimeParts {
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours ?? 0);
  const minutes = Number(rawMinutes ?? 0);
  return { hours, minutes };
}
