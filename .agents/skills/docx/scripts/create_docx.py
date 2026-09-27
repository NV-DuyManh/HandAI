"""
Enterprise DOCX Document Generator (World-Class Standard).
Creates publication-quality corporate reports, proposals, capstone documents, and whitepapers.
Implements Big 4 / Strategy Consulting design tokens, executive cover pages, KPI cards, and styled tables.
"""

import sys
import os
import json
import argparse
from typing import List, Dict, Any, Optional, Tuple

import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

if sys.platform == "win32" and sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ---------------------------------------------------------
# Design Tokens & Corporate Palettes
# ---------------------------------------------------------
PALETTES = {
    "corporate_navy": {
        "primary": RGBColor(15, 44, 89),       # #0F2C59
        "secondary": RGBColor(0, 91, 148),     # #005B94
        "accent": RGBColor(37, 99, 235),       # #2563EB
        "text": RGBColor(31, 41, 55),          # #1F2937
        "muted": RGBColor(107, 114, 128),      # #6B7280
        "primary_hex": "0F2C59",
        "secondary_hex": "005B94",
        "accent_hex": "2563EB",
        "bg_light_hex": "F8FAFC",
        "zebra_hex": "F1F5F9"
    },
    "modern_slate": {
        "primary": RGBColor(15, 23, 42),       # #0F172A
        "secondary": RGBColor(51, 65, 85),     # #334155
        "accent": RGBColor(14, 165, 233),      # #0EA5E9
        "text": RGBColor(30, 41, 59),          # #1E293B
        "muted": RGBColor(100, 116, 139),     # #64748B
        "primary_hex": "0F172A",
        "secondary_hex": "334155",
        "accent_hex": "0EA5E9",
        "bg_light_hex": "F8FAFC",
        "zebra_hex": "F1F5F9"
    },
    "academic_formal": {
        "primary": RGBColor(26, 54, 93),       # #1A365D
        "secondary": RGBColor(43, 108, 176),   # #2B6CB0
        "accent": RGBColor(197, 48, 48),       # #C53030
        "text": RGBColor(17, 24, 39),          # #111827
        "muted": RGBColor(75, 85, 99),         # #4B5563
        "primary_hex": "1A365D",
        "secondary_hex": "2B6CB0",
        "accent_hex": "C53030",
        "bg_light_hex": "F9FAFB",
        "zebra_hex": "F3F4F6"
    }
}

def set_cell_background(cell, fill_hex: str):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    """Set internal cell padding (in twips: 20 twips = 1 pt)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_cell_borders(cell, top="none", bottom="none", left="none", right="none", 
                     color="CCCCCC", sz="4"):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="{top}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{left}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{bottom}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{right}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

def add_page_number_to_section(section):
    """Adds Page Number to footer."""
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(6)
    run = p.add_run("Trang ")
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(156, 163, 175)
    
    fldSimple = OxmlElement('w:fldSimple')
    fldSimple.set(qn('w:instr'), 'PAGE')
    p._p.append(fldSimple)

class EnterpriseDocxBuilder:
    def __init__(self, font_name: str = "Segoe UI", palette_name: str = "corporate_navy"):
        self.doc = Document()
        self.font_name = font_name
        self.palette = PALETTES.get(palette_name, PALETTES["corporate_navy"])
        self._init_document_settings()

    def _init_document_settings(self):
        # Set A4 margins (1 inch standard)
        for section in self.doc.sections:
            section.page_width = Inches(8.27)
            section.page_height = Inches(11.69)
            section.top_margin = Inches(1.0)
            section.bottom_margin = Inches(1.0)
            section.left_margin = Inches(1.0)
            section.right_margin = Inches(1.0)
            add_page_number_to_section(section)

        # Base Normal Style
        style_normal = self.doc.styles['Normal']
        font = style_normal.font
        font.name = self.font_name
        font.size = Pt(11)
        font.color.rgb = self.palette["text"]

    def add_cover_page(self, title: str, subtitle: str, organization: str, 
                       author: str, date_str: str, version: str = "v1.0"):
        """Generates an executive-level cover page."""
        p_org = self.doc.add_paragraph()
        p_org.paragraph_format.space_before = Pt(36)
        p_org.paragraph_format.space_after = Pt(40)
        r_org = p_org.add_run(organization.upper())
        r_org.bold = True
        r_org.font.size = Pt(11)
        r_org.font.color.rgb = self.palette["secondary"]

        # Main Title Box
        p_title = self.doc.add_paragraph()
        p_title.paragraph_format.space_before = Pt(20)
        p_title.paragraph_format.space_after = Pt(12)
        p_title.paragraph_format.line_spacing = 1.15
        r_title = p_title.add_run(title)
        r_title.bold = True
        r_title.font.size = Pt(24)
        r_title.font.color.rgb = self.palette["primary"]

        # Subtitle
        if subtitle:
            p_sub = self.doc.add_paragraph()
            p_sub.paragraph_format.space_before = Pt(0)
            p_sub.paragraph_format.space_after = Pt(36)
            r_sub = p_sub.add_run(subtitle)
            r_sub.font.size = Pt(13)
            r_sub.font.color.rgb = self.palette["muted"]

        # Decorative Divider Line
        p_div = self.doc.add_paragraph()
        p_div.paragraph_format.space_before = Pt(0)
        p_div.paragraph_format.space_after = Pt(60)
        r_div = p_div.add_run("―" * 28)
        r_div.font.size = Pt(12)
        r_div.font.color.rgb = self.palette["accent"]

        # Metadata Block (Author, Date, Version)
        meta_table = self.doc.add_table(rows=3, cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.LEFT
        
        meta_rows = [
            ("Tác giả / Nhóm thực hiện:", author),
            ("Ngày phát hành:", date_str),
            ("Phiên bản tài liệu:", version)
        ]
        
        for idx, (label, val) in enumerate(meta_rows):
            cell_lbl = meta_table.cell(idx, 0)
            cell_val = meta_table.cell(idx, 1)
            cell_lbl.width = Inches(2.2)
            cell_val.width = Inches(4.0)
            
            p_l = cell_lbl.paragraphs[0]
            p_l.paragraph_format.space_after = Pt(4)
            r_l = p_l.add_run(label)
            r_l.bold = True
            r_l.font.size = Pt(10)
            r_l.font.color.rgb = self.palette["muted"]
            
            p_v = cell_val.paragraphs[0]
            p_v.paragraph_format.space_after = Pt(4)
            r_v = p_v.add_run(val)
            r_v.font.size = Pt(10.5)
            r_v.font.color.rgb = self.palette["text"]

        self.doc.add_page_break()

    def add_executive_summary(self, summary_text: str, title: str = "TÓM TẮT DỰ ÁN (EXECUTIVE SUMMARY)"):
        """Adds a highlighted Executive Summary callout."""
        tbl = self.doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.27)
        
        set_cell_background(cell, self.palette["bg_light_hex"])
        set_cell_margins(cell, top=180, bottom=180, left=220, right=200)
        set_cell_borders(cell, left="single", color=self.palette["primary_hex"], sz="36")
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(6)
        r_head = p.add_run(f"📋 {title}\n")
        r_head.bold = True
        r_head.font.size = Pt(11)
        r_head.font.color.rgb = self.palette["primary"]
        
        r_body = p.add_run(summary_text)
        r_body.font.size = Pt(10.5)
        r_body.font.color.rgb = self.palette["text"]
        
        p_space = self.doc.add_paragraph()
        p_space.paragraph_format.space_after = Pt(8)

    def add_heading_1(self, text: str):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(15)
        run.font.color.rgb = self.palette["primary"]
        return p

    def add_heading_2(self, text: str):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(13)
        run.font.color.rgb = self.palette["secondary"]
        return p

    def add_heading_3(self, text: str):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(11.5)
        run.font.color.rgb = self.palette["text"]
        return p

    def add_paragraph(self, text: str, bold_prefix: Optional[str] = None):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.18
        if bold_prefix:
            r_pre = p.add_run(bold_prefix + " ")
            r_pre.bold = True
            r_pre.font.color.rgb = self.palette["primary"]
        run = p.add_run(text)
        run.font.color.rgb = self.palette["text"]
        return p

    def add_bullet(self, text: str, bold_prefix: Optional[str] = None):
        p = self.doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix + " ")
            r_pre.bold = True
            r_pre.font.color.rgb = self.palette["primary"]
        p.add_run(text)
        return p

    def add_kpi_grid(self, kpi_list: List[Dict[str, str]]):
        """
        Renders a McKinsey-style KPI metrics dashboard box (e.g. 3 cards side by side).
        kpi_list: [{'value': '99.8%', 'label': 'Độ chính xác AI', 'sub': '+4.2% so với baseline'}]
        """
        cols = len(kpi_list)
        table = self.doc.add_table(rows=1, cols=cols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        
        col_w = Inches(6.27 / cols)
        for idx, item in enumerate(kpi_list):
            cell = table.cell(0, idx)
            cell.width = col_w
            set_cell_background(cell, self.palette["bg_light_hex"])
            set_cell_margins(cell, top=140, bottom=140, left=140, right=140)
            set_cell_borders(cell, top="single", bottom="single", left="single", right="single",
                             color="E2E8F0", sz="6")
            
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(2)
            
            # Big bold number
            r_val = p.add_run(item.get("value", "") + "\n")
            r_val.bold = True
            r_val.font.size = Pt(18)
            r_val.font.color.rgb = self.palette["primary"]
            
            # Label
            r_lbl = p.add_run(item.get("label", "") + "\n")
            r_lbl.bold = True
            r_lbl.font.size = Pt(9.5)
            r_lbl.font.color.rgb = self.palette["text"]
            
            # Subtext
            if "sub" in item:
                r_sub = p.add_run(item.get("sub", ""))
                r_sub.font.size = Pt(8.5)
                r_sub.font.color.rgb = self.palette["muted"]

        self.doc.add_paragraph().paragraph_format.space_after = Pt(8)

    def add_styled_table(self, headers: List[str], rows: List[List[str]], col_widths: Optional[List[float]] = None):
        """
        Creates a high-end corporate table with custom headers, zebra rows, and proper padding.
        """
        table = self.doc.add_table(rows=len(rows) + 1, cols=len(headers))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        # Header formatting
        hdr_cells = table.rows[0].cells
        for idx, header_text in enumerate(headers):
            cell = hdr_cells[idx]
            cell.text = header_text
            set_cell_background(cell, self.palette["primary_hex"])
            set_cell_margins(cell, top=140, bottom=140, left=160, right=160)
            set_cell_borders(cell, top="single", bottom="single", color=self.palette["primary_hex"], sz="12")
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(0)
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(10)
                r.font.color.rgb = RGBColor(255, 255, 255)

        # Body rows formatting
        for r_idx, row_data in enumerate(rows):
            row_cells = table.rows[r_idx + 1].cells
            bg_color = self.palette["zebra_hex"] if r_idx % 2 == 1 else "FFFFFF"
            for c_idx, cell_value in enumerate(row_data):
                cell = row_cells[c_idx]
                cell.text = str(cell_value)
                set_cell_background(cell, bg_color)
                set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
                set_cell_borders(cell, bottom="single", color="E5E7EB", sz="4")
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                
                # Auto align numbers right, others left
                val_str = str(cell_value).strip()
                if val_str.replace('.', '', 1).replace(',', '', 1).replace('%', '').replace('$', '').replace('₫', '').isdigit():
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    
                for r in p.runs:
                    r.font.size = Pt(9.5)
                    r.font.color.rgb = self.palette["text"]

        # Column widths
        if col_widths:
            for row in table.rows:
                for idx, width in enumerate(col_widths):
                    if idx < len(row.cells):
                        row.cells[idx].width = Inches(width)

        self.doc.add_paragraph().paragraph_format.space_after = Pt(8)
        return table

    def add_callout(self, text: str, title: Optional[str] = None, variant: str = "info"):
        """Callout alert box (info, warning, success, tip)."""
        color_map = {
            "info": self.palette["accent_hex"],
            "warning": "D97706",
            "success": "059669",
            "tip": self.palette["secondary_hex"]
        }
        border_hex = color_map.get(variant, self.palette["accent_hex"])
        
        tbl = self.doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.27)
        set_cell_background(cell, self.palette["bg_light_hex"])
        set_cell_margins(cell, top=140, bottom=140, left=180, right=160)
        set_cell_borders(cell, left="single", color=border_hex, sz="36")
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        if title:
            icons = {"info": "📌", "warning": "⚠️", "success": "✅", "tip": "💡"}
            icon = icons.get(variant, "📌")
            run_title = p.add_run(f"{icon} {title}\n")
            run_title.bold = True
            run_title.font.size = Pt(10.5)
            run_title.font.color.rgb = self.palette["primary"]
        
        run_text = p.add_run(text)
        run_text.font.size = Pt(10)
        run_text.font.color.rgb = self.palette["text"]
        self.doc.add_paragraph().paragraph_format.space_after = Pt(6)

    def save(self, output_path: str):
        self.doc.save(output_path)
        print(f"Enterprise document created successfully at: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Enterprise DOCX Document Generator")
    parser.add_argument("-o", "--output", required=True, help="Output .docx file path")
    parser.add_argument("-t", "--title", required=True, help="Document title")
    parser.add_argument("-s", "--subtitle", help="Document subtitle")
    parser.add_argument("--org", default="Học Viện / Doanh Nghiệp", help="Organization name")
    parser.add_argument("--author", default="Tác giả", help="Author / Team")
    parser.add_argument("--date", default="2026", help="Date string")
    parser.add_argument("--palette", default="corporate_navy", choices=["corporate_navy", "modern_slate", "academic_formal"])
    parser.add_argument("--json-content", help="Path to JSON or JSON string defining document structure")
    args = parser.parse_args()

    builder = EnterpriseDocxBuilder(palette_name=args.palette)
    builder.add_cover_page(
        title=args.title,
        subtitle=args.subtitle or "",
        organization=args.org,
        author=args.author,
        date_str=args.date
    )
    
    if args.json_content:
        content = args.json_content.strip()
        if os.path.exists(content):
            with open(content, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            try:
                data = json.loads(content)
            except Exception:
                import ast
                data = ast.literal_eval(content)
                
        if "summary" in data:
            builder.add_executive_summary(data["summary"])
        if "kpi_grid" in data:
            builder.add_kpi_grid(data["kpi_grid"])
            
        for item in data.get("sections", []):
            if "h1" in item:
                builder.add_heading_1(item["h1"])
            elif "h2" in item:
                builder.add_heading_2(item["h2"])
            elif "h3" in item:
                builder.add_heading_3(item["h3"])
            elif "p" in item:
                builder.add_paragraph(item["p"], item.get("bold_prefix"))
            elif "bullet" in item:
                builder.add_bullet(item["bullet"], item.get("bold_prefix"))
            elif "callout" in item:
                builder.add_callout(item["callout"], item.get("title"), item.get("variant", "info"))
            elif "kpi_grid" in item:
                builder.add_kpi_grid(item["kpi_grid"])
            elif "table" in item:
                tbl = item["table"]
                builder.add_styled_table(tbl["headers"], tbl["rows"], tbl.get("col_widths"))

    builder.save(args.output)

if __name__ == "__main__":
    main()
