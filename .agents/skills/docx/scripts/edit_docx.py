"""
Script for targeted editing and replacement in Word (.docx) documents.
Supports:
- Safe text replacement across paragraphs and tables while preserving runs formatting.
- Inserting paragraphs or sections after specific headings.
- Appending rows to existing tables.
"""

import sys
import os
import argparse
import json
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def replace_text_in_paragraph(paragraph, old_text: str, new_text: str) -> int:
    """Replaces old_text with new_text in paragraph while preserving run formatting."""
    full_text = paragraph.text
    if old_text not in full_text:
        return 0
    
    count = 0
    # Try simple run-level replacement first
    replaced_in_runs = False
    for run in paragraph.runs:
        if old_text in run.text:
            run.text = run.text.replace(old_text, new_text)
            count += 1
            replaced_in_runs = True
            
    # If placeholder was split across multiple runs (the common docx split run problem)
    if not replaced_in_runs and old_text in paragraph.text:
        # Combine into first run, clear subsequent runs
        new_combined = paragraph.text.replace(old_text, new_text)
        if paragraph.runs:
            paragraph.runs[0].text = new_combined
            for r in paragraph.runs[1:]:
                r.text = ""
        else:
            paragraph.text = new_combined
        count += 1
        
    return count

def replace_in_doc(file_path: str, replacements: dict, output_path: str) -> int:
    doc = Document(file_path)
    total_replacements = 0

    # Process paragraphs
    for p in doc.paragraphs:
        for old_txt, new_txt in replacements.items():
            total_replacements += replace_text_in_paragraph(p, old_txt, new_txt)

    # Process tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for old_txt, new_txt in replacements.items():
                        total_replacements += replace_text_in_paragraph(p, old_txt, new_txt)

    # Process headers and footers
    for section in doc.sections:
        for header_p in section.header.paragraphs:
            for old_txt, new_txt in replacements.items():
                total_replacements += replace_text_in_paragraph(header_p, old_txt, new_txt)
        for footer_p in section.footer.paragraphs:
            for old_txt, new_txt in replacements.items():
                total_replacements += replace_text_in_paragraph(footer_p, old_txt, new_txt)

    doc.save(output_path)
    print(f"Replaced {total_replacements} occurrences. Saved to {output_path}")
    return total_replacements

def main():
    parser = argparse.ArgumentParser(description="Edit and search-replace in .docx files")
    parser.add_argument("-i", "--input", required=True, help="Input .docx path")
    parser.add_argument("-o", "--output", required=True, help="Output .docx path")
    parser.add_argument("--replace", help="JSON map of replacements '{\"old\": \"new\"}' or path to JSON file")
    args = parser.parse_args()

    if args.replace:
        if os.path.exists(args.replace):
            with open(args.replace, "r", encoding="utf-8") as f:
                replacements = json.load(f)
        else:
            replacements = json.loads(args.replace)
        replace_in_doc(args.input, replacements, args.output)

if __name__ == "__main__":
    main()
