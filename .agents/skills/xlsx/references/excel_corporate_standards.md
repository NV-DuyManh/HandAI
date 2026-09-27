# Enterprise Excel Standards & Best Practices (Wall Street & Big 4 Standard)

This reference outlines the financial modeling, dashboard, and spreadsheet engineering standards used by top global investment banks, private equity firms, and corporate strategy teams.

---

## 🎨 1. Standard Color-Coding Conventions (FAST / Wall Street Standard)

| Text Color | Meaning | Purpose | Example |
| :--- | :--- | :--- | :--- |
| **Blue (`#0000FF`)** | **Hardcoded Inputs / Assumptions** | Constants that a user can safely edit | Historical revenue, growth rate %, unit price |
| **Black (`#000000`)** | **Calculations & Formulas** | Automatically derived logic | `=SUM(C5:C10)`, `=C12*(1+D12)` |
| **Green (`#008000`)** | **Inter-Sheet / External Links** | References pulled from other sheets | `=Assumptions!B4`, `='P&L'!E20` |
| **Red (`#FF0000`)** | **Warnings / Checks** | Error alerts or balance checks | `=IF(C20<>0, "UNBALANCED", "OK")` |

---

## 🔢 2. Number Formatting Matrix

Always explicitly format every cell in Excel (never leave as `General`):

| Data Type | Excel Format String | Display Example |
| :--- | :--- | :--- |
| **Currency (USD)** | `"$#,##0;($#,##0);\"-\""` | `$1,250,000`, `($45,000)`, `$-` |
| **Currency (VND)** | `"#,##0 \"₫\";(#,##0 \"₫\");\"-\""` | `150,000,000 ₫` |
| **Percentages** | `"0.0%"` or `"0.00%"` | `18.5%`, `-3.2%` |
| **Multiples (Valuation)** | `"0.0\"x\""` | `12.4x`, `8.5x` |
| **Integers / Counts** | `"#,##0"` | `4,500` |
| **Dates** | `"yyyy-mm-dd"` | `2026-09-04` |

---

## 📊 3. Executive Dashboard & Table Layout Rules

1. **Header Rows**:
   - Background: Oxford Navy (`#0F2C59`), Steel Slate (`#1E293B`), or Financial Emerald (`#064E3B`).
   - Text: Bold, White (`#FFFFFF`), centered or aligned to match data.
   - Height: 26–30 pt with vertical center alignment.
2. **Total Rows**:
   - Top border: Single thin border (`#000000`).
   - Bottom border: Double underline (classic accounting style).
   - Text: Bold.
3. **Freeze Panes**:
   - Always freeze top row / header (`A2` or `B4`) so headers remain visible when scrolling.
4. **Column Auto-Fit**:
   - Set column width = max character length + 4 padding characters so no text is truncated or shows `###`.
5. **Chart Aesthetics**:
   - Remove heavy vertical gridlines; keep only subtle dashed horizontal gridlines.
   - Use high-contrast corporate accent colors (`#0F2C59`, `#2563EB`, `#059669`, `#D97706`).
   - Add clear Chart Title and Legend positioned at the top or bottom.
