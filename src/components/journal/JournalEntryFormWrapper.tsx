"use client";

import { useState, useEffect, useCallback, useRef, type ComponentType } from "react";
import { createJournalEntry } from "@/actions/journal-actions";
import { uploadReceipt } from "@/actions/receipt-actions";
import { getAccounts } from "@/actions/account-actions";
import { getClients, createClient } from "@/actions/client-actions";
import { getSubscriptionTemplates, saveSubscriptionTemplates } from "@/actions/settings-actions";
import { useRouter } from "next/navigation";
import {
  Palette,
  Server,
  Globe,
  Github,
  Bot,
  Cloud,
  Music,
  BarChart3,
  Lightbulb,
  Smartphone,
  Wifi,
  Gamepad2,
  Tv,
  Headphones,
  Package,
  Wrench,
  Laptop,
  Home,
  Car,
  BookOpen,
  CreditCard,
  ShoppingCart,
  Zap,
  Camera,
  Pen,
  Settings,
  Plus,
  X,
  RotateCcw,
  Upload,
  Paperclip,
  ChevronUp,
  ChevronDown,
  type LucideProps,
} from "lucide-react";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface Client {
  id: number;
  name: string;
  honorific: string;
}

/** 1行 = 借方科目+金額 & 貸方科目+金額 の横並び */
interface Row {
  debitAccountId: number;
  debitAmount: number;
  creditAccountId: number;
  creditAmount: number;
  description: string;
  allocationPercent: number;
}

const emptyRow = (): Row => ({
  debitAccountId: 0,
  debitAmount: 0,
  creditAccountId: 0,
  creditAmount: 0,
  description: "",
  allocationPercent: 100,
});

const TEMPLATES = [
  { name: "売上入金（預金）", debitCode: "1004", creditCode: "4001", desc: "売上入金" },
  { name: "売上入金（現金）", debitCode: "1001", creditCode: "4001", desc: "売上入金" },
  { name: "仕入（現金）", debitCode: "5002", creditCode: "1001", desc: "仕入" },
  { name: "経費（現金）", debitCode: "", creditCode: "1001", desc: "" },
  { name: "経費（事業主借）", debitCode: "", creditCode: "3001", desc: "" },
  { name: "事業主貸", debitCode: "1090", creditCode: "1004", desc: "事業主貸" },
];

/** Lucide アイコンマップ */
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  palette: Palette,
  server: Server,
  globe: Globe,
  github: Github,
  bot: Bot,
  cloud: Cloud,
  music: Music,
  "bar-chart": BarChart3,
  lightbulb: Lightbulb,
  smartphone: Smartphone,
  wifi: Wifi,
  gamepad: Gamepad2,
  tv: Tv,
  headphones: Headphones,
  package: Package,
  wrench: Wrench,
  laptop: Laptop,
  home: Home,
  car: Car,
  "book-open": BookOpen,
  "credit-card": CreditCard,
  "shopping-cart": ShoppingCart,
  zap: Zap,
  camera: Camera,
  pen: Pen,
  "rotate-ccw": RotateCcw,
};

const ICON_KEYS = Object.keys(ICON_MAP);

function IconComponent({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] || Package;
  return <Icon size={size} className={className} />;
}

/** サブスク用ショートカット：1行分 */
interface SubTemplateLine {
  debitCode: string;
  creditCode: string;
  desc: string;
  amount: number;  // 0 = 手動入力
  percent: number; // 事業割合
}

/** サブスク用ショートカット定義（複数行対応） */
interface SubTemplate {
  id: string;
  label: string;
  icon: string;
  lines: SubTemplateLine[];
}

function makeLine(debitCode: string, creditCode: string, desc: string, amount: number, percent: number): SubTemplateLine {
  return { debitCode, creditCode, desc, amount, percent };
}

const DEFAULT_SUBSCRIPTIONS: SubTemplate[] = [
  { id: "adobe",        label: "Adobe CC",         icon: "palette",      lines: [makeLine("6010", "3001", "Adobe Creative Cloud 月額", 2180, 100)] },
  { id: "server",       label: "サーバー代",        icon: "server",       lines: [makeLine("6005", "3001", "レンタルサーバー 月額", 0, 100)] },
  { id: "domain",       label: "ドメイン",          icon: "globe",        lines: [makeLine("6005", "3001", "ドメイン更新", 0, 100)] },
  { id: "github",       label: "GitHub",            icon: "github",       lines: [makeLine("6005", "3001", "GitHub 月額", 0, 100)] },
  { id: "chatgpt",      label: "ChatGPT",           icon: "bot",          lines: [makeLine("6005", "3001", "ChatGPT Plus 月額", 0, 100)] },
  { id: "icloud",       label: "iCloud",            icon: "cloud",        lines: [makeLine("6005", "3001", "iCloud+ 月額", 130, 50)] },
  { id: "spotify",      label: "Spotify",           icon: "music",        lines: [makeLine("6005", "3001", "Spotify 月額", 980, 0)] },
  { id: "office",       label: "Office 365",        icon: "bar-chart",    lines: [makeLine("6010", "3001", "Microsoft 365 月額", 0, 80)] },
  { id: "electric",     label: "電気代",            icon: "lightbulb",    lines: [makeLine("6003", "3001", "電気代", 0, 30)] },
  { id: "phone",        label: "携帯代",            icon: "smartphone",   lines: [makeLine("6005", "3001", "携帯電話料金", 0, 50)] },
  { id: "internet",     label: "通信費（ネット）",  icon: "wifi",         lines: [makeLine("6005", "3001", "インターネット回線 月額", 0, 50)] },
  { id: "card-payment", label: "カード引落し",      icon: "credit-card",  lines: [makeLine("2004", "1004", "カード引落し", 0, 100)] },
  { id: "refund-bank",  label: "返金（預金）",      icon: "rotate-ccw",   lines: [makeLine("1004", "", "サブスク解約 返金", 0, 100)] },
  { id: "refund-card",  label: "返金（未払金）",    icon: "rotate-ccw",   lines: [makeLine("", "2004", "サブスク解約 返金（未払金相殺）", 0, 100)] },
];

/** 旧フォーマット（flat）を新フォーマット（lines配列）に変換 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLegacy(t: any): SubTemplate {
  if (Array.isArray(t.lines)) return t as SubTemplate;
  // 旧フォーマット: { debitCode, creditCode, desc, amount, percent }
  return {
    id: t.id ?? `legacy_${Date.now()}`,
    label: t.label ?? "",
    icon: t.icon ?? "package",
    lines: [{ debitCode: t.debitCode ?? "", creditCode: t.creditCode ?? "", desc: t.desc ?? "", amount: t.amount ?? 0, percent: t.percent ?? 100 }],
  };
}

/** DBから読んだJSON文字列をSubTemplate[]にパース */
function parseAndMerge(json: string | null): SubTemplate[] {
  if (!json) return DEFAULT_SUBSCRIPTIONS;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(json) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SUBSCRIPTIONS;
    return parsed.map(normalizeLegacy);
  } catch {
    return DEFAULT_SUBSCRIPTIONS;
  }
}

/** アイコン選択コンポーネント */
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <IconComponent name={value} size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 w-52">
            {ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                className={`w-9 h-9 flex items-center justify-center rounded-md hover:bg-blue-50 transition-colors ${
                  value === key ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" : "text-gray-600"
                }`}
                title={key}
              >
                <IconComponent name={key} size={16} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** ショートカット編集モーダル */
function SubscriptionEditor({
  items,
  accounts,
  onSave,
  onClose,
}: {
  items: SubTemplate[];
  accounts: Account[];
  onSave: (items: SubTemplate[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const [list, setList] = useState<SubTemplate[]>(() => items.map((i) => ({ ...i, lines: i.lines.map((l) => ({ ...l })) })));

  const updateMeta = (idx: number, updates: Partial<Pick<SubTemplate, "label" | "icon">>) => {
    setList((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  };

  const updateLine = (tIdx: number, lIdx: number, updates: Partial<SubTemplateLine>) => {
    setList((prev) => prev.map((item, i) => i !== tIdx ? item : {
      ...item,
      lines: item.lines.map((l, j) => j === lIdx ? { ...l, ...updates } : l),
    }));
  };

  const addLine = (tIdx: number) => {
    setList((prev) => prev.map((item, i) => i !== tIdx ? item : {
      ...item,
      lines: [...item.lines, { debitCode: "", creditCode: "2004", desc: "", amount: 0, percent: 100 }],
    }));
  };

  const removeLine = (tIdx: number, lIdx: number) => {
    setList((prev) => prev.map((item, i) => i !== tIdx ? item : {
      ...item,
      lines: item.lines.filter((_, j) => j !== lIdx),
    }));
  };

  const remove = (idx: number) => {
    setList((prev) => prev.filter((_, i) => i !== idx));
  };

  const add = () => {
    setList((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, label: "", icon: "package", lines: [{ debitCode: "", creditCode: "2004", desc: "", amount: 0, percent: 100 }] },
    ]);
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setList((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx >= list.length - 1) return;
    setList((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    const valid = list.filter((i) => i.label.trim());
    await onSave(valid);
    onClose();
  };

  const resetDefaults = () => {
    if (!window.confirm("カスタムで追加したショートカットは全て消えます。初期値に戻しますか？")) return;
    const defaults = DEFAULT_SUBSCRIPTIONS.map((i) => ({ ...i }));
    setList(defaults);
    // 保存はhandleSave時に行うのでここでは不要（onSaveで処理）
  };

  // 勘定科目をタイプ別にグループ化（借方・貸方どちらも全科目選択可能）
  const typeLabels: Record<string, string> = { asset: "資産", liability: "負債", capital: "資本", revenue: "収益", expense: "費用" };
  const groupedAccounts: Record<string, Account[]> = {};
  for (const a of accounts) {
    const lbl = typeLabels[a.type] || a.type;
    if (!groupedAccounts[lbl]) groupedAccounts[lbl] = [];
    groupedAccounts[lbl].push(a);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">サブスク・固定費ショートカットの編集</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {list.map((item, idx) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex gap-2 items-center mb-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                      title="上へ"
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(idx)}
                      disabled={idx === list.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                      title="下へ"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                  <IconPicker value={item.icon} onChange={(v) => updateMeta(idx, { icon: v })} />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateMeta(idx, { label: e.target.value })}
                    placeholder="ボタン名（例: Adobe CC）"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 行一覧 */}
                <div className="space-y-2">
                  {item.lines.map((line, lIdx) => (
                    <div key={lIdx} className="bg-white border border-gray-200 rounded-lg p-2">
                      {item.lines.length > 1 && (
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">行 {lIdx + 1}</span>
                          <button type="button" onClick={() => removeLine(idx, lIdx)} className="text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mb-1.5">
                        <div>
                          <label className="text-xs text-gray-500">借方科目</label>
                          <select value={line.debitCode} onChange={(e) => updateLine(idx, lIdx, { debitCode: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                            <option value="">-- なし --</option>
                            {Object.entries(groupedAccounts).map(([group, accs]) => (
                              <optgroup key={group} label={group}>
                                {accs.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">貸方科目</label>
                          <select value={line.creditCode} onChange={(e) => updateLine(idx, lIdx, { creditCode: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                            <option value="">-- なし --</option>
                            {Object.entries(groupedAccounts).map(([group, accs]) => (
                              <optgroup key={group} label={group}>
                                {accs.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_90px_70px] gap-1.5">
                        <div>
                          <label className="text-xs text-gray-500">摘要</label>
                          <input type="text" value={line.desc} onChange={(e) => updateLine(idx, lIdx, { desc: e.target.value })}
                            placeholder="取引内容" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">金額（0=手動）</label>
                          <input type="number" min={0} value={line.amount || ""} onChange={(e) => updateLine(idx, lIdx, { amount: parseInt(e.target.value) || 0 })}
                            placeholder="0" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">事業%</label>
                          <input type="number" min={0} max={100} value={line.percent}
                            onChange={(e) => updateLine(idx, lIdx, { percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => addLine(idx)}
                    className="w-full py-1 text-xs text-blue-500 border border-dashed border-blue-200 rounded hover:bg-blue-50 flex items-center justify-center gap-1">
                    <Plus size={12} /> 行を追加
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={add}
            className="mt-3 w-full py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-1"
          >
            <Plus size={14} />
            新しいショートカットを追加
          </button>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={resetDefaults}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg flex items-center gap-1"
          >
            <RotateCcw size={12} />
            初期値にリセット
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JournalEntryFormWrapper() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number>(0);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubTemplate[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showWithholdingModal, setShowWithholdingModal] = useState(false);
  const [withholdingReward, setWithholdingReward] = useState("");
  const [withholdingRate, setWithholdingRate] = useState("10.21");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAccounts().then(setAccounts);
    getClients().then(setClients);
    getSubscriptionTemplates().then((json) => setSubscriptions(parseAndMerge(json)));
  }, []);

  // 科目が選択されている行のみ合計（複合仕訳で片側のみの行がある場合に対応）
  const totalDebit = rows.reduce((s, r) => s + (r.debitAccountId > 0 ? r.debitAmount : 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (r.creditAccountId > 0 ? r.creditAmount : 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const addRow = () => setRows([...rows, emptyRow()]);

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, updates: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const applyTemplate = (t: (typeof TEMPLATES)[0]) => {
    const debit = accounts.find((a) => a.code === t.debitCode);
    const credit = accounts.find((a) => a.code === t.creditCode);
    setRows([
      {
        debitAccountId: debit?.id || 0,
        debitAmount: 0,
        creditAccountId: credit?.id || 0,
        creditAmount: 0,
        description: t.desc,
        allocationPercent: 100,
      },
    ]);
  };

  const applyWithholdingTemplate = () => {
    const reward = Math.round(parseFloat(withholdingReward) || 0);
    const rate = parseFloat(withholdingRate) || 10.21;
    const withholding = Math.floor(reward * rate / 100);
    const deposit = reward - withholding;
    if (reward <= 0) return;

    const bankAccount = accounts.find((a) => a.code === "1004");
    const receivableAccount = accounts.find((a) => a.code === "1011");
    const ownerDrawAccount = accounts.find((a) => a.code === "1090");

    setRows([
      {
        debitAccountId: bankAccount?.id || 0,
        debitAmount: deposit,
        creditAccountId: receivableAccount?.id || 0,
        creditAmount: reward,
        description: "売掛金回収（源泉徴収後）",
        allocationPercent: 100,
      },
      {
        debitAccountId: ownerDrawAccount?.id || 0,
        debitAmount: withholding,
        creditAccountId: 0,
        creditAmount: 0,
        description: `源泉徴収額（${rate}%）`,
        allocationPercent: 100,
      },
    ]);
    setShowWithholdingModal(false);
    setWithholdingReward("");
  };

  const applySubscription = useCallback((t: SubTemplate) => {
    const allZeroPercent = t.lines.every((l) => l.percent === 0);
    if (allZeroPercent) {
      setError("この項目は事業割合0%のため、事業経費として計上できません。事業で使用する場合は編集で割合を変更してください。");
      return;
    }
    const newRows = t.lines.map((line) => {
      const debit = accounts.find((a) => a.code === line.debitCode);
      const credit = accounts.find((a) => a.code === line.creditCode);
      return {
        debitAccountId: debit?.id || 0,
        debitAmount: line.amount,
        creditAccountId: credit?.id || 0,
        creditAmount: line.amount,
        description: line.desc,
        allocationPercent: line.percent,
      };
    });
    setRows(newRows);
    setError("");
  }, [accounts]);

  const handleSaveSubscriptions = useCallback(
    async (items: SubTemplate[]) => {
      setSubscriptions(items);
      try {
        await saveSubscriptionTemplates(JSON.stringify(items));
        const fresh = await getSubscriptionTemplates();
        setSubscriptions(fresh ? parseAndMerge(fresh) : items);
        router.refresh();
      } catch (e) {
        console.error("ショートカットの保存に失敗しました:", e);
        alert("ショートカットの保存に失敗しました。しばらくしてから再度お試しください。");
      }
    },
    [router]
  );

  /** Row形式 -> サーバーに送る JournalLine[] 形式に変換 */
  const toServerLines = () => {
    const lines: {
      accountId: number;
      debitAmount: number;
      creditAmount: number;
      description?: string;
      allocationPercent: number;
    }[] = [];

    for (const row of rows) {
      if (row.debitAccountId > 0 && row.debitAmount > 0) {
        lines.push({
          accountId: row.debitAccountId,
          debitAmount: row.debitAmount,
          creditAmount: 0,
          description: row.description || undefined,
          allocationPercent: row.allocationPercent,
        });
      }
      if (row.creditAccountId > 0 && row.creditAmount > 0) {
        lines.push({
          accountId: row.creditAccountId,
          debitAmount: 0,
          creditAmount: row.creditAmount,
          description: row.description || undefined,
          allocationPercent: row.allocationPercent,
        });
      }
    }
    return lines;
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    setNewClientLoading(true);
    try {
      const created = await createClient({ name: newClientName.trim() });
      setClients((prev) => [...prev, { id: created.id, name: created.name, honorific: created.honorific }].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(created.id);
      setShowNewClient(false);
      setNewClientName("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "取引先の作成に失敗しました");
    } finally {
      setNewClientLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!date) {
      setError("日付を入力してください");
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.debitAccountId === 0 && r.creditAccountId === 0) {
        setError(`行${i + 1}: 借方科目または貸方科目を選択してください`);
        return;
      }
      if (r.debitAccountId > 0 && r.debitAmount <= 0) {
        setError(`行${i + 1}: 借方金額を入力してください`);
        return;
      }
      if (r.creditAccountId > 0 && r.creditAmount <= 0) {
        setError(`行${i + 1}: 貸方金額を入力してください`);
        return;
      }
      if (!r.description.trim()) {
        setError(`行${i + 1}: 摘要を入力してください`);
        return;
      }
    }

    if (!isBalanced) {
      setError(
        `借方合計(${totalDebit.toLocaleString()}円)と貸方合計(${totalCredit.toLocaleString()}円)が一致しません`
      );
      return;
    }

    const lines = toServerLines();
    if (lines.length < 2) {
      setError("借方と貸方の両方に科目と金額を入力してください");
      return;
    }

    const mainDescription = rows[0].description.trim() || rows.map((r) => r.description).find((d) => d.trim()) || "";

    setLoading(true);
    try {
      const entry = await createJournalEntry({
        date,
        description: mainDescription,
        clientId: clientId || null,
        lines,
      });

      // 領収書があればアップロード
      if (receiptFiles.length > 0) {
        for (const file of receiptFiles) {
          const formData = new FormData();
          formData.set("file", file);
          formData.set("journalEntryId", String(entry.id));
          await uploadReceipt(formData);
        }
      }

      setRows([emptyRow()]);
      setClientId(0);
      setReceiptFiles([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 勘定科目をグループ化
  const grouped: Record<string, Account[]> = {};
  const labels: Record<string, string> = {
    asset: "資産",
    liability: "負債",
    capital: "資本",
    revenue: "収益",
    expense: "費用",
  };
  for (const a of accounts) {
    const lbl = labels[a.type] || a.type;
    if (!grouped[lbl]) grouped[lbl] = [];
    grouped[lbl].push(a);
  }

  const AccountSelect = ({
    value,
    onChange,
    placeholder,
  }: {
    value: number;
    onChange: (v: number) => void;
    placeholder: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value={0}>{placeholder}</option>
      {Object.entries(grouped).map(([g, accs]) => (
        <optgroup key={g} label={g}>
          {accs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4">新規仕訳入力</h2>

      {/* サブスク・固定費ショートカット */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
            <Package size={14} />
            サブスク・固定費
          </h3>
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
          >
            <Settings size={12} />
            <span>編集</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {subscriptions.map((t) => {
            const allZero = t.lines.every((l) => l.percent === 0);
            const firstAmount = t.lines[0]?.amount ?? 0;
            const firstPercent = t.lines[0]?.percent ?? 100;
            const multiLine = t.lines.length > 1;
            const tooltip = t.lines.map((l, i) =>
              `行${i + 1}: ${l.desc || "—"}${l.amount > 0 ? ` ¥${l.amount.toLocaleString()}` : ""}${l.percent < 100 ? ` (事業${l.percent}%)` : ""}`
            ).join("\n");
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applySubscription(t)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                  allZero
                    ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
                title={tooltip}
              >
                <IconComponent name={t.icon} size={13} />
                {t.label}
                {firstAmount > 0 && <span className="opacity-70">¥{firstAmount.toLocaleString()}</span>}
                {firstPercent < 100 && !allZero && <span className="opacity-60">{firstPercent}%</span>}
                {multiLine && <span className="opacity-50 text-[10px]">{t.lines.length}行</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 仕訳テンプレート */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1.5">
          <Pen size={14} />
          テンプレート
        </h3>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => applyTemplate(t)}
              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowWithholdingModal(true)}
            className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
          >
            源泉徴収あり入金
          </button>
        </div>

        {/* 源泉徴収入力モーダル */}
        {showWithholdingModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowWithholdingModal(false)}>
            <div className="bg-white rounded-xl border border-gray-200 p-6 w-80 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">源泉徴収あり入金</h3>
                <button type="button" onClick={() => setShowWithholdingModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">報酬額（税込）</label>
                  <input
                    type="number"
                    value={withholdingReward}
                    onChange={(e) => setWithholdingReward(e.target.value)}
                    placeholder="100000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">源泉徴収率（%）</label>
                  <input
                    type="number"
                    step="0.01"
                    value={withholdingRate}
                    onChange={(e) => setWithholdingRate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {parseFloat(withholdingReward) > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 text-gray-700">
                    {(() => {
                      const reward = Math.round(parseFloat(withholdingReward));
                      const rate = parseFloat(withholdingRate) || 10.21;
                      const withholding = Math.floor(reward * rate / 100);
                      const deposit = reward - withholding;
                      return (
                        <>
                          <div className="flex justify-between"><span>入金額（預金）</span><span className="tabular-nums">¥{deposit.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>源泉徴収額（事業主貸）</span><span className="tabular-nums">¥{withholding.toLocaleString()}</span></div>
                          <div className="flex justify-between font-medium border-t border-gray-200 pt-1"><span>報酬額（売掛金）</span><span className="tabular-nums">¥{reward.toLocaleString()}</span></div>
                        </>
                      );
                    })()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={applyWithholdingTemplate}
                  disabled={!withholdingReward || parseFloat(withholdingReward) <= 0}
                  className="w-full py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  仕訳を生成
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <form onSubmit={handleSubmit}>
        {/* 日付 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* 取引先 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">取引先（任意）</label>
          <div className="flex items-center gap-2">
            <select
              value={clientId}
              onChange={(e) => setClientId(parseInt(e.target.value))}
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>-- 選択しない --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setShowNewClient(true); setNewClientName(""); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
            >
              <Plus size={13} />
              新規
            </button>
          </div>

          {showNewClient && (
            <div className="mt-2 flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateClient(); } }}
                placeholder="取引先名"
                autoFocus
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={!newClientName.trim() || newClientLoading}
                onClick={handleCreateClient}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => setShowNewClient(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* 仕訳テーブル（横並び形式） */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">借方科目</th>
                <th className="px-3 py-2.5 text-right font-medium">金額</th>
                <th className="px-3 py-2.5 text-left font-medium">貸方科目</th>
                <th className="px-3 py-2.5 text-right font-medium">金額</th>
                <th className="px-3 py-2.5 text-left font-medium">摘要</th>
                <th className="px-3 py-2.5 text-center font-medium" title="事業割合（家事按分）。金額は実額を入力し、ここで事業用の割合を指定します。例：家賃10万円で事業用50%の場合、金額10万+事業割合50%">事業%</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="px-2 py-2">
                    <AccountSelect
                      value={row.debitAccountId}
                      onChange={(v) => updateRow(idx, { debitAccountId: v })}
                      placeholder="-- 借方 --"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      value={row.debitAmount || ""}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        // 貸方が空の時だけ自動同期（複合仕訳で異なる金額を入力できるようにする）
                        updateRow(idx, { debitAmount: v, creditAmount: row.creditAmount === 0 ? v : row.creditAmount });
                      }}
                      placeholder="0"
                      className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <AccountSelect
                      value={row.creditAccountId}
                      onChange={(v) => updateRow(idx, { creditAccountId: v })}
                      placeholder="-- 貸方 --"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      value={row.creditAmount || ""}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        // 借方が空の時だけ自動同期
                        updateRow(idx, { creditAmount: v, debitAmount: row.debitAmount === 0 ? v : row.debitAmount });
                      }}
                      placeholder="0"
                      className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      placeholder="取引内容"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={row.allocationPercent}
                      onChange={(e) =>
                        updateRow(idx, {
                          allocationPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-12 border border-gray-300 rounded px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="事業用の割合（%）。100=全額事業、50=50%が事業用・50%が私用。このフィールドで割合を記録し、金額は実額を入力します。"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="border-t border-gray-200">
                <td className="px-3 py-2 font-medium text-right">合計</td>
                <td
                  className={`px-3 py-2 text-right font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}
                >
                  {totalDebit.toLocaleString()}円
                </td>
                <td></td>
                <td
                  className={`px-3 py-2 text-right font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}
                >
                  {totalCredit.toLocaleString()}円
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 領収書ドラッグ&ドロップ */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const files = Array.from(e.dataTransfer.files).filter((f) =>
              ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(f.type)
            );
            if (files.length > 0) setReceiptFiles((prev) => [...prev, ...files]);
          }}
          className={`mb-4 border-2 border-dashed rounded-lg p-3 transition-colors ${
            dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Paperclip size={14} />
              <span>領収書</span>
            </div>
            {receiptFiles.length > 0 ? (
              <div className="flex flex-wrap gap-2 flex-1">
                {receiptFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700">
                    {f.name.length > 20 ? f.name.slice(0, 18) + "…" : f.name}
                    <button
                      type="button"
                      onClick={() => setReceiptFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400 flex-1">ここにドラッグ&ドロップ、またはクリックで追加</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) setReceiptFiles((prev) => [...prev, ...files]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50 flex items-center gap-1"
            >
              <Upload size={12} />
              選択
            </button>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 flex items-center gap-1"
          >
            <Plus size={14} />
            行を追加
          </button>
          <button
            type="submit"
            disabled={loading || !isBalanced}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "仕訳を保存"}
          </button>
          {!isBalanced && totalDebit + totalCredit > 0 && (
            <span className="text-red-500 text-sm">
              差額: {Math.abs(totalDebit - totalCredit).toLocaleString()}円
            </span>
          )}
        </div>
        {error && <p className="mt-3 text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
      </form>

      {/* ショートカット編集モーダル */}
      {showEditor && (
        <SubscriptionEditor
          items={subscriptions}
          accounts={accounts}
          onSave={handleSaveSubscriptions}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
