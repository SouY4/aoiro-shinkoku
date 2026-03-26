import { z } from "zod";

const journalLineBaseSchema = z.object({
  accountId: z.number().int().positive("勘定科目を選択してください"),
  debitAmount: z.number().int().min(0, "金額は0以上で入力してください"),
  creditAmount: z.number().int().min(0, "金額は0以上で入力してください"),
  description: z.string().optional(),
});

export const journalLineSchema = journalLineBaseSchema
  .refine(
    (data) => !(data.debitAmount > 0 && data.creditAmount > 0),
    { message: "借方または貸方のどちらか一方に金額を入力してください", path: ["debitAmount"] }
  )
  .refine(
    (data) => data.debitAmount > 0 || data.creditAmount > 0,
    { message: "金額を入力してください", path: ["debitAmount"] }
  );

const journalEntryBaseSchema = z.object({
  date: z.string().min(1, "日付を入力してください"),
  description: z.string().min(1, "摘要を入力してください"),
  isAdjusting: z.boolean().default(false),
  lines: z.array(journalLineBaseSchema).min(2, "最低2行の仕訳明細が必要です"),
});

export const journalEntrySchema = journalEntryBaseSchema.refine(
  (data) => {
    const totalDebit = data.lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.creditAmount, 0);
    return totalDebit === totalCredit;
  },
  {
    message: "借方合計と貸方合計が一致しません",
    path: ["lines"],
  }
);

export const settingsSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2030),
  userName: z.string().optional(),
  businessName: z.string().optional(),
  salaryRevenue: z.number().int().min(0),
  isStudent: z.boolean(),
  blueReturnLevel: z.union([z.literal(65), z.literal(55)]),
});

export type JournalEntryFormData = z.infer<typeof journalEntrySchema>;
export type JournalLineFormData = z.infer<typeof journalLineSchema>;
export type SettingsFormData = z.infer<typeof settingsSchema>;
