"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, updateClient, deleteClient } from "@/actions/client-actions";
import { Plus, Pencil, Trash2, X, Check, UserX } from "lucide-react";

type ClientRow = {
  id: number;
  name: string;
  honorific: string;
  contactPerson: string | null;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
  isActive: boolean;
  _count: { documents: number };
};

export default function ClientManager({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const emptyForm = { name: "", honorific: "御中", contactPerson: "", postalCode: "", address: "", phone: "", email: "", memo: "" };
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("取引先名を入力してください"); return; }
    setSaving(true);
    setError("");
    try {
      await createClient(form);
      setForm(emptyForm);
      setShowForm(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: ClientRow) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      honorific: c.honorific,
      contactPerson: c.contactPerson || "",
      postalCode: c.postalCode || "",
      address: c.address || "",
      phone: c.phone || "",
      email: c.email || "",
      memo: c.memo || "",
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      await updateClient(editingId, form);
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この取引先を削除しますか？")) return;
    try {
      await deleteClient(id);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "削除できませんでした");
    }
  };

  const handleToggleActive = async (c: ClientRow) => {
    try {
      await updateClient(c.id, { isActive: !c.isActive });
      router.refresh();
    } catch {
      alert("更新に失敗しました");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold">取引先一覧 ({clients.length}件)</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setError(""); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> 新規追加
        </button>
      </div>

      {error && <div className="mx-4 mt-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}

      {/* 新規追加フォーム */}
      {showForm && (
        <div className="p-4 border-b border-gray-200 bg-blue-50/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="取引先名 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={form.honorific} onChange={(e) => setForm({ ...form, honorific: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="御中">御中（法人）</option>
              <option value="様">様（個人）</option>
            </select>
            <input placeholder="担当者名" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="郵便番号" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="電話番号" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="メールアドレス" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="住所" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="col-span-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="メモ" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}
              className="col-span-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "保存中..." : "追加"}
            </button>
            <button onClick={() => { setShowForm(false); setError(""); }}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* テーブル */}
      {clients.length === 0 ? (
        <p className="p-6 text-gray-400 text-center">取引先がまだ登録されていません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">取引先名</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">敬称</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">担当者</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">電話</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">メール</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">書類数</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={`border-t border-gray-100 hover:bg-gray-50 ${!c.isActive ? "opacity-50" : ""}`}>
                  {editingId === c.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <select value={form.honorific} onChange={(e) => setForm({ ...form, honorific: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm">
                          <option value="御中">御中</option>
                          <option value="様">様</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{c._count.documents}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={handleUpdate} disabled={saving} className="text-green-600 hover:text-green-800" title="保存">
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setEditingId(null); setError(""); }} className="text-gray-500 hover:text-gray-700" title="キャンセル">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-gray-600">{c.honorific}</td>
                      <td className="px-4 py-2 text-gray-600">{c.contactPerson || "-"}</td>
                      <td className="px-4 py-2 text-gray-600">{c.phone || "-"}</td>
                      <td className="px-4 py-2 text-gray-600">{c.email || "-"}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{c._count.documents}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => startEdit(c)} className="text-blue-600 hover:text-blue-800" title="編集">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleToggleActive(c)}
                            className={c.isActive ? "text-amber-500 hover:text-amber-700" : "text-green-500 hover:text-green-700"}
                            title={c.isActive ? "無効化" : "有効化"}>
                            <UserX size={13} />
                          </button>
                          {c._count.documents === 0 && (
                            <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700" title="削除">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
