export interface MonthlyFeeSummary {
  year: number;
  month: number; // 1-12
  chargeFeeTotal: number;   // charge 行の Fee 合計
  stripeFeeTotal: number;   // stripe_fee 行の Net絶対値合計
  total: number;            // chargeFeeTotal + stripeFeeTotal
  chargeCount: number;
  stripeFeeCount: number;
  ignoredCount: number;     // 対象外 Type の件数
}

/** 引用符（"..."）と内部カンマ・改行に対応した最小 CSV パーサ。末尾の空行は無視。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** "2025-05-12 03:00"（UTC）を JST に換算して年・月を返す。 */
function toJstYearMonth(createdUtc: string): { year: number; month: number } {
  const s = createdUtc.trim();
  // "YYYY-MM-DD HH:MM"(長さ16) は秒を補い、"...HH:MM:SS" はそのまま UTC とみなす
  const iso = s.replace(" ", "T") + (s.length === 16 ? ":00Z" : "Z");
  const utc = new Date(iso);
  if (Number.isNaN(utc.getTime())) throw new Error(`無効な日時フォーマット: ${createdUtc}`);
  const jst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

export function aggregateStripeFees(csvText: string): MonthlyFeeSummary[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error("CSV が空です");

  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  const typeI = idx("Type");
  const feeI = idx("Fee");
  const netI = idx("Net");
  const createdI = idx("Created (UTC)");
  if (typeI < 0 || feeI < 0 || netI < 0 || createdI < 0) {
    throw new Error("必要な列（Type / Fee / Net / Created (UTC)）が見つかりません");
  }
  if (rows.length <= 1) throw new Error("CSV にデータ行がありません");

  const map = new Map<string, MonthlyFeeSummary>();
  const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const ensure = (y: number, m: number): MonthlyFeeSummary => {
    const key = keyOf(y, m);
    let s = map.get(key);
    if (!s) {
      s = { year: y, month: m, chargeFeeTotal: 0, stripeFeeTotal: 0, total: 0, chargeCount: 0, stripeFeeCount: 0, ignoredCount: 0 };
      map.set(key, s);
    }
    return s;
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const type = r[typeI];
    const created = r[createdI];
    if (!created) continue;
    const { year, month } = toJstYearMonth(created);
    const s = ensure(year, month);
    if (type === "charge") {
      const fee = Math.abs(parseInt(r[feeI] || "0", 10)) || 0;
      s.chargeFeeTotal += fee;
      s.chargeCount += 1;
    } else if (type === "stripe_fee") {
      const net = Math.abs(parseInt(r[netI] || "0", 10)) || 0;
      s.stripeFeeTotal += net;
      s.stripeFeeCount += 1;
    } else {
      s.ignoredCount += 1;
    }
  }

  for (const s of map.values()) s.total = s.chargeFeeTotal + s.stripeFeeTotal;

  return [...map.values()].sort((a, b) => keyOf(a.year, a.month).localeCompare(keyOf(b.year, b.month)));
}
