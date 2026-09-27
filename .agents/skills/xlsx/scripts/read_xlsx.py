"""
Enterprise Excel Inspector & Data Extractor.
Inspects sheets, named ranges, tables, and formulas from .xlsx files.
"""

import sys
import os
import argparse
import openpyxl
import pandas as pd
from tabulate import tabulate

if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def inspect_excel(file_path: str, max_rows: int = 20) -> str:
    if not os.path.exists(file_path):
        return f"Error: File '{file_path}' does not exist."
    
    wb = openpyxl.load_workbook(file_path, data_only=False)
    output = []
    output.append(f"# Excel Inspection Report: {os.path.basename(file_path)}\n")
    output.append(f"- **Total Sheets**: {len(wb.sheetnames)}")
    output.append(f"- **Sheet Names**: {', '.join(wb.sheetnames)}\n")

    for sheet_name in wb.sheetnames:
        output.append(f"## Sheet: `{sheet_name}`\n")
        ws = wb[sheet_name]
        
        # Check dimensions
        max_r = ws.max_row
        max_c = ws.max_column
        output.append(f"- **Dimensions**: {max_r} rows x {max_c} columns")
        
        # Read with pandas for clean tabular view
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=max_rows)
            df = df.dropna(how='all')
            if not df.empty:
                table_str = tabulate(df, headers='keys', tablefmt='github', showindex=False)
                output.append("\n" + table_str + "\n")
            else:
                output.append("*(Sheet is empty or contains non-tabular layout)*\n")
        except Exception as e:
            output.append(f"*(Could not parse as table: {e})*\n")
            
    return "\n".join(output)

def main():
    parser = argparse.ArgumentParser(description="Inspect and read Excel (.xlsx) files")
    parser.add_argument("file", help="Path to the .xlsx file")
    parser.add_argument("-n", "--rows", type=int, default=20, help="Max rows to preview per sheet")
    args = parser.parse_args()

    print(inspect_excel(args.file, max_rows=args.rows))

if __name__ == "__main__":
    main()
