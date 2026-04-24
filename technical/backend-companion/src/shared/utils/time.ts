type TimeParts = {
  hours: number;
  minutes: number;
};

export function combineDateAndTime(date: Date, timeInput: string | Date) {
  const { hours, minutes } = getTimeParts(timeInput);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

function getTimeParts(timeInput: string | Date): TimeParts {
  if (typeof timeInput === "string") {
    return parseTimeString(timeInput);
  }

  return {
    hours: timeInput.getUTCHours(),
    minutes: timeInput.getUTCMinutes()
  };
}

function parseTimeString(value: string): TimeParts {
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours ?? 0);
  const minutes = Number(rawMinutes ?? 0);
  return { hours, minutes };
}
