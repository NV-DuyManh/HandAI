---
name: xlsx
description: Inspect, create, format, and automate enterprise-grade Microsoft Excel (.xlsx) spreadsheets, financial models, executive KPI dashboards, and data sheets. Use when working with Excel files, calculating budgets, creating charts, analyzing data, or building Wall Street/Big4 standard spreadsheets.
---

# Enterprise Excel (.xlsx) Mastery Skill

This skill provides complete capabilities to generate, format, update, and inspect enterprise-grade Microsoft Excel spreadsheets meeting global investment banking, management consulting (McKinsey, BCG, Big 4), and corporate finance standards.

---

## 🛠️ Environment & Helper Scripts

The skill comes with pre-built Python automation scripts located in `scripts/`:

| Script | Purpose | Example Command |
| :--- | :--- | :--- |
| **`create_executive_dashboard.py`** | Generates an executive dashboard with KPI Stat Cards, financial tables, and embedded charts. | `python .agents/skills/xlsx/scripts/create_executive_dashboard.py -o "dashboard.xlsx"` |
| **`read_xlsx.py`** | Inspects sheets, dimensions, tables, and data previews. | `python .agents/skills/xlsx/scripts/read_xlsx.py "data.xlsx"` |

> **Python Interpreter**: Use the environment's python (`python` or `"C:\Users\My PC\AppData\Local\Programs\Python\Python313\python.exe"`).

---

## 🏛️ Tool Selection Matrix

| Objective | Recommended Tool | Why |
| :--- | :--- | :--- |
| **New Formatted Reports / Dashboards / Charts** | `xlsxwriter` | Fast, pixel-perfect formatting, native charts, conditional formatting, print setup. |
| **Update / Edit Existing Excel File** | `openpyxl` | Loads existing workbooks, modifies cells, preserves existing macros/sheets. |
| **Heavy Financial Calculations & Data Cleaning** | `pandas` | High-performance vector math, time-series operations, exports cleanly to Excel. |

---

## 📐 Enterprise Excel Standards (Wall Street / Big 4)

### 1. Standard Color Conventions
* **Hardcoded Inputs / Assumptions**: Blue text (`#0000FF`)
* **Calculations & Formulas**: Black text (`#000000`)
* **Inter-Sheet / External Links**: Green text (`#008000`)
* **Table Headers**: Dark Oxford Navy fill (`#0F2C59`), Bold White text (`#FFFFFF`)

### 2. Accounting Number Formats
Never leave cells as unformatted `General`:
* **Currency (USD)**: `"$#,##0;($#,##0);\"-\""`
* **Currency (VND)**: `"#,##0 \"₫\";(#,##0 \"₫\");\"-\""`
* **Percentages**: `"0.0%"` or `"0.00%"`
* **Integers / Counts**: `"#,##0"`

### 3. Total Rows Standard
* Top border: Single thin line.
* Bottom border: Classic Accounting Double Underline (`bottom: 6`).

---

## 💻 Code Recipes

### Recipe 1: Creating an Executive Dashboard with `xlsxwriter`

```python
import xlsxwriter

wb = xlsxwriter.Workbook('Financial_Report.xlsx')
ws = wb.add_worksheet('P&L Summary')

# Formats
fmt_hdr = wb.add_format({'bold': True, 'bg_color': '#0F2C59', 'font_color': '#FFFFFF', 'font_name': 'Segoe UI', 'align': 'center'})
fmt_curr = wb.add_format({'num_format': '$#,##0', 'font_name': 'Segoe UI', 'align': 'right'})
fmt_total = wb.add_format({'bold': True, 'num_format': '$#,##0', 'top': 1, 'bottom': 6, 'font_name': 'Segoe UI', 'align': 'right'})

# Write Headers
ws.write('B2', 'Hạng Mục', fmt_hdr)
ws.write('C2', 'Doanh Thu 2026', fmt_hdr)

# Write Data & Formulas
ws.write('B3', 'Dịch vụ AI', wb.add_format({'font_name': 'Segoe UI'}))
ws.write('C3', 150000, fmt_curr)
ws.write('B4', 'Bản quyền Phần mềm', wb.add_format({'font_name': 'Segoe UI'}))
ws.write('C4', 85000, fmt_curr)

# Total Row
ws.write('B5', 'TỔNG CỘNG', wb.add_format({'bold': True, 'top': 1, 'bottom': 6, 'font_name': 'Segoe UI'}))
ws.write_formula('C5', '=SUM(C3:C4)', fmt_total)

# Set Column Widths & Freeze Panes
ws.set_column('B:B', 30)
ws.set_column('C:C', 20)
ws.freeze_panes(2, 0) # Freeze header row

wb.close()
```

---

## 🔍 Best Practices Checklist
1. **Always Freeze Panes** on the row immediately following table headers.
2. **Auto-fit Column Widths** with +3-4 character padding to prevent `###` truncation errors.
3. **Use UPPERCASE Formulas**: `=SUM()`, `=AVERAGE()`, `=XLOOKUP()`, `=IF()`.
4. **Always set Gridlines to Visible**: `ws.hide_gridlines(0)`.
