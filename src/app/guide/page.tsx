import Link from "next/link";

export const metadata = {
  title: "使い方 | 青色申告",
  description: "青色申告アプリの使い方と具体例",
};

export default function GuidePage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">使い方</h1>
      <p className="text-gray-500 text-sm mb-8">
        このアプリの基本的な流れと、取引日・入金日の違い、領収書の紐付け、具体例をまとめています。
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">1. 全体の流れ</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li><Link href="/settings" className="text-blue-600 hover:underline">設定</Link>で会計年度・事業者名・給与収入などを入力</li>
          <li><Link href="/journal" className="text-blue-600 hover:underline">仕訳帳</Link>で日々の取引を入力（売上・経費・入金・支払など）</li>
          <li>必要に応じて領収書の写真やPDFを仕訳に紐づける</li>
          <li><Link href="/ledger" className="text-blue-600 hover:underline">総勘定元帳</Link>で勘定科目ごとの残高を確認</li>
          <li><Link href="/reports/income-statement" className="text-blue-600 hover:underline">損益計算書</Link>・<Link href="/reports/balance-sheet" className="text-blue-600 hover:underline">貸借対照表</Link>で決算</li>
          <li>固定資産がある場合は<Link href="/reports/fixed-assets" className="text-blue-600 hover:underline">固定資産台帳</Link>で減価償却、在庫がある場合は<Link href="/reports/inventory" className="text-blue-600 hover:underline">棚卸表</Link>で期末棚卸</li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">2. 仕訳の入力</h2>
        <p className="text-sm text-gray-700 mb-3">
          仕訳帳の「新規仕訳入力」で、日付・摘要・勘定科目・借方・貸方・事業割合（家事按分）を入力します。借方合計と貸方合計が一致する必要があります。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li><strong>仕訳日（記入日）</strong> … 帳簿に記入する日。通常は取引があった日または入金・支払があった日</li>
          <li><strong>取引日</strong> … 売上や購入が「発生した」日（任意）</li>
          <li><strong>入金日/支払日</strong> … 実際にお金が入った・出た日（任意）</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">3. 日付の使い分け（売上日と入金日が違う場合）</h2>
        <p className="text-sm text-gray-700 mb-3">
          売上日と入金日、購入日と支払日が異なる取引はよくあります。このアプリでは次のように入力できます。
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm mb-4">
          <p className="font-medium text-gray-800 mb-2">例：3月15日に売上、4月10日に振込入金</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li><strong>仕訳日</strong> … 4/10（入金の事実を帳簿に記録する日として 4/10 にする場合）</li>
            <li><strong>取引日</strong> … 3/15（売上が発生した日）</li>
            <li><strong>入金日/支払日</strong> … 4/10（実際の入金日）</li>
          </ul>
          <p className="mt-2 text-gray-600">
            仕訳は「入金があった日」で1件入力し、摘要に「〇〇分売上入金」などと書くと分かりやすいです。取引日・入金日を両方入力しておくと、後からいつ売上でいつ入金だったかが分かります。
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <p className="font-medium text-gray-800 mb-2">例：2月20日に経費の請求、3月5日に口座振替で支払</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li><strong>仕訳日</strong> … 3/5（支払が行われた日）</li>
            <li><strong>取引日</strong> … 2/20（購入・利用した日）</li>
            <li><strong>入金日/支払日</strong> … 3/5（実際の支払日）</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">4. 領収書・PDFの紐付け</h2>
        <p className="text-sm text-gray-700 mb-3">
          領収書の写真（JPEG・PNG・WebP）やPDFをアップロードし、該当する仕訳に紐づけられます。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>仕訳一覧の各行に「+ 領収書」ボタンがあります。クリックしてファイルを選ぶと、その仕訳に紐づけて保存されます。</li>
          <li>紐づけた領収書はファイル名のリンクで開けます（別タブで表示）。</li>
          <li>税務署への提出や保存用に、取引ごとに領収書を紐づけておくことをおすすめします。</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">5. 具体例：売上入金（預金）</h2>
        <p className="text-sm text-gray-700 mb-2">クライアントから10万円が振り込まれた場合の仕訳です。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left border-b">勘定科目</th>
                <th className="px-3 py-2 text-right border-b">借方</th>
                <th className="px-3 py-2 text-right border-b">貸方</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border-b">その他の預金</td><td className="px-3 py-2 text-right border-b">100,000</td><td className="px-3 py-2 text-right border-b">0</td></tr>
              <tr><td className="px-3 py-2">売上高</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2 text-right">100,000</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">摘要例：「〇〇様 3月分報酬入金」</p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">6. 具体例：経費支払い（現金）</h2>
        <p className="text-sm text-gray-700 mb-2">消耗品を現金3,000円で購入した場合の仕訳です。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left border-b">勘定科目</th>
                <th className="px-3 py-2 text-right border-b">借方</th>
                <th className="px-3 py-2 text-right border-b">貸方</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border-b">消耗品費</td><td className="px-3 py-2 text-right border-b">3,000</td><td className="px-3 py-2 text-right border-b">0</td></tr>
              <tr><td className="px-3 py-2">現金</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2 text-right">3,000</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">家事と事業で兼用している場合は「事業割合%」で按分（例：50%）を入力します。</p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">7. 具体例：利用日と引き落とし日が違う場合（未払金）</h2>
        <p className="text-sm text-gray-700 mb-3">
          通信費など「利用した月」と「口座引き落とし日」が異なる取引は、<strong>2回に分けて仕訳</strong>します。まず利用日に経費と未払金を計上し、引き落とし日に未払金を消して預金を減らします。
        </p>

        <div className="space-y-4">
          <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">【1件目】利用日（1/15）— 通信費の発生</p>
            <p className="text-xs text-gray-600 mb-2">この日に通信費3,200円が発生したが、まだ支払っていない状態を記録します。</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border-b">勘定科目</th>
                  <th className="px-3 py-2 text-right border-b">借方</th>
                  <th className="px-3 py-2 text-right border-b">貸方</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-3 py-2 border-b">通信費</td><td className="px-3 py-2 text-right border-b">3,200</td><td className="px-3 py-2 text-right border-b">0</td></tr>
                <tr><td className="px-3 py-2">未払金</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2 text-right">3,200</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-600 mt-2 font-medium">アプリでの入力例</p>
            <ul className="text-xs text-gray-700 mt-1 space-y-0.5 list-disc list-inside">
              <li>仕訳日 … <strong>1/15</strong></li>
              <li>取引日 … 1/15（利用した日）</li>
              <li>入金日/支払日 … 未入力（まだ支払っていない）</li>
              <li>摘要 … 「1月分通信費（未払）」など</li>
            </ul>
          </div>

          <div className="bg-green-50/50 border border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-900 mb-2">【2件目】引き落とし日（2/10）— 口座から支払</p>
            <p className="text-xs text-gray-600 mb-2">2月10日に口座から3,200円が引き落とされたら、未払金を消して預金を減らします。</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border-b">勘定科目</th>
                  <th className="px-3 py-2 text-right border-b">借方</th>
                  <th className="px-3 py-2 text-right border-b">貸方</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-3 py-2 border-b">未払金</td><td className="px-3 py-2 text-right border-b">3,200</td><td className="px-3 py-2 text-right border-b">0</td></tr>
                <tr><td className="px-3 py-2">その他の預金</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2 text-right">3,200</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-600 mt-2 font-medium">アプリでの入力例</p>
            <ul className="text-xs text-gray-700 mt-1 space-y-0.5 list-disc list-inside">
              <li>仕訳日 … <strong>2/10</strong></li>
              <li>取引日 … 1/15（経費が発生した日、任意）</li>
              <li>入金日/支払日 … 2/10（実際の引き落とし日）</li>
              <li>摘要 … 「1月分通信費 口座引き落とし」など</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">※ 普通預金はこのアプリでは「その他の預金」で入力します。</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 mt-4">
          このように<strong>利用日で経費を計上</strong>し、<strong>引き落とし日で未払金を消す</strong>と、損益計算書には1月の通信費として3,200円が正しく載り、預金残高も引き落とし日に合わせて動きます。
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">8. 家事按分（事業割合）について</h2>
        <p className="text-sm text-gray-700 mb-3">
          自宅兼事務所、プライベートとビジネスで兼用する通信費・電気代などの経費は、<strong>事業用の割合を「按分%」で記録</strong>します。
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="font-medium text-blue-900 mb-2">重要：仕訳金額は「実額」を記入し、按分%で割合を記録します</p>
          <p className="text-sm text-blue-800 mb-3">
            例えば、家賃10万円で事業用50%の場合：
          </p>
          <ul className="text-sm text-blue-800 space-y-2 mb-3 list-disc list-inside">
            <li className="font-medium">❌ 間違い：借方「地代家賃 50,000」（10万×50%）/ 貸方「預金 50,000」</li>
            <li className="font-medium">✅ 正解：借方「地代家賃 100,000」/ 貸方「預金 100,000」、按分% = 50</li>
          </ul>
          <p className="text-xs text-blue-700">
            帳簿には<strong>実際に支払った全額（10万）を記録</strong>し、税務調査時に「うち50%が事業用」と説明できるようにします。
          </p>
        </div>

        <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">按分の具体例</h3>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 mb-2">例1：自宅の家賃（月額10万円、事業用50%）</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-2">
              <li><strong>借方:</strong> 地代家賃 100,000円</li>
              <li><strong>貸方:</strong> 普通預金 100,000円</li>
              <li><strong>事業割合:</strong> 50%</li>
              <li><strong>摘要:</strong> 「○月分家賃（事業50%）」など</li>
            </ul>
            <p className="text-xs text-gray-600">
              → 損益計算書には「地代家賃 50,000円」と表示されます（10万×50%）
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 mb-2">例2：携帯電話料金（月額5,000円、事業用80%）</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-2">
              <li><strong>借方:</strong> 通信費 5,000円</li>
              <li><strong>貸方:</strong> 未払金 5,000円（クレジット払いの場合）</li>
              <li><strong>事業割合:</strong> 80%</li>
            </ul>
            <p className="text-xs text-gray-600">
              → 損益計算書には「通信費 4,000円」と表示されます（5,000×80%）
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-700 mt-4">
          <strong>按分%を後から変更したい場合：</strong>仕訳一覧で「編集」ボタンをクリックして、按分%を修正できます。
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">9. 固定資産・棚卸</h2>
        <p className="text-sm text-gray-700 mb-2">
          <Link href="/reports/fixed-assets" className="text-blue-600 hover:underline">固定資産台帳</Link>でパソコンや車両などを登録すると、定額法で減価償却額が計算されます。年度末に「減価償却仕訳を作成」で一括仕訳できます。
        </p>
        <p className="text-sm text-gray-700 mb-2">
          <Link href="/reports/inventory" className="text-blue-600 hover:underline">棚卸表</Link>で期末の在庫を品目・数量・単価で入力し、合計で「期末棚卸高の仕訳を作成」すると、(借) 期末商品棚卸高 (貸) 仕入高 の仕訳が作られます。
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">10. 書類管理（請求書・見積書・納品書）</h2>
        <p className="text-sm text-gray-700 mb-3">
          <Link href="/documents" className="text-blue-600 hover:underline">書類管理</Link>から、取引先に提出する請求書・見積書・納品書を作成・印刷できます。
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">書類作成の流れ</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 mb-4">
          <li><Link href="/settings" className="text-blue-600 hover:underline">設定</Link>で事業者情報（住所・電話・振込先）を入力</li>
          <li><Link href="/clients" className="text-blue-600 hover:underline">取引先管理</Link>で取引先を登録（書類作成時にもインライン追加可）</li>
          <li><Link href="/documents/new" className="text-blue-600 hover:underline">新規作成</Link>で種別・取引先・明細を入力して保存</li>
          <li>詳細ページで印刷プレビューを確認し、「印刷」ボタンで印刷/PDF保存</li>
        </ol>

        <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">3つの書類の違い</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left border-b">書類</th>
                <th className="px-3 py-2 text-left border-b">いつ使うか</th>
                <th className="px-3 py-2 text-left border-b">ポイント</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border-b font-medium">見積書</td><td className="px-3 py-2 border-b">仕事を受ける前</td><td className="px-3 py-2 border-b">金額・内容の事前合意に使う</td></tr>
              <tr><td className="px-3 py-2 border-b font-medium">納品書</td><td className="px-3 py-2 border-b">成果物を納品するとき</td><td className="px-3 py-2 border-b">何をいつ納品したかの記録</td></tr>
              <tr><td className="px-3 py-2 font-medium">請求書</td><td className="px-3 py-2">代金を請求するとき</td><td className="px-3 py-2">振込先・支払期限を記載</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">便利な機能</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li><strong>書類の変換</strong> — 見積書から請求書へ、納品書から請求書へワンクリックで変換できます（明細がコピーされます）</li>
          <li><strong>書類の複製</strong> — 毎月同じ内容の請求書を出す場合、前月分を複製して日付だけ変更できます</li>
          <li><strong>ステータス管理</strong> — 下書き→送付済み→入金済み の順で状態を管理できます</li>
          <li><strong>消費税</strong> — 行ごとに税率（10%/8%/0%）を設定可能。軽減税率対象品目は自動で「※」マーク付き</li>
          <li><strong>インボイス対応</strong> — 設定でインボイス登録番号を入力すると、書類に自動表示されます（免税事業者は不要）</li>
        </ul>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
          <p className="text-sm text-amber-800">
            <strong>注意：</strong>請求書の作成だけでは仕訳帳には反映されません。売上の入金があったら、別途<Link href="/journal" className="text-blue-600 hover:underline">仕訳帳</Link>で仕訳を入力してください。
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold border-b-2 border-gray-200 pb-2 mb-4">11. 申告書について</h2>
        <p className="text-sm text-gray-700">
          このアプリでは帳簿・損益計算書・貸借対照表まで作成できます。確定申告書の作成・提出は<strong>国税庁の「確定申告書等作成コーナー」</strong>で行います。損益計算書・貸借対照表の数字を転記して申告書を作成してください。
        </p>
      </section>
    </div>
  );
}
