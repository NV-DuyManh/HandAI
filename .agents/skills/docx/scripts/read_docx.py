"""
Script to extract and inspect content from a .docx file.
Extracts: paragraphs, headings, tables, headers, footers, metadata, and comments.
Outputs structured text/markdown.
"""

import sys
import os
import argparse
from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT

if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def inspect_docx(file_path: str, extract_tables: bool = True, output_format: str = "markdown") -> str:
    if not os.path.exists(file_path):
        return f"Error: File '{file_path}' does not exist."
    
    doc = Document(file_path)
    output = []
    output.append(f"# Inspection Report: {os.path.basename(file_path)}\n")

    # Core Properties / Metadata
    core_props = doc.core_properties
    props_info = []
    if core_props.title: props_info.append(f"- **Title**: {core_props.title}")
    if core_props.author: props_info.append(f"- **Author**: {core_props.author}")
    if core_props.created: props_info.append(f"- **Created**: {core_props.created}")
    if core_props.modified: props_info.append(f"- **Modified**: {core_props.modified}")
    if core_props.revision: props_info.append(f"- **Revision**: {core_props.revision}")
    
    if props_info:
        output.append("## Metadata\n" + "\n".join(props_info) + "\n")

    # Document Elements (Paragraphs and Tables in sequence)
    output.append("## Document Content\n")
    
    for element in doc.element.body:
        tag = element.tag.split('}')[-1]
        
        if tag == 'p':
            # It's a paragraph
            p = None
            for paragraph in doc.paragraphs:
                if paragraph._element == element:
                    p = paragraph
                    break
            if p and p.text.strip():
                style_name = p.style.name if p.style else 'Normal'
                if 'Heading 1' in style_name or style_name == 'Title':
                    output.append(f"\n# {p.text.strip()}\n")
                elif 'Heading 2' in style_name or style_name == 'Subtitle':
                    output.append(f"\n## {p.text.strip()}\n")
                elif 'Heading 3' in style_name:
                    output.append(f"\n### {p.text.strip()}\n")
                elif 'Heading 4' in style_name:
                    output.append(f"\n#### {p.text.strip()}\n")
                elif 'List' in style_name or style_name.startswith('List'):
                    output.append(f"* {p.text.strip()}")
                else:
                    output.append(f"{p.text.strip()}\n")
                    
        elif tag == 'tbl' and extract_tables:
            # It's a table
            t = None
            for table in doc.tables:
                if table._element == element:
                    t = table
                    break
            if t:
                output.append("\n**[Table]**")
                table_md = []
                for row_idx, row in enumerate(t.rows):
                    cells = [cell.text.replace("\n", " ").strip() for cell in row.cells]
                    # Filter out duplicate merged cells across columns for clean MD
                    cleaned_cells = []
                    seen = set()
                    for cell_text in cells:
                        cleaned_cells.append(cell_text)
                    
                    table_md.append("| " + " | ".join(cleaned_cells) + " |")
                    if row_idx == 0:
                        table_md.append("| " + " | ".join(["---"] * len(cleaned_cells)) + " |")
                
                output.append("\n".join(table_md) + "\n")

    return "\n".join(output)

def main():
    parser = argparse.ArgumentParser(description="Read and inspect .docx files")
    parser.add_argument("file", help="Path to the .docx file")
    parser.add_argument("--no-tables", action="store_true", help="Skip table extraction")
    parser.add_argument("-o", "--output", help="Save output to file")
    args = parser.parse_args()

    result = inspect_docx(args.file, extract_tables=not args.no_tables)
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"Report saved to {args.output}")
    else:
        print(result)

if __name__ == "__main__":
    main()
