"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
    >
      印刷
    </button>
  );
}
