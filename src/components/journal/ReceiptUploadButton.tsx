"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadReceipt } from "@/actions/receipt-actions";

export default function ReceiptUploadButton({ journalEntryId }: { journalEntryId: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("journalEntryId", String(journalEntryId));
      await uploadReceipt(formData);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
      >
        {loading ? "送信中..." : "+ 領収書"}
      </button>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </span>
  );
}
