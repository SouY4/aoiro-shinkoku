export const DEFAULT_ACCOUNTS = [
  // ===== 資産の部 (Assets) =====
  { code: "1001", name: "現金",         type: "asset", category: "current_asset",  sortOrder: 1 },
  { code: "1002", name: "当座預金",     type: "asset", category: "current_asset",  sortOrder: 2 },
  { code: "1003", name: "定期預金",     type: "asset", category: "current_asset",  sortOrder: 3 },
  { code: "1004", name: "その他の預金", type: "asset", category: "current_asset",  sortOrder: 4 },
  { code: "1010", name: "受取手形",     type: "asset", category: "current_asset",  sortOrder: 5 },
  { code: "1011", name: "売掛金",       type: "asset", category: "current_asset",  sortOrder: 6 },
  { code: "1012", name: "有価証券",     type: "asset", category: "current_asset",  sortOrder: 7 },
  { code: "1013", name: "棚卸資産",     type: "asset", category: "current_asset",  sortOrder: 8 },
  { code: "1014", name: "前払金",       type: "asset", category: "current_asset",  sortOrder: 9 },
  { code: "1015", name: "貸付金",       type: "asset", category: "current_asset",  sortOrder: 10 },
  { code: "1050", name: "建物",         type: "asset", category: "fixed_asset",    sortOrder: 11 },
  { code: "1051", name: "建物附属設備", type: "asset", category: "fixed_asset",    sortOrder: 12 },
  { code: "1052", name: "機械装置",     type: "asset", category: "fixed_asset",    sortOrder: 13 },
  { code: "1053", name: "車両運搬具",   type: "asset", category: "fixed_asset",    sortOrder: 14 },
  { code: "1054", name: "工具器具備品", type: "asset", category: "fixed_asset",    sortOrder: 15 },
  { code: "1055", name: "土地",         type: "asset", category: "fixed_asset",    sortOrder: 16 },
  { code: "1090", name: "事業主貸",     type: "asset", category: "owner_drawing",  sortOrder: 17 },

  // ===== 負債の部 (Liabilities) =====
  { code: "2001", name: "支払手形",     type: "liability", category: "current_liability", sortOrder: 1 },
  { code: "2002", name: "買掛金",       type: "liability", category: "current_liability", sortOrder: 2 },
  { code: "2003", name: "借入金",       type: "liability", category: "current_liability", sortOrder: 3 },
  { code: "2004", name: "未払金",       type: "liability", category: "current_liability", sortOrder: 4 },
  { code: "2005", name: "前受金",       type: "liability", category: "current_liability", sortOrder: 5 },
  { code: "2006", name: "預り金",       type: "liability", category: "current_liability", sortOrder: 6 },
  { code: "2007", name: "貸倒引当金",   type: "liability", category: "allowance",         sortOrder: 7 },

  // ===== 資本の部 (Capital) =====
  { code: "3001", name: "事業主借",     type: "capital", category: "owner_investment", sortOrder: 1 },
  { code: "3002", name: "元入金",       type: "capital", category: "capital",          sortOrder: 2 },

  // ===== 収益の部 (Revenue) =====
  { code: "4001", name: "売上高",       type: "revenue", category: "sales",    sortOrder: 1 },
  { code: "4002", name: "家事消費",     type: "revenue", category: "sales",    sortOrder: 2 },
  { code: "4003", name: "雑収入",       type: "revenue", category: "other",    sortOrder: 3 },

  // ===== 売上原価 (Cost of Goods Sold) =====
  { code: "5001", name: "期首商品棚卸高", type: "expense", category: "cogs", sortOrder: 1 },
  { code: "5002", name: "仕入高",         type: "expense", category: "cogs", sortOrder: 2 },
  { code: "5003", name: "期末商品棚卸高", type: "expense", category: "cogs", sortOrder: 3 },

  // ===== 経費の部 (Expenses) =====
  { code: "6001", name: "租税公課",     type: "expense", category: "operating", sortOrder: 10 },
  { code: "6002", name: "荷造運賃",     type: "expense", category: "operating", sortOrder: 11 },
  { code: "6003", name: "水道光熱費",   type: "expense", category: "operating", sortOrder: 12 },
  { code: "6004", name: "旅費交通費",   type: "expense", category: "operating", sortOrder: 13 },
  { code: "6005", name: "通信費",       type: "expense", category: "operating", sortOrder: 14 },
  { code: "6006", name: "広告宣伝費",   type: "expense", category: "operating", sortOrder: 15 },
  { code: "6007", name: "接待交際費",   type: "expense", category: "operating", sortOrder: 16 },
  { code: "6008", name: "損害保険料",   type: "expense", category: "operating", sortOrder: 17 },
  { code: "6009", name: "修繕費",       type: "expense", category: "operating", sortOrder: 18 },
  { code: "6010", name: "消耗品費",     type: "expense", category: "operating", sortOrder: 19 },
  { code: "6011", name: "減価償却費",   type: "expense", category: "operating", sortOrder: 20 },
  { code: "6012", name: "福利厚生費",   type: "expense", category: "operating", sortOrder: 21 },
  { code: "6013", name: "給料賃金",     type: "expense", category: "operating", sortOrder: 22 },
  { code: "6014", name: "外注工賃",     type: "expense", category: "operating", sortOrder: 23 },
  { code: "6015", name: "利子割引料",   type: "expense", category: "operating", sortOrder: 24 },
  { code: "6016", name: "地代家賃",     type: "expense", category: "operating", sortOrder: 25 },
  { code: "6017", name: "貸倒金",       type: "expense", category: "operating", sortOrder: 26 },
  { code: "6018", name: "雑費",         type: "expense", category: "operating", sortOrder: 27 },
  { code: "6019", name: "支払手数料",   type: "expense", category: "operating", sortOrder: 28 },
];
