---
name: docx
description: Inspect, extract, create, edit, format, and fill templates in Microsoft Word (.docx) documents. Use whenever working with .docx files, generating Word reports, formatting proposals/theses, reading Word contents, or converting markdown data to styled docx.
---

# Microsoft Word (.docx) Mastery Skill

This skill provides comprehensive capabilities to read, inspect, create, edit, and template Microsoft Word (`.docx`) documents with professional typography and design standards.

---

## 🛠️ Environment & Helper Scripts

The skill comes with pre-built Python scripts located in `scripts/`:

| Script | Purpose | Example Command |
| :--- | :--- | :--- |
| **`read_docx.py`** | Inspect & extract text, headings, tables, metadata to clean Markdown. | `python .agents/skills/docx/scripts/read_docx.py "document.docx"` |
| **`create_docx.py`** | Generate beautifully styled documents with headers, tables, callouts. | `python .agents/skills/docx/scripts/create_docx.py -o "out.docx" -t "Title" --json-content content.json` |
| **`edit_docx.py`** | Safe search & replace across paragraphs/tables while preserving formatting. | `python .agents/skills/docx/scripts/edit_docx.py -i "in.docx" -o "out.docx" --replace '{"{{name}}": "John"}'` |
| **`fill_template.py`** | Fill Jinja2 templates (`{{ var }}`, `{% for %}`) using `docxtpl`. | `python .agents/skills/docx/scripts/fill_template.py -t "template.docx" -c context.json -o "out.docx"` |

> **Python Interpreter**: Use the environment's python (`python` or `"C:\Users\My PC\AppData\Local\Programs\Python\Python313\python.exe"`).

---

## 📖 Workflows

### 1. Inspecting & Reading Word Documents
To examine an existing document's structure, text, and tables:
```bash
python .agents/skills/docx/scripts/read_docx.py "path/to/document.docx" -o "summary.md"
```

### 2. Creating New Styled Documents Programmatically

Use `python-docx` directly with standard styling principles:

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

doc = Document()

# 1. Page Margins (Standard 1 inch)
for section in doc.sections:
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)

# 2. Font & Colors (Navy & Slate Charcoal theme)
COLOR_PRIMARY = RGBColor(30, 58, 138)   # #1E3A8A
COLOR_TEXT = RGBColor(31, 41, 55)       # #1F2937

# 3. Add Document Title
p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r_title = p_title.add_run("BÁO CÁO ĐỀ TÀI TỐT NGHIỆP")
r_title.bold = True
r_title.font.size = Pt(20)
r_title.font.color.rgb = COLOR_PRIMARY

# 4. Headings
def add_heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(14 if level == 1 else 12)
    run.font.color.rgb = COLOR_PRIMARY
    return p

# 5. Save Document
doc.save("output.docx")
```

---

### 3. Styled Tables with Headers & Alternating Row Colors

To render polished tables in `.docx`:

```python
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def add_styled_table(doc, headers, data_rows):
    table = doc.add_table(rows=len(data_rows) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Header styling
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.text = h
        set_cell_background(cell, "1E3A8A") # Dark Navy
        p = cell.paragraphs[0]
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(255, 255, 255)
            r.font.size = Pt(10)
            
    # Body rows with alternating striping
    for r_idx, row in enumerate(data_rows):
        bg = "F3F4F6" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.text = str(val)
            set_cell_background(cell, bg)
```

---

### 4. Filling Jinja2 Templates (`docxtpl`)

When given a `.docx` template with placeholders (e.g. `{{ project_title }}`, `{{ student_name }}`):

```python
from docxtpl import DocxTemplate

doc = DocxTemplate("template.docx")
context = {
    'project_title': 'MathVision Kids: Hệ Thống AI Hỗ Trợ Học Toán',
    'team_members': [
        {'name': 'Nguyễn Văn A', 'role': 'Trưởng nhóm / Backend'},
        {'name': 'Trần Thị B', 'role': 'AI / Computer Vision'}
    ]
}
doc.render(context)
doc.save("MathVision_Kids_Filled.docx")
```

---

### 5. Safe Text Replacement & Editing Existing Documents

To replace placeholders or text in an existing `.docx` without breaking existing formatting:
```bash
python .agents/skills/docx/scripts/edit_docx.py \
  -i "input.docx" \
  -o "output.docx" \
  --replace '{"[Tên Đề Tài]": "MathVision Kids", "[Giảng Viên]": "TS. Nguyễn Văn X"}'
```

---

## 🎨 Best Practices for Word Documents

1. **Hierarchy & Spacing**:
   - Title: `18-22pt`, Bold, Centered, `12pt` space before, `6pt` space after.
   - Heading 1: `14-16pt`, Bold, Primary accent color (Navy/Blue), `14pt` before, `4pt` after.
   - Heading 2: `12-13pt`, Bold, Secondary color (Teal/Slate), `10pt` before, `3pt` after.
   - Body: `10.5-11.5pt`, 1.15 line spacing, `4-6pt` space after paragraphs.
2. **Typography**:
   - Modern clean: Segoe UI, Aptos, Arial, Calibri, or Times New Roman (academic standard).
3. **Avoid Broken Runs**:
   - Do not replace text by blind string substitution on raw XML unless using `edit_docx.py` or `docxtpl` to avoid corrupting Word document archives.
