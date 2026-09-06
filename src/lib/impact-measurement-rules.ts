// Plain (non-server-action) constants shared by the Impact Measurement module. Kept out of
// src/lib/actions/impact-measurement.ts because a 'use server' file may only export async
// functions -- exporting this const array from there breaks the Next.js build.
export const CHECKPOINTS = [30, 60, 90] as const;
export type CheckpointDays = (typeof CHECKPOINTS)[number];
