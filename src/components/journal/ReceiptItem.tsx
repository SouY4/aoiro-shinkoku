"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteReceipt } from "@/actions/receipt-actions";
import { X } from "lucide-react";

export default function ReceiptItem({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteReceipt(id);
      router.refresh();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5 group">
      <a
        href={`/api/receipts?id=${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        {name.length > 12 ? name.slice(0, 10) + "…" : name}
      </a>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="領収書を削除"
      >
        <X size={12} />
      </button>
    </span>
  );
}
