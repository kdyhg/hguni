import { z } from "zod";

export type ActivityScheduleDto = { id: string; name: string; weekdays: number[]; startLocal: string; endLocal: string; enabled: boolean; allowedItemKeys: string[] };
export type SettingsDto = {
  timezone: "Asia/Seoul";
  settingsVersion: number;
  teacherSourceId: string | null;
  pinConfigured: boolean;
  schedules: ActivityScheduleDto[];
  sourceTeachers: { id: string; name: string; active: boolean }[];
  penaltyItems: { key: string; label: string; signedPoints: number; enabled: boolean }[];
  paused: boolean;
  bridge: { online: boolean; sqlReady: boolean; catalogSyncedAt: string | null; penaltyReady: boolean; cancellationReady: boolean };
  readiness: { key: string; label: string; ready: boolean; detail: string }[];
};

export const scheduleInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startLocal: z.string().regex(/^\d{2}:\d{2}$/),
  endLocal: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean(),
  allowedItemKeys: z.array(z.string().regex(/^D:.+/)).min(1).max(20),
}).strict();

export const pinChangeSchema = z.object({ pin: z.string().regex(/^\d{6}$/), confirmation: z.string().regex(/^\d{6}$/) }).strict().refine((value) => value.pin === value.confirmation, { message: "PIN 확인이 일치하지 않습니다." });
export const inviteSchema = z.object({ email: z.string().email().max(254), role: z.enum(["admin", "teacher"]).default("teacher") }).strict();
export const settingsUpdateSchema = z.object({ settingsVersion: z.number().int().positive(), teacherSourceId: z.string().min(1).max(120).nullable().optional(), paused: z.boolean().optional() }).strict().refine((value) => value.teacherSourceId !== undefined || value.paused !== undefined);
