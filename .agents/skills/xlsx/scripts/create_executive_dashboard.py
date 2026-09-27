"""
Enterprise Excel Dashboard Generator using xlsxwriter.
Creates executive-ready spreadsheets with KPI cards, formatted financial tables, and styled charts.
"""

import sys
import os
import argparse
import json
from typing import Dict, List, Any
import xlsxwriter

if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def build_executive_dashboard(output_path: str, data: Dict[str, Any]):
    workbook = xlsxwriter.Workbook(output_path)
    
    # -------------------------------------------------------------
    # Format Definitions (Corporate Navy Theme)
    # -------------------------------------------------------------
    fmt_title = workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 18,
        'font_color': '#0F2C59',
        'valign': 'vcenter'
    })
    
    fmt_subtitle = workbook.add_format({
        'italic': True,
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#6B7280',
        'valign': 'vcenter'
    })
    
    fmt_kpi_val = workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 20,
        'font_color': '#0F2C59',
        'align': 'center',
        'valign': 'vcenter',
        'bg_color': '#F8FAFC',
        'border': 1,
        'border_color': '#CBD5E1'
    })
    
    fmt_kpi_lbl = workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 9,
        'font_color': '#475569',
        'align': 'center',
        'valign': 'vcenter',
        'bg_color': '#F1F5F9',
        'left': 1, 'right': 1, 'bottom': 1,
        'border_color': '#CBD5E1'
    })
    
    fmt_header = workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#FFFFFF',
        'bg_color': '#0F2C59',
        'align': 'center',
        'valign': 'vcenter',
        'border': 1,
        'border_color': '#0F2C59'
    })
    
    fmt_cell_text = workbook.add_format({
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#1E293B',
        'valign': 'vcenter',
        'border': 1,
        'border_color': '#E2E8F0'
    })
    
    fmt_cell_zebra = workbook.add_format({
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#1E293B',
        'bg_color': '#F8FAFC',
        'valign': 'vcenter',
        'border': 1,
        'border_color': '#E2E8F0'
    })
    
    fmt_cell_currency = workbook.add_format({
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#1E293B',
        'num_format': '$#,##0;($#,##0);"-"',
        'align': 'right',
        'valign': 'vcenter',
        'border': 1,
        'border_color': '#E2E8F0'
    })
    
    fmt_cell_currency_zebra = workbook.add_format({
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#1E293B',
        'bg_color': '#F8FAFC',
        'num_format': '$#,##0;($#,##0);"-"',
        'align': 'right',
        'valign': 'vcenter',
        'border': 1,
        'border_color': '#E2E8F0'
    })
    
    fmt_total_label = workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#0F2C59',
        'top': 1,
        'bottom': 6, # Double bottom border
        'border_color': '#000000',
        'valign': 'vcenter'
    })
    
    fmt_total_currency = workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#0F2C59',
        'num_format': '$#,##0;($#,##0);"-"',
        'align': 'right',
        'top': 1,
        'bottom': 6,
        'border_color': '#000000',
        'valign': 'vcenter'
    })

    # -------------------------------------------------------------
    # Sheet 1: Executive Dashboard
    # -------------------------------------------------------------
    ws = workbook.add_worksheet("Dashboard")
    ws.set_tab_color('#0F2C59')
    ws.hide_gridlines(0) # Keep subtle gridlines
    
    # Title Block
    title = data.get("title", "Executive Financial & Performance Dashboard")
    subtitle = data.get("subtitle", "Báo cáo tiến độ & Ngân sách dự án Capstone")
    ws.write('B2', title, fmt_title)
    ws.write('B3', subtitle, fmt_subtitle)
    
    # KPI Stat Cards Block (Row 5 - 7)
    kpi_cards = data.get("kpis", [
        {"label": "TỔNG NGÂN SÁCH", "value": "$125,000"},
        {"label": "ĐÃ GIẢI NGÂN", "value": "$84,500"},
        {"label": "TIẾN ĐỘ HOÀN THÀNH", "value": "78.5%"},
        {"label": "ĐỘ CHÍNH XÁC AI", "value": "99.2%"}
    ])
    
    start_col = 1 # Column B
    for idx, kpi in enumerate(kpi_cards):
        col_letter = chr(ord('B') + idx * 2)
        next_col = chr(ord('B') + idx * 2 + 1)
        
        ws.merge_range(f'{col_letter}5:{next_col}6', kpi.get("value", "0"), fmt_kpi_val)
        ws.merge_range(f'{col_letter}7:{next_col}7', kpi.get("label", ""), fmt_kpi_lbl)

    # -------------------------------------------------------------
    # Data Table (Row 9+)
    # -------------------------------------------------------------
    headers = data.get("headers", ["Hạng mục", "Kế hoạch (USD)", "Thực tế (USD)", "Chênh lệch (USD)", "Tỷ lệ %"])
    table_rows = data.get("rows", [
        ["Nghiên cứu & Khảo sát thị trường", 15000, 14200],
        ["Thiết kế Kiến trúc & UI/UX", 20000, 19500],
        ["Phát triển Mô hình AI & Vision", 45000, 42000],
        ["Xây dựng Backend & Cloud AWS", 25000, 26000],
        ["Kiểm thử, QA & Tối ưu hóa", 12000, 11000],
        ["Triển khai & Tài liệu bàn giao", 8000, 6800]
    ])
    
    start_row = 9 # Row 10 in 1-based indexing
    
    # Write Headers
    for c_idx, h in enumerate(headers):
        ws.write(start_row, 1 + c_idx, h, fmt_header)
        
    # Write Rows
    current_row = start_row + 1
    for r_idx, row in enumerate(table_rows):
        is_zebra = (r_idx % 2 == 1)
        txt_fmt = fmt_cell_zebra if is_zebra else fmt_cell_text
        curr_fmt = fmt_cell_currency_zebra if is_zebra else fmt_cell_currency
        
        row_num = current_row + 1 # 1-based index for formula
        category = row[0]
        budget = row[1]
        actual = row[2]
        
        ws.write(current_row, 1, category, txt_fmt)
        ws.write(current_row, 2, budget, curr_fmt)
        ws.write(current_row, 3, actual, curr_fmt)
        
        # Formulas for Variance and %
        ws.write_formula(current_row, 4, f'=C{row_num}-D{row_num}', curr_fmt)
        ws.write_formula(current_row, 5, f'=D{row_num}/C{row_num}', workbook.add_format({
            'font_name': 'Segoe UI',
            'font_size': 10,
            'font_color': '#1E293B',
            'bg_color': '#F8FAFC' if is_zebra else '#FFFFFF',
            'num_format': '0.0%',
            'align': 'right',
            'border': 1,
            'border_color': '#E2E8F0'
        }))
        current_row += 1

    # Write Totals Row
    total_row_num = current_row + 1
    ws.write(current_row, 1, "TỔNG CỘNG", fmt_total_label)
    ws.write_formula(current_row, 2, f'=SUM(C11:C{current_row})', fmt_total_currency)
    ws.write_formula(current_row, 3, f'=SUM(D11:D{current_row})', fmt_total_currency)
    ws.write_formula(current_row, 4, f'=SUM(E11:E{current_row})', fmt_total_currency)
    ws.write_formula(current_row, 5, f'=D{total_row_num}/C{total_row_num}', workbook.add_format({
        'bold': True,
        'font_name': 'Segoe UI',
        'font_size': 10,
        'font_color': '#0F2C59',
        'num_format': '0.0%',
        'align': 'right',
        'top': 1, 'bottom': 6,
        'border_color': '#000000'
    }))

    # -------------------------------------------------------------
    # Native Chart: Budget vs Actual Comparison Column Chart
    # -------------------------------------------------------------
    chart = workbook.add_chart({'type': 'column'})
    chart.add_series({
        'name': '=Dashboard!$C$10',
        'categories': f'=Dashboard!$B$11:$B${current_row}',
        'values': f'=Dashboard!$C$11:$C${current_row}',
        'fill': {'color': '#0F2C59'},
        'border': {'none': True}
    })
    chart.add_series({
        'name': '=Dashboard!$D$10',
        'categories': f'=Dashboard!$B$11:$B${current_row}',
        'values': f'=Dashboard!$D$11:$D${current_row}',
        'fill': {'color': '#2563EB'},
        'border': {'none': True}
    })
    
    chart.set_title({
        'name': 'So Sánh Ngân Sách Dự Kiến vs Thực Tế',
        'name_font': {'name': 'Segoe UI', 'size': 12, 'bold': True, 'color': '#0F2C59'}
    })
    chart.set_legend({'position': 'top'})
    chart.set_x_axis({'name_font': {'name': 'Segoe UI', 'size': 9}})
    chart.set_y_axis({
        'num_format': '$#,##0',
        'major_gridlines': {'visible': True, 'line': {'color': '#E2E8F0', 'dash_type': 'dash'}}
    })
    chart.set_size({'width': 650, 'height': 340})
    
    # Insert Chart below table
    ws.insert_chart(f'B{current_row + 3}', chart)

    # -------------------------------------------------------------
    # Column Auto-Widths & Freeze Panes
    # -------------------------------------------------------------
    ws.set_column('A:A', 3)
    ws.set_column('B:B', 34)
    ws.set_column('C:E', 18)
    ws.set_column('F:F', 14)
    ws.set_column('G:J', 12)
    
    workbook.close()
    print(f"Executive Excel Dashboard created successfully at: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Create Enterprise Excel Dashboard")
    parser.add_argument("-o", "--output", required=True, help="Output .xlsx path")
    parser.add_argument("--json-data", help="JSON string or path to JSON configuration")
    args = parser.parse_args()

    data = {}
    if args.json_data:
        if os.path.exists(args.json_data):
            with open(args.json_data, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(args.json_data)

    build_executive_dashboard(args.output, data)

if __name__ == "__main__":
    main()
