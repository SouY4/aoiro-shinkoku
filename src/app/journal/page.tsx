import { getJournalEntries } from "@/actions/journal-actions";
import { getSettings } from "@/actions/settings-actions";
import { toReiwa } from "@/lib/formatters";
import JournalEntryFormWrapper from "@/components/journal/JournalEntryFormWrapper";
import JournalList from "@/components/journal/JournalList";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const settings = await getSettings();
  const entries = await getJournalEntries(settings.fiscalYear);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">仕訳帳</h1>
      <p className="text-gray-500 text-sm mb-6">{toReiwa(settings.fiscalYear)}度</p>

      <JournalEntryFormWrapper />

      <div className="bg-white rounded-xl border border-gray-200 mt-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">仕訳一覧 ({entries.length}件)</h2>
        </div>
        <JournalList entries={entries} />
      </div>
    </div>
  );
}
