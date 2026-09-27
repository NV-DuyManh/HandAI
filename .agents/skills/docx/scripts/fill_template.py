"""
Word Document Template Filler using docxtpl (Jinja2 syntax).
Populates {{ placeholder }}, loops {% for item in list %}, and conditions.
"""

import sys
import os
import json
import argparse
from docxtpl import DocxTemplate

def render_template(template_path: str, context: dict, output_path: str):
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found: {template_path}")
    
    doc = DocxTemplate(template_path)
    doc.render(context)
    doc.save(output_path)
    print(f"Successfully rendered template to: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Fill Word (.docx) templates using Jinja2 context")
    parser.add_argument("-t", "--template", required=True, help="Path to input template .docx")
    parser.add_argument("-c", "--context", required=True, help="JSON file or JSON string containing variables")
    parser.add_argument("-o", "--output", required=True, help="Path to output .docx")
    args = parser.parse_args()

    if os.path.exists(args.context):
        with open(args.context, "r", encoding="utf-8") as f:
            ctx = json.load(f)
    else:
        ctx = json.loads(args.context)

    render_template(args.template, ctx, args.output)

if __name__ == "__main__":
    main()
