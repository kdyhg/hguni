const KOREA_OFFSET_MINUTES = 9 * 60;

export type Schedule = {
  name: string;
  weekdays: number[];
  startLocal: string;
  endLocal: string;
};

export function localMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("시간은 HH:mm 형식이어야 합니다.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("유효하지 않은 시간입니다.");
  return hour * 60 + minute;
}

export function validateSchedule(schedule: Schedule) {
  if (!schedule.name.trim()) throw new Error("활동 이름을 입력하세요.");
  if (!schedule.weekdays.length || schedule.weekdays.some((day) => day < 0 || day > 6)) {
    throw new Error("활동 요일을 선택하세요.");
  }
  if (localMinute(schedule.startLocal) >= localMinute(schedule.endLocal)) {
    throw new Error("종료 시간은 시작 시간보다 늦어야 합니다.");
  }
}

export function schedulesOverlap(a: Schedule, b: Schedule) {
  if (!a.weekdays.some((day) => b.weekdays.includes(day))) return false;
  return localMinute(a.startLocal) < localMinute(b.endLocal) && localMinute(b.startLocal) < localMinute(a.endLocal);
}

export function koreaParts(date: Date) {
  const shifted = new Date(date.getTime() + KOREA_OFFSET_MINUTES * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function isOpenAt(schedule: Schedule, date: Date) {
  validateSchedule(schedule);
  const now = koreaParts(date);
  return schedule.weekdays.includes(now.weekday)
    && now.minute >= localMinute(schedule.startLocal)
    && now.minute < localMinute(schedule.endLocal);
}
