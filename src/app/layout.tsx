import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import UpdateBanner from "@/components/UpdateBanner";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  FileOutput,
  Users,
  Calculator,
  Settings,
  Receipt,
  HelpCircle,
} from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "青色申告 - AoiroShinkoku",
  description: "個人事業主向け青色申告アプリケーション",
};

const navItems = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/guide", label: "使い方", icon: HelpCircle },
  { href: "/journal", label: "仕訳帳", icon: BookOpen },
  { href: "/ledger", label: "総勘定元帳", icon: FileText },
  { href: "/reports/income-statement", label: "損益計算書", icon: FileText },
  { href: "/reports/balance-sheet", label: "貸借対照表", icon: FileText },
  { href: "/reports/fixed-assets", label: "固定資産台帳", icon: FileText },
  { href: "/reports/inventory", label: "棚卸表", icon: FileText },
  { href: "/reports/audit-log", label: "仕訳変更履歴", icon: FileText },
  { href: "/documents", label: "書類管理", icon: FileOutput },
  { href: "/clients", label: "取引先管理", icon: Users },
  { href: "/simulator", label: "収入シミュレーター", icon: Calculator },
  { href: "/settings", label: "設定", icon: Settings },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="flex min-h-screen">
          {/* サイドバー */}
          <aside className="no-print w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-200">
              <h1 className="text-xl font-bold text-blue-600">
                <Receipt className="inline-block w-6 h-6 mr-2" />
                青色申告
              </h1>
              <p className="text-xs text-gray-500 mt-1">個人事業主向け会計アプリ</p>
            </div>
            <nav className="flex-1 p-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors mb-0.5"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* メインコンテンツ */}
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        <UpdateBanner />
      </body>
    </html>
  );
}
