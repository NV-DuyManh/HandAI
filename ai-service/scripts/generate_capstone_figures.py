"""
HandAI - Publication-Quality Scientific Figures
Standard: IEEE Transactions / ACM Conference / Springer / Pattern Recognition Letters
Color Palette:
  - Primary: Deep Navy (#1F3A5F)
  - Secondary: Teal (#00897B)
  - Accent: Orange (#E67E22)
  - Neutral: Grayscale (#1E293B, #334155, #475569, #64748B, #94A3B8, #CBD5E1, #E2E8F0, #F8FAFC, #FFFFFF)
Typography: Arial / DejaVu Sans sans-serif
Resolution: 300 DPI
"""

import os
import textwrap
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Rectangle
import matplotlib.font_manager as fm

# Target output directory
OUTPUT_DIR = r"E:\HandAI\report\figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ------------------------------------------------------------------------------
# Academic Style Configuration
# ------------------------------------------------------------------------------
PRIMARY_NAVY = '#1F3A5F'
SECONDARY_TEAL = '#00897B'
ACCENT_ORANGE = '#E67E22'

TEXT_MAIN = '#1E293B'
TEXT_MUTED = '#475569'
BORDER_COLOR = '#CBD5E1'
GRID_COLOR = '#E2E8F0'
BG_LIGHT = '#F8FAFC'
BG_CARD = '#FFFFFF'

# Font selection
available_fonts = [f.name for f in fm.fontManager.ttflist]
if 'Arial' in available_fonts:
    SANS_FONT = 'Arial'
elif 'Helvetica' in available_fonts:
    SANS_FONT = 'Helvetica'
elif 'Inter' in available_fonts:
    SANS_FONT = 'Inter'
else:
    SANS_FONT = 'DejaVu Sans'

plt.rcParams['font.sans-serif'] = [SANS_FONT, 'DejaVu Sans', 'sans-serif']
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['mathtext.fontset'] = 'dejavusans'
plt.rcParams['axes.edgecolor'] = BORDER_COLOR
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['grid.color'] = GRID_COLOR
plt.rcParams['grid.linestyle'] = '--'
plt.rcParams['grid.alpha'] = 0.7
plt.rcParams['figure.facecolor'] = '#FFFFFF'
plt.rcParams['axes.facecolor'] = '#FFFFFF'


# ==============================================================================
# FIGURE 1: OCR Performance Evolution Across Model Iterations
# ==============================================================================
def plot_fig1():
    versions = ['CRNN v1.0', 'CRNN v1.1', 'CRNN v1.2']
    corpus_sizes = ['15,420 Lines', '34,100 Lines', '59,462 Lines']
    cer_values = [18.40, 14.10, 11.34]
    wer_values = [38.20, 31.50, 26.50]

    x = np.arange(len(versions))
    width = 0.28

    fig, ax = plt.subplots(figsize=(8.8, 5.8), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # Grouped bars
    rects1 = ax.bar(x - width/2, cer_values, width, label='Character Error Rate (CER)',
                    color=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.8)
    rects2 = ax.bar(x + width/2, wer_values, width, label='Word Error Rate (WER)',
                    color=SECONDARY_TEAL, edgecolor=SECONDARY_TEAL, linewidth=0.8)

    # Value labels
    for rect in rects1:
        h = rect.get_height()
        ax.annotate(f'{h:.2f}%',
                    xy=(rect.get_x() + rect.get_width() / 2, h),
                    xytext=(0, 4), textcoords="offset points",
                    ha='center', va='bottom', fontsize=9.5, fontweight='bold', color=PRIMARY_NAVY)

    for rect in rects2:
        h = rect.get_height()
        ax.annotate(f'{h:.2f}%',
                    xy=(rect.get_x() + rect.get_width() / 2, h),
                    xytext=(0, 4), textcoords="offset points",
                    ha='center', va='bottom', fontsize=9.5, fontweight='bold', color=SECONDARY_TEAL)

    # Axis formatting
    ax.set_ylabel('Validation Error Rate (%)', fontsize=11, fontweight='bold', color=TEXT_MAIN)
    ax.set_xticks(x)
    x_tick_labels = [f"{v}\n({c})" for v, c in zip(versions, corpus_sizes)]
    ax.set_xticklabels(x_tick_labels, fontsize=10, fontweight='bold', color=TEXT_MAIN)
    ax.set_ylim(0, 46)
    ax.grid(axis='y', color=GRID_COLOR, linestyle='--', alpha=0.8)
    ax.set_axisbelow(True)

    # Spine styling
    for spine in ['top', 'right']:
        ax.spines[spine].set_visible(False)
    ax.spines['left'].set_color(BORDER_COLOR)
    ax.spines['bottom'].set_color(BORDER_COLOR)

    # Small academic annotation for improvement statistics
    ax.text(0.02, 0.92,
            'Overall Improvement: CER \u221238.4% (18.40% \u2192 11.34%) | WER \u221230.6% (38.20% \u2192 26.50%)',
            transform=ax.transAxes, ha='left', va='center',
            fontsize=8.5, fontstyle='italic', color=TEXT_MUTED)

    # Clear horizontal relationship indicator: Dataset expansion -> Error reduction
    # Placed with ample vertical clearance below tick labels using axes fraction
    ax.annotate(
        '', xy=(0.95, -0.16), xytext=(0.05, -0.16),
        xycoords='axes fraction',
        arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=1.2, mutation_scale=10),
        annotation_clip=False
    )
    ax.text(0.50, -0.21, 'Dataset Expansion (15,420 \u2192 59,462 Lines) \u2192 Systematic Error Reduction',
            transform=ax.transAxes, ha='center', va='top', fontsize=9.2, fontweight='bold',
            color=PRIMARY_NAVY, clip_on=False)

    # Titles
    fig.suptitle('Figure 1: OCR Performance Evolution Across Model Iterations',
                 fontsize=14, fontweight='bold', color=PRIMARY_NAVY, y=0.985)
    fig.text(0.5, 0.935, 'Validation error rate reduction across progressive training corpus expansion stages',
             ha='center', va='top', fontsize=10.5, color=TEXT_MUTED)

    # Legend
    ax.legend(loc='upper right', frameon=True, facecolor='#FFFFFF', edgecolor=BORDER_COLOR,
              fontsize=9.5, framealpha=0.95)

    plt.tight_layout(rect=[0, 0.09, 1, 0.90])
    out_path = os.path.join(OUTPUT_DIR, "fig1_ocr_performance_evolution.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 1 generated:", out_path)


# ==============================================================================
# FIGURE 2: Impact of Linguistic Context Correction Layer
# ==============================================================================
def plot_fig2():
    fig = plt.figure(figsize=(12.4, 5.8), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')

    # GridSpec with 3 columns: Left (Error Rates), Center (Pipeline Indicator), Right (Accuracy)
    gs = fig.add_gridspec(1, 3, width_ratios=[1.0, 0.30, 1.0], wspace=0.26,
                           top=0.83, bottom=0.18, left=0.07, right=0.96)
    ax1 = fig.add_subplot(gs[0])
    ax_pipe = fig.add_subplot(gs[1])
    ax2 = fig.add_subplot(gs[2])

    ax1.set_facecolor('#FFFFFF')
    ax_pipe.set_facecolor('#FFFFFF')
    ax_pipe.axis('off')
    ax_pipe.set_xlim(0, 1)
    ax_pipe.set_ylim(0, 1)
    ax2.set_facecolor('#FFFFFF')

    width = 0.28

    # --- Subplot 1: Error Rates (Lower is better) ---
    err_labels = ['Character Error Rate\n(CER)', 'Word Error Rate\n(WER)']
    err_before = [11.34, 26.50]
    err_after = [8.21, 20.15]
    x1 = np.arange(len(err_labels))

    r1_before = ax1.bar(x1 - width/2, err_before, width, label='Raw OCR Output (CRNN v1.2)',
                        color=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.8)
    r1_after = ax1.bar(x1 + width/2, err_after, width, label='CRNN + Linguistic Correction',
                        color=SECONDARY_TEAL, edgecolor=SECONDARY_TEAL, linewidth=0.8)

    ax1.set_ylabel('Error Rate (%)', fontsize=11, fontweight='bold', color=TEXT_MAIN)
    ax1.set_xticks(x1)
    ax1.set_xticklabels(err_labels, fontsize=9.5, fontweight='bold', color=TEXT_MAIN)
    ax1.set_ylim(0, 36)
    ax1.grid(axis='y', color=GRID_COLOR, linestyle='--', alpha=0.8)
    ax1.set_axisbelow(True)
    ax1.set_title('(a) Error Rate Reduction (Lower is Better)', fontsize=11, fontweight='bold', color=PRIMARY_NAVY, pad=10)

    for spine in ['top', 'right']:
        ax1.spines[spine].set_visible(False)
    ax1.spines['left'].set_color(BORDER_COLOR)
    ax1.spines['bottom'].set_color(BORDER_COLOR)

    for rect in r1_before:
        h = rect.get_height()
        ax1.annotate(f'{h:.2f}%', (rect.get_x() + rect.get_width()/2, h),
                     xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color=PRIMARY_NAVY)

    for rect in r1_after:
        h = rect.get_height()
        ax1.annotate(f'{h:.2f}%', (rect.get_x() + rect.get_width()/2, h),
                     xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color=SECONDARY_TEAL)

    # Scientific deltas
    ax1.text(0, 18.0, "\u0394 = \u22123.13%\n(\u221227.6% rel.)", ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=SECONDARY_TEAL)
    ax1.text(1, 31.0, "\u0394 = \u22126.35%\n(\u221224.0% rel.)", ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=SECONDARY_TEAL)

    # --- Central Pipeline Indicator (Connects Panel a and b logically) ---
    pipe_nodes = [
        ("CRNN v1.2", "Visual Backbone", 0.76, PRIMARY_NAVY),
        ("Linguistic Context\nCorrection", "N-Gram Syntax Filter", 0.46, SECONDARY_TEAL),
        ("Improved Output", "Final Prediction", 0.16, PRIMARY_NAVY)
    ]

    for title, sub, y_pos, col in pipe_nodes:
        box = FancyBboxPatch((0.04, y_pos - 0.08), 0.92, 0.16,
                             boxstyle="square,pad=0.01",
                             facecolor=BG_LIGHT, edgecolor=col, linewidth=1.0)
        ax_pipe.add_patch(box)
        ax_pipe.text(0.5, y_pos + 0.015, title, ha='center', va='center',
                     fontsize=8.2, fontweight='bold', color=col, linespacing=1.15)
        ax_pipe.text(0.5, y_pos - 0.050, sub, ha='center', va='center',
                     fontsize=6.8, fontstyle='italic', color=TEXT_MUTED)

    # Downward connecting arrows inside central pipeline
    ax_pipe.annotate('', xy=(0.5, 0.55), xytext=(0.5, 0.67),
                     arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=1.5, mutation_scale=10))
    ax_pipe.annotate('', xy=(0.5, 0.25), xytext=(0.5, 0.37),
                     arrowprops=dict(arrowstyle="-|>", color=SECONDARY_TEAL, lw=1.5, mutation_scale=10))

    # --- Subplot 2: Accuracy Rates (Higher is better) ---
    acc_labels = ['Character Accuracy\n(100 \u2212 CER)', 'Word Accuracy\n(100 \u2212 WER)']
    acc_before = [88.66, 73.50]
    acc_after = [91.79, 79.85]
    x2 = np.arange(len(acc_labels))

    r2_before = ax2.bar(x2 - width/2, acc_before, width, label='Raw OCR Output (CRNN v1.2)',
                        color=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.8)
    r2_after = ax2.bar(x2 + width/2, acc_after, width, label='CRNN + Linguistic Correction',
                       color=SECONDARY_TEAL, edgecolor=SECONDARY_TEAL, linewidth=0.8)

    ax2.set_ylabel('Accuracy Rate (%)', fontsize=11, fontweight='bold', color=TEXT_MAIN)
    ax2.set_xticks(x2)
    ax2.set_xticklabels(acc_labels, fontsize=9.5, fontweight='bold', color=TEXT_MAIN)
    ax2.set_ylim(65, 100)
    ax2.grid(axis='y', color=GRID_COLOR, linestyle='--', alpha=0.8)
    ax2.set_axisbelow(True)
    ax2.set_title('(b) Accuracy Improvement (Higher is Better)', fontsize=11, fontweight='bold', color=PRIMARY_NAVY, pad=10)

    for spine in ['top', 'right']:
        ax2.spines[spine].set_visible(False)
    ax2.spines['left'].set_color(BORDER_COLOR)
    ax2.spines['bottom'].set_color(BORDER_COLOR)

    for rect in r2_before:
        h = rect.get_height()
        ax2.annotate(f'{h:.2f}%', (rect.get_x() + rect.get_width()/2, h),
                     xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color=PRIMARY_NAVY)

    for rect in r2_after:
        h = rect.get_height()
        ax2.annotate(f'{h:.2f}%', (rect.get_x() + rect.get_width()/2, h),
                     xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color=SECONDARY_TEAL)

    # Scientific deltas for accuracy
    ax2.text(0, 96.0, "\u0394 = +3.13 pp", ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=SECONDARY_TEAL)
    ax2.text(1, 85.0, "\u0394 = +6.35 pp", ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=SECONDARY_TEAL)

    # Shared Legend at bottom center with ample clearance below tick labels
    handles, labels = ax1.get_legend_handles_labels()
    fig.legend(handles, labels, loc='lower center', ncol=2, frameon=True,
               facecolor='#FFFFFF', edgecolor=BORDER_COLOR, fontsize=9.5, bbox_to_anchor=(0.5, 0.04))

    # Master Figure Title & Subtitle
    fig.suptitle('Figure 2: Impact of Linguistic Context Correction Layer',
                 fontsize=14, fontweight='bold', color=PRIMARY_NAVY, y=0.985)
    fig.text(0.5, 0.935, 'Two-stage performance comparison on primary school validation corpus (n = 500 lines)',
             ha='center', va='top', fontsize=10.5, color=TEXT_MUTED)

    out_path = os.path.join(OUTPUT_DIR, "fig2_before_vs_after_ai.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 2 generated:", out_path)


# ==============================================================================
# FIGURE 3: Line-Level AI Correction Behavior Distribution
# ==============================================================================
def plot_fig3():
    labels = [
        'Unchanged\n(No Correction Required)',
        'Improved\n(Diacritics Recovered)',
        'Degraded\n(AI Over-correction)'
    ]
    sizes = [64.2, 28.4, 7.4]
    counts = [321, 142, 37]
    colors = [PRIMARY_NAVY, SECONDARY_TEAL, ACCENT_ORANGE]

    fig, ax = plt.subplots(figsize=(8.6, 6.2), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # Compact scientific donut: outer radius 0.85, width 0.34
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, autopct='%1.1f%%',
        shadow=False, startangle=140, colors=colors,
        pctdistance=0.78, labeldistance=1.12,
        wedgeprops=dict(width=0.34, edgecolor='white', linewidth=2.0),
        textprops=dict(color=TEXT_MAIN, fontsize=9.8, fontweight='bold')
    )

    for i, a in enumerate(autotexts):
        a.set_color('white')
        a.set_fontsize(9.5)
        a.set_fontweight='bold'
        a.set_text(f"{sizes[i]}%\n(n={counts[i]})")

    # Center text inside donut ring
    center_text = "AI Correction Behavior\nValidation Benchmark\nn = 500 Lines"
    ax.text(0, 0, center_text,
            ha='center', va='center',
            fontsize=10, fontweight='bold', color=PRIMARY_NAVY, linespacing=1.3)

    # Master Figure Title & Subtitle
    fig.suptitle('Figure 3: Line-Level AI Correction Behavior Distribution',
                 fontsize=14, fontweight='bold', color=PRIMARY_NAVY, y=0.985)
    fig.text(0.5, 0.935, 'Validation Dataset Analysis (n = 500 Lines)',
             ha='center', va='top', fontsize=10.5, color=TEXT_MUTED)

    # Operational Note: Academic figure caption style (no box/shadow)
    caption_text = (
        "Fig. 3. Distribution of line-level AI correction behavior on primary validation corpus (n = 500 lines). Degraded predictions\n"
        "(7.4%, 37 lines) are systematically routed to human teacher audit to prevent error propagation into grading records."
    )
    plt.figtext(0.5, 0.04, caption_text, ha='center', fontsize=9.2, color=TEXT_MAIN,
                fontstyle='italic', linespacing=1.3)

    plt.tight_layout(rect=[0, 0.09, 1, 0.91])
    out_path = os.path.join(OUTPUT_DIR, "fig3_ai_correction_decision_pie.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 3 generated:", out_path)


# ==============================================================================
# FIGURE 4: Hierarchical Error Taxonomy and Resolution Priority
# ==============================================================================
def plot_fig4():
    fig = plt.figure(figsize=(14.8, 6.2), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')

    # Balanced GridSpec: Left (Donut), Right (Horizontal Bars) with wide gutter
    gs = fig.add_gridspec(1, 2, width_ratios=[0.95, 1.30], wspace=0.45,
                           top=0.82, bottom=0.08, left=0.05, right=0.97)
    ax1 = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1])

    ax1.set_facecolor('#FFFFFF')
    ax2.set_facecolor('#FFFFFF')

    # Subplot 1: Hierarchical Error Taxonomy Donut
    l1_labels = ['Optical Recognition\nFailure: 64.7%', 'Segmentation\n19.6%', 'Image Quality\n9.8%', 'AI Error\n5.9%']
    l1_sizes = [64.71, 19.61, 9.80, 5.88]
    l1_colors = [PRIMARY_NAVY, ACCENT_ORANGE, '#475569', SECONDARY_TEAL]

    l2_sizes = [41.18, 23.53, 19.61, 9.80, 5.88]
    l2_labels = [
        'Grapheme Failure\n41.2% (42)',
        'Diacritic Failure\n23.5% (24)',
        'Line Collision\n19.6% (20)',
        'Motion Blur\n9.8% (10)',
        'Over-correction\n5.9% (6)'
    ]
    l2_colors = ['#2B4C7E', '#4A6FA5', '#F39C12', '#94A3B8', '#16A085']

    # Outer Ring (Level 2 Root Causes) - Controlled radius so labels never touch ax2
    ax1.pie(
        l2_sizes, radius=0.74, colors=l2_colors, startangle=140,
        labels=l2_labels, labeldistance=1.12,
        wedgeprops=dict(width=0.26, edgecolor='white', linewidth=1.5),
        textprops=dict(fontsize=7.8, fontweight='bold', color=TEXT_MAIN)
    )

    # Inner Ring (Level 1 Domains)
    ax1.pie(
        l1_sizes, radius=0.48, colors=l1_colors, startangle=140,
        labels=l1_labels, labeldistance=0.64,
        wedgeprops=dict(width=0.24, edgecolor='white', linewidth=1.5),
        textprops=dict(fontsize=6.6, fontweight='bold', color='white', ha='center', va='center')
    )

    ax1.text(0, 0, 'Total Errors\nn = 102\n(510 Lines)', ha='center', va='center',
             fontsize=8.8, fontweight='bold', color=PRIMARY_NAVY)
    ax1.set_title('(a) Hierarchical Error Taxonomy\nOptical Recognition Failure Breakdown',
                  fontsize=11, fontweight='bold', pad=12, color=PRIMARY_NAVY)

    # Subplot 2: Engineering Priority Ranking & Concise Mitigation Plan
    priority_items = [
        ('Priority 1A: Grapheme Recognition Failure', 41.18, 42, PRIMARY_NAVY, 'Vision Backbone Upgrade'),
        ('Priority 1B: Diacritic Recognition Failure', 23.53, 24, '#2B4C7E', 'Diacritic-Preserving Head'),
        ('Priority 2: Line Segmentation Collision', 19.61, 20, ACCENT_ORANGE, 'Adaptive Line Splitter'),
        ('Priority 3: Image Quality Degradation', 9.80, 10, '#64748B', 'Laplacian Quality Gate'),
        ('Priority 4: AI Over-correction Error', 5.88, 6, SECONDARY_TEAL, 'Syllable Lexicon Decoding')
    ]
    priority_items = priority_items[::-1]

    labels = [p[0] for p in priority_items]
    percs = [p[1] for p in priority_items]
    counts = [p[2] for p in priority_items]
    bar_colors = [p[3] for p in priority_items]
    actions = [p[4] for p in priority_items]

    y_pos = np.arange(len(labels))
    bars = ax2.barh(y_pos, percs, color=bar_colors, edgecolor=BORDER_COLOR, height=0.52, linewidth=0.8)

    ax2.set_yticks(y_pos)
    ax2.set_yticklabels(labels, fontsize=9.0, fontweight='bold', color=TEXT_MAIN)
    ax2.set_xlabel('Proportion of Total Errors (%)', fontsize=10.5, fontweight='bold', color=TEXT_MAIN)
    ax2.set_xlim(0, 66)
    ax2.grid(axis='x', color=GRID_COLOR, linestyle='--', alpha=0.8)
    ax2.set_axisbelow(True)

    for spine in ['top', 'right']:
        ax2.spines[spine].set_visible(False)
    ax2.spines['left'].set_color(BORDER_COLOR)
    ax2.spines['bottom'].set_color(BORDER_COLOR)

    for i, bar in enumerate(bars):
        w = bar.get_width()
        ax2.annotate(f'{w:.1f}% ({counts[i]}) | Mitigation: {actions[i]}',
                     xy=(w, bar.get_y() + bar.get_height() / 2),
                     xytext=(6, 0), textcoords="offset points",
                     va='center', fontsize=8.2, fontweight='bold', color=TEXT_MAIN)

    ax2.set_title('(b) Engineering Priority & Targeted Mitigation Plan\nRanked by Defect Frequency and Impact',
                  fontsize=11, fontweight='bold', pad=12, color=PRIMARY_NAVY)

    # Master Figure Title & Subtitle with vertical breathing room
    fig.suptitle('Figure 4: Hierarchical Error Taxonomy and Engineering Resolution Priority',
                 fontsize=14, fontweight='bold', color=PRIMARY_NAVY, y=0.985)
    fig.text(0.5, 0.935, 'Evaluated on 102 error instances identified across 510 primary classroom lines',
             ha='center', va='top', fontsize=10.5, color=TEXT_MUTED)

    out_path = os.path.join(OUTPUT_DIR, "fig4_error_taxonomy_breakdown.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 4 generated:", out_path)


# ==============================================================================
# FIGURE 5: 5-Bin Confidence Reliability Analysis
# ==============================================================================
def plot_fig5():
    bin_centers = [50, 65, 75, 85, 95]
    actual_accuracy = [40.00, 56.67, 70.77, 82.29, 91.16]
    samples = [15, 30, 65, 175, 215]

    fig, ax1 = plt.subplots(figsize=(9.5, 6.2), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax1.set_facecolor('#FFFFFF')

    # Secondary y-axis for sample volume (neutral gray bars)
    ax2 = ax1.twinx()
    bars = ax2.bar(bin_centers, samples, width=4.0, color='#E2E8F0',
                   label='Sample Volume (n)', edgecolor='#CBD5E1', linewidth=0.8)
    ax2.set_ylabel('Sample Volume (Validation Lines)', color=TEXT_MUTED, fontsize=10.5, fontweight='bold')
    ax2.set_ylim(0, 260)
    ax2.grid(False)
    ax2.spines['top'].set_visible(False)

    # Bring ax1 into foreground so line, markers, annotations and thresholds render on top of ax2 bars
    ax1.set_zorder(ax2.get_zorder() + 1)
    ax1.patch.set_visible(False)

    # Plot theoretical reliability reference line (y = x)
    line_diag = ax1.plot([40, 100], [40, 100], linestyle='--', color='#94A3B8', linewidth=1.5,
                         label='Theoretical Reliability Reference (y=x)')[0]

    # Plot empirical accuracy curve
    line_cal = ax1.plot(bin_centers, actual_accuracy, marker='o', color=PRIMARY_NAVY, linewidth=2.4,
                        markersize=7.5, label='Empirical Accuracy')[0]

    # Annotate empirical accuracy points cleanly
    for i, txt in enumerate(actual_accuracy):
        if i == 4:
            # At 95% bin, place annotation to the left of the point to avoid overlap with diagonal reference line
            ax1.annotate(f"{txt:.1f}%\n(n={samples[i]})", (bin_centers[i], actual_accuracy[i]),
                         textcoords="offset points", xytext=(-22, -6), ha='right', va='top',
                         fontsize=8.5, fontweight='bold', color=PRIMARY_NAVY)
        else:
            ax1.annotate(f"{txt:.1f}%\n(n={samples[i]})", (bin_centers[i], actual_accuracy[i]),
                         textcoords="offset points", xytext=(0, 10), ha='center', va='bottom',
                         fontsize=8.5, fontweight='bold', color=PRIMARY_NAVY)

    # Dashed threshold lines
    thresholds = [60, 70, 90]
    for th in thresholds:
        ax1.axvline(th, color='#64748B', linestyle='--', linewidth=1.1, alpha=0.85)

    # Confidence regions annotated cleanly at the top: <60, 60-70, 70-90, >90
    ax1.text(50, 105.0, '< 60%\nRe-scan / Reject', ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=PRIMARY_NAVY)
    ax1.text(65, 105.0, '60\u201370%\nManual Audit', ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=ACCENT_ORANGE)
    ax1.text(80, 105.0, '70\u201390%\nTeacher Review', ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=PRIMARY_NAVY)
    ax1.text(95, 105.0, '> 90%\nAutomated Accept', ha='center', va='center',
             fontsize=8.2, fontweight='bold', color=SECONDARY_TEAL)

    ax1.set_xlabel('Model Predicted Confidence Range (%)', fontsize=11, fontweight='bold', color=TEXT_MAIN)
    ax1.set_ylabel('Empirical Verification Accuracy (%)', fontsize=11, fontweight='bold', color=TEXT_MAIN)
    ax1.set_xlim(40, 100)
    ax1.set_ylim(24, 114)
    ax1.grid(axis='both', color=GRID_COLOR, linestyle='--', alpha=0.7)
    ax1.set_axisbelow(True)

    for spine in ['top']:
        ax1.spines[spine].set_visible(False)
    ax1.spines['left'].set_color(BORDER_COLOR)
    ax1.spines['bottom'].set_color(BORDER_COLOR)

    # Master Figure Title & Subtitle
    fig.suptitle('Figure 5: 5-Bin Confidence Reliability Analysis',
                 fontsize=14, fontweight='bold', color=PRIMARY_NAVY, y=0.985)
    fig.text(0.5, 0.935, 'Mapping Model Confidence to Human Verification Decisions',
             ha='center', va='top', fontsize=10.5, color=TEXT_MUTED)

    # Combined Legend placed cleanly in open upper-left quadrant
    lines = [line_cal, line_diag, bars]
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper left', bbox_to_anchor=(0.03, 0.85), frameon=True,
               facecolor='#FFFFFF', edgecolor=BORDER_COLOR, fontsize=9.0)

    plt.tight_layout(rect=[0, 0, 1, 0.91])
    out_path = os.path.join(OUTPUT_DIR, "fig5_confidence_calibration_curve.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 5 generated:", out_path)


# ==============================================================================
# FIGURE 6: Character Confusion Matrix and Substitution Analysis
# ==============================================================================
def plot_fig6():
    conf_pairs = [
        ('n', 'm', 12, 'Cursive Stroke Topology', 'Extra minim stroke created in young unconstrained cursive arches', PRIMARY_NAVY),
        ('u', 'ư', 8, 'Diacritic Horn Loss', 'Small horn accent lost during 32px height downsampling', '#2B4C7E'),
        ('d', 'đ', 7, 'Missing Crossbar', 'Light pencil crossbar missed by convolution filters', SECONDARY_TEAL),
        ('a', 'ă', 6, 'Breve Accent Loss', 'Curved breve diacritic eroded by adaptive binarization', ACCENT_ORANGE),
        ('o', 'ô', 5, 'Circumflex Loss', 'Acute hat diacritic merged into upper glyph boundary', '#475569'),
    ]

    sources = ['n', 'u', 'd', 'a', 'o']
    targets = ['m', 'ư', 'đ', 'ă', 'ô']
    matrix = np.zeros((len(sources), len(targets)))

    for s_idx, s in enumerate(sources):
        for t_idx, t in enumerate(targets):
            for src, pred, freq, _, _, _ in conf_pairs:
                if src == s and pred == t:
                    matrix[s_idx, t_idx] = freq

    fig = plt.figure(figsize=(13.0, 6.6), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')

    gs = fig.add_gridspec(1, 2, width_ratios=[1.1, 1.4], wspace=0.28,
                           top=0.84, bottom=0.08, left=0.08, right=0.96)
    ax1 = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1])

    ax1.set_facecolor('#FFFFFF')
    ax2.set_facecolor('#FFFFFF')
    ax2.axis('off')

    # --- Left: Matrix Heatmap ---
    cax = ax1.matshow(matrix, cmap='Blues', vmin=0, vmax=14)

    for i in range(len(sources)):
        for j in range(len(targets)):
            val = int(matrix[i, j])
            color = 'white' if val > 6 else (TEXT_MAIN if val > 0 else '#94A3B8')
            ax1.text(j, i, str(val),
                     ha='center', va='center', color=color, fontsize=12, fontweight='bold')

    cb = fig.colorbar(cax, ax=ax1, fraction=0.046, pad=0.05)
    cb.set_label('Substitution Frequency', color=TEXT_MUTED, fontsize=9.5, fontweight='bold')
    cb.ax.tick_params(labelsize=8.5)

    ax1.set_xticks(range(len(targets)))
    ax1.set_yticks(range(len(sources)))
    ax1.set_xticklabels(targets, fontsize=12, fontweight='bold', color=PRIMARY_NAVY)
    ax1.set_yticklabels(sources, fontsize=12, fontweight='bold', color=PRIMARY_NAVY)

    ax1.set_xlabel('Predicted Character (CRNN Output)', fontsize=10.5, fontweight='bold', color=TEXT_MAIN, labelpad=8)
    ax1.set_ylabel('Ground Truth Character', fontsize=10.5, fontweight='bold', color=TEXT_MAIN)
    ax1.set_title('(a) Selected Dominant Error Pairs\nSubstitution Frequency Heatmap',
                  fontsize=11, fontweight='bold', pad=12, color=PRIMARY_NAVY, linespacing=1.2)

    # --- Right: Root Cause Analysis ---
    ax2.set_title('(b) Root Cause Analysis\nPhysical and Optical Mechanism Breakdown',
                  fontsize=11, fontweight='bold', pad=12, color=PRIMARY_NAVY, loc='left', linespacing=1.2)

    y_positions = [0.80, 0.61, 0.42, 0.23, 0.04]
    card_height = 0.16

    for idx, (src, pred, freq, mech, desc, accent) in enumerate(conf_pairs):
        y = y_positions[idx]

        # Clean card container
        card = FancyBboxPatch((0.02, y), 0.96, card_height,
                              boxstyle="square,pad=0.01",
                              facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=0.8)
        ax2.add_patch(card)

        # Left Accent Tag
        tag = FancyBboxPatch((0.03, y + 0.02), 0.24, card_height - 0.04,
                             boxstyle="square,pad=0.01",
                             facecolor=accent, edgecolor=accent, linewidth=0.5)
        ax2.add_patch(tag)

        ax2.text(0.15, y + card_height / 2, f"{src} \u2192 {pred}  (n={freq})",
                 ha='center', va='center', color='white', fontsize=10.5, fontweight='bold')

        # Error mechanism
        ax2.text(0.30, y + card_height - 0.045, f"Mechanism: {mech}",
                 ha='left', va='top', color=TEXT_MAIN, fontsize=9.5, fontweight='bold')

        # Physical description
        ax2.text(0.30, y + 0.035, desc,
                 ha='left', va='bottom', color=TEXT_MUTED, fontsize=8.4, fontweight='normal')

    # Figure Master Title & Subtitle
    fig.suptitle('Figure 6: Character Confusion Matrix and Substitution Analysis',
                 fontsize=14, fontweight='bold', y=0.985, color=PRIMARY_NAVY)
    fig.text(0.5, 0.935, 'Dominant grapheme and diacritic error mechanisms in primary handwriting recognition',
             ha='center', va='top', fontsize=10.5, color=TEXT_MUTED)

    out_path = os.path.join(OUTPUT_DIR, "fig6_character_confusion_matrix.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 6 generated:", out_path)


# ==============================================================================
# FIGURE 7: Research Architecture Diagram
# ==============================================================================
def plot_fig7():
    fig = plt.figure(figsize=(14.0, 9.8), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor('#FFFFFF')
    ax.axis('off')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)

    # Master Header
    ax.text(0.44, 0.975, "Figure 7: HandAI Research Architecture & Experimental Dataflow",
            ha='center', va='center', fontsize=14.5, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0.44, 0.948, "Five-Stage Framework with Closed-Loop Human-in-the-Loop Active Learning",
            ha='center', va='center', fontsize=10.5, color=TEXT_MUTED)

    x_layer = 0.030
    w_layer = 0.810
    w_pill = 0.175

    # 5 Layers (Reduced from 6 to 5 layers as requested)
    layers = [
        {
            "y": 0.785, "h": 0.125,
            "title": "1. Data Acquisition",
            "sub": "Classroom Notebook Imaging",
            "blocks": [
                ("Primary Classroom Scans", "173 student notebook pages from 72 cohorts\nAcquisition via mobile camera [REST API]"),
                ("Unconstrained Cursive", "High inter-writer variability, dynamic slant\nIrregular stroke width & spacing [Multi-Writer]"),
                ("Ruled Grid Background", "4-line pre-printed grid background (\u00f4 ly)\nPencil smudges and page fold artifacts [Classroom]")
            ]
        },
        {
            "y": 0.620, "h": 0.125,
            "title": "2. Preprocessing",
            "sub": "Restoration & Line Slicing",
            "blocks": [
                ("Document Rectification", "Camera framing & quad corner detection\nPerspective homography warping [Homography]"),
                ("Laplacian Quality Gate", "Blur variance filtering (\u03c3\u00b2 \u2265 60.0)\nRejects defocused captures [Laplacian \u03c3\u00b2]"),
                ("Grid Suppression & Slicing", "Morphological background suppression\nNormalized line crops 1 \u00d7 32 \u00d7 W [Adaptive Crop]")
            ]
        },
        {
            "y": 0.455, "h": 0.125,
            "title": "3. AI Recognition & Correction",
            "sub": "Two-Stage Recognition Engine",
            "blocks": [
                ("CRNN Vision Backbone", "Conv2D + 2-layer BiLSTM sequence model\nCTC greedy decoding (5.96M params) [CRNN]"),
                ("Linguistic Correction", "N-gram phonotactic & tone consistency validator\nDisambiguates visual confusions [N-Gram Filter]"),
                ("Two-Stage Evaluation", "CER: 11.34% \u2192 8.21% (\u221227.6% error drop)\nWER: 26.50% \u2192 20.15% (0.42s latency) [Benchmark]")
            ]
        },
        {
            "y": 0.290, "h": 0.125,
            "title": "4. Analytics and Storage",
            "sub": "Telemetry & Multi-Modal Store",
            "blocks": [
                ("Error Taxonomy Engine", "Hierarchical defect categorization (n=102)\nOptical 64.7%, Seg 19.6%, Blur 9.8% [Taxonomy]"),
                ("Confidence Calibration Gate", "5-bin calibration reliability analysis\nOperational routing (<70% flagged) [Calibration]"),
                ("Multi-Modal Persistence", "Line transcripts & audit logs [PostgreSQL]\nImage crops [MinIO] | Queue [Redis]")
            ]
        },
        {
            "y": 0.110, "h": 0.135,
            "title": "5. Human Feedback Learning",
            "sub": "Educator Audit & Retraining",
            "blocks": [
                ("Teacher Verification Portal", "Educator reviews low-confidence lines (<70%)\nCorrects misrecognized glyphs in UI [Educator Audit]"),
                ("Ground Truth Expansion", "Teacher-verified corrections commit to\ncanonical golden training dataset [Golden DB]"),
                ("Active Model Retraining", "Automated retraining on mined hard samples\nValidation gate enforces CER drop before rollout [Retrain]")
            ]
        }
    ]

    # Draw Layers
    for lay in layers:
        y = lay["y"]
        h = lay["h"]

        # Outer layer frame
        outer = FancyBboxPatch((x_layer, y), w_layer, h,
                               boxstyle="square,pad=0.005",
                               facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=1.0)
        ax.add_patch(outer)

        # Header pillar
        pill = FancyBboxPatch((x_layer + 0.004, y + 0.004), w_pill, h - 0.008,
                              boxstyle="square,pad=0.003",
                              facecolor=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.5)
        ax.add_patch(pill)

        ax.text(x_layer + w_pill / 2, y + h * 0.64, lay["title"],
                ha='center', va='center', fontsize=8.6, fontweight='bold', color='white')
        ax.text(x_layer + w_pill / 2, y + h * 0.36, lay["sub"],
                ha='center', va='center', fontsize=7.2, fontweight='bold', color='#93C5FD')

        # Inner Component Blocks (3 per layer)
        cards = lay["blocks"]
        n_cards = len(cards)
        x_cards_start = x_layer + w_pill + 0.012
        w_cards_total = w_layer - w_pill - 0.020
        gap_card = 0.010
        w_card = (w_cards_total - (n_cards - 1) * gap_card) / n_cards
        h_card = h - 0.012
        y_card = y + 0.006

        for ci, (c_title, c_desc) in enumerate(cards):
            cx = x_cards_start + ci * (w_card + gap_card)

            cbox = FancyBboxPatch((cx, y_card), w_card, h_card,
                                  boxstyle="square,pad=0.004",
                                  facecolor='#FFFFFF', edgecolor=BORDER_COLOR, linewidth=0.7)
            ax.add_patch(cbox)

            # Header strip
            strip_h = 0.024
            strip = FancyBboxPatch((cx + 0.002, y_card + h_card - strip_h - 0.002), w_card - 0.004, strip_h,
                                   boxstyle="square,pad=0.002",
                                   facecolor='#F1F5F9', edgecolor=BORDER_COLOR, linewidth=0.5)
            ax.add_patch(strip)

            ax.text(cx + w_card / 2, y_card + h_card - 0.014, c_title,
                    ha='center', va='center', fontsize=7.5, fontweight='bold', color=PRIMARY_NAVY)

            ax.text(cx + 0.008, y_card + h_card - strip_h - 0.012, c_desc,
                    ha='left', va='top', fontsize=6.6, fontweight='normal', color=TEXT_MAIN, linespacing=1.2)

    # Inter-layer connectors (4 clean downward flow arrows between 5 layers)
    arrow_y_pairs = [
        (0.785, 0.745, "Raw Classroom Image Stream"),
        (0.620, 0.580, "Normalized 1 \u00d7 32 \u00d7 W Grayscale Line Strips"),
        (0.455, 0.415, "Inference Predictions, Transcripts & Confidence Scores"),
        (0.290, 0.245, "Low-Confidence (<70%) & Flagged Lines for Human Audit")
    ]

    for y_top_src, y_bot_dst, flow_label in arrow_y_pairs:
        mid_y = (y_top_src + y_bot_dst) / 2
        mid_x = x_layer + w_layer * 0.52

        ax.annotate(
            '', xy=(mid_x, y_bot_dst), xytext=(mid_x, y_top_src),
            arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=1.5, mutation_scale=10)
        )
        ax.text(mid_x + 0.015, mid_y, flow_label,
                ha='left', va='center', fontsize=6.6, fontweight='bold', color=TEXT_MUTED)

    # Closed Feedback Loop (Layer 5 -> Model Retraining -> Layer 3)
    x_exit = x_layer + w_layer
    y_exit = 0.110 + 0.135 / 2
    y_entry = 0.455 + 0.125 / 2
    x_conduit = 0.865

    # Horizontal out from Layer 5
    ax.annotate('', xy=(x_conduit, y_exit), xytext=(x_exit, y_exit),
                arrowprops=dict(arrowstyle="-", color=SECONDARY_TEAL, lw=2.2))
    # Vertical upward
    ax.annotate('', xy=(x_conduit, y_entry), xytext=(x_conduit, y_exit),
                arrowprops=dict(arrowstyle="-", color=SECONDARY_TEAL, lw=2.2))
    # Horizontal into Layer 3
    ax.annotate('', xy=(x_exit, y_entry), xytext=(x_conduit, y_entry),
                arrowprops=dict(arrowstyle="-|>", color=SECONDARY_TEAL, lw=2.2, mutation_scale=14))

    # Feedback Loop Information Card on right
    fb_x = 0.880
    fb_w = 0.105
    fb_y = 0.230
    fb_h = 0.270

    fb_box = FancyBboxPatch((fb_x, fb_y), fb_w, fb_h,
                            boxstyle="square,pad=0.006",
                            facecolor='#FFFFFF', edgecolor=SECONDARY_TEAL, linewidth=1.2)
    ax.add_patch(fb_box)

    fb_hdr = FancyBboxPatch((fb_x + 0.003, fb_y + fb_h - 0.034), fb_w - 0.006, 0.030,
                            boxstyle="square,pad=0.002",
                            facecolor=SECONDARY_TEAL, edgecolor=SECONDARY_TEAL, linewidth=0.5)
    ax.add_patch(fb_hdr)

    ax.text(fb_x + fb_w / 2, fb_y + fb_h - 0.018, "Active Learning Loop",
            ha='center', va='center', fontsize=7.4, fontweight='bold', color='white')

    fb_items = [
        "Teacher-Validated\nGround Truth Commit",
        "Hard-Example\nMining Prioritization",
        "Automated CER Gate\nBefore Rollout",
        "Seamless Checkpoint\nRollout to Model v1.x"
    ]
    fy = fb_y + fb_h - 0.052
    for it in fb_items:
        ax.text(fb_x + 0.006, fy, f"\u2022 {it}", ha='left', va='top', fontsize=6.3,
                fontweight='normal', color=TEXT_MAIN, linespacing=1.15)
        fy -= 0.050

    ax.text(0.44, 0.038,
            "HandAI Research Architecture \u2014 Five-Stage Dataflow Pipeline & Active Human-in-the-Loop Cycle",
            ha='center', va='center', fontsize=8.2, color=TEXT_MUTED)

    out_path = os.path.join(OUTPUT_DIR, "fig7_big_data_architecture.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 7 generated:", out_path)


# ==============================================================================
# FIGURE 8: Dataset Scale and Experimental Evaluation Matrix
# ==============================================================================
def plot_fig8():
    fig = plt.figure(figsize=(13.5, 9.2), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor('#FFFFFF')
    ax.axis('off')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)

    # Master Header
    ax.text(0.50, 0.975, "Figure 8: Dataset Scale and Experimental Evaluation Matrix",
            ha='center', va='center', fontsize=15, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0.50, 0.948, "Experimental Setup, Benchmark Corpus Parameters, and Error Analysis Profile",
            ha='center', va='center', fontsize=10.5, color=TEXT_MUTED)

    # Top KPI Metrics Strip (5 Experimental Parameters)
    kpis = [
        ("Training Corpus", "59,462", "Handwriting Lines", "CRNN v1.2 Active Mix"),
        ("Validation Benchmark", "500", "Audited Lines", "12,410 Golden Characters"),
        ("Student Cohorts", "72", "Classroom Groups", "173 Pages / 510 Lines"),
        ("Error Benchmark", "102", "Exhaustive Cases", "100% Classified Taxonomy"),
        ("Model Iterations", "3", "Progressive Versions", "v1.0 \u2192 v1.1 \u2192 v1.2")
    ]

    kw = 0.178
    kgap = 0.016
    kx_start = 0.024
    ky = 0.835
    kh = 0.088

    for i, (k_title, k_main, k_sub, k_desc) in enumerate(kpis):
        kx = kx_start + i * (kw + kgap)
        kbox = FancyBboxPatch((kx, ky), kw, kh,
                              boxstyle="square,pad=0.006",
                              facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=0.9)
        ax.add_patch(kbox)

        # Top indicator bar
        bar_col = PRIMARY_NAVY if i in [0, 4] else (SECONDARY_TEAL if i in [1, 2] else ACCENT_ORANGE)
        ind = FancyBboxPatch((kx + 0.002, ky + kh - 0.005), kw - 0.004, 0.004,
                             boxstyle="square,pad=0.001",
                             facecolor=bar_col, edgecolor=bar_col, linewidth=0.5)
        ax.add_patch(ind)

        ax.text(kx + kw / 2, ky + kh - 0.020, k_title,
                ha='center', va='center', fontsize=7.6, fontweight='bold', color=TEXT_MUTED)
        ax.text(kx + kw / 2, ky + kh - 0.046, k_main,
                ha='center', va='center', fontsize=15.5, fontweight='bold', color=PRIMARY_NAVY)
        ax.text(kx + kw / 2, ky + 0.024, k_sub,
                ha='center', va='center', fontsize=7.4, fontweight='bold', color=TEXT_MAIN)
        ax.text(kx + kw / 2, ky + 0.011, k_desc,
                ha='center', va='center', fontsize=6.6, color=TEXT_MUTED)

    # 4 Main Experimental Setup Panels
    pw = 0.468
    col1_x = 0.024
    col2_x = 0.508

    row1_y = 0.445
    row1_h = 0.365

    row2_y = 0.055
    row2_h = 0.365

    # Panel (a): Training Corpus Scaling Trajectory
    p1 = FancyBboxPatch((col1_x, row1_y), pw, row1_h,
                        boxstyle="square,pad=0.008",
                        facecolor='#FFFFFF', edgecolor=BORDER_COLOR, linewidth=1.0)
    ax.add_patch(p1)

    p1_hdr = FancyBboxPatch((col1_x + 0.004, row1_y + row1_h - 0.038), pw - 0.008, 0.032,
                            boxstyle="square,pad=0.002",
                            facecolor=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.5)
    ax.add_patch(p1_hdr)
    ax.text(col1_x + 0.015, row1_y + row1_h - 0.022, "(a) Training Corpus Scaling & Validation Progress",
            ha='left', va='center', fontsize=8.8, fontweight='bold', color='white')

    versions_data = [
        ("CRNN v1.0 (Baseline)", "15,420 Lines", "CER: 18.40% | WER: 38.20%", "Initial baseline; high diacritic loss in cursive arches"),
        ("CRNN v1.1 (BatchNorm)", "34,100 Lines (+121.1%)", "CER: 14.10% | WER: 31.50%", "Expanded synthetic & authentic blend; reduced line variance"),
        ("CRNN v1.2 (Active Checkpoint)", "59,462 Lines (+74.4%)", "CER: 11.34% | WER: 26.50%", "Step 16,900; 5.96M parameters; validation loss 0.4518"),
    ]

    vy = row1_y + row1_h - 0.050
    vh = 0.068
    for v_title, v_lines, v_metrics, v_desc in versions_data:
        vy -= vh + 0.006
        vbox = FancyBboxPatch((col1_x + 0.010, vy), pw - 0.020, vh,
                              boxstyle="square,pad=0.003",
                              facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=0.7)
        ax.add_patch(vbox)
        ax.text(col1_x + 0.018, vy + vh - 0.015, v_title,
                ha='left', va='center', fontsize=7.4, fontweight='bold', color=PRIMARY_NAVY)
        ax.text(col1_x + 0.180, vy + vh - 0.015, f"Corpus: {v_lines}",
                ha='left', va='center', fontsize=7.2, fontweight='bold', color=TEXT_MAIN)
        ax.text(col1_x + 0.018, vy + vh - 0.034, v_metrics,
                ha='left', va='center', fontsize=7.2, fontweight='bold', color=SECONDARY_TEAL)
        ax.text(col1_x + 0.018, vy + 0.013, v_desc,
                ha='left', va='center', fontsize=6.6, color=TEXT_MUTED)

    # Post-AI summary
    post_y = row1_y + 0.012
    p_box = FancyBboxPatch((col1_x + 0.010, post_y), pw - 0.020, 0.048,
                           boxstyle="square,pad=0.003",
                           facecolor='#F0FDF4', edgecolor=SECONDARY_TEAL, linewidth=0.8)
    ax.add_patch(p_box)
    ax.text(col1_x + 0.018, post_y + 0.032, "Post-AI Linguistic Correction (Two-Stage Pipeline Impact):",
            ha='left', va='center', fontsize=7.2, fontweight='bold', color=SECONDARY_TEAL)
    ax.text(col1_x + 0.018, post_y + 0.014,
            "CER: 8.21% (\u0394 = \u22123.13%, \u221227.6% rel.)  |  WER: 20.15% (\u0394 = \u22126.35%, \u221224.0% rel.)  |  Latency: 0.42s/line",
            ha='left', va='center', fontsize=6.8, fontweight='bold', color=PRIMARY_NAVY)

    # Panel (b): Classroom Acquisition Diversity & Experimental Setup
    p2 = FancyBboxPatch((col2_x, row1_y), pw, row1_h,
                        boxstyle="square,pad=0.008",
                        facecolor='#FFFFFF', edgecolor=BORDER_COLOR, linewidth=1.0)
    ax.add_patch(p2)

    p2_hdr = FancyBboxPatch((col2_x + 0.004, row1_y + row1_h - 0.038), pw - 0.008, 0.032,
                            boxstyle="square,pad=0.002",
                            facecolor=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.5)
    ax.add_patch(p2_hdr)
    ax.text(col2_x + 0.015, row1_y + row1_h - 0.022, "(b) Classroom Experimental Acquisition Setup",
            ha='left', va='center', fontsize=8.8, fontweight='bold', color='white')

    setup_data = [
        ("72 Student Cohorts", "Heterogeneous handwriting stages across primary grades; slant 15\u00b0\u201345\u00b0"),
        ("173 Notebook Pages", "Standard 4-line grid paper (\u00f4 ly); pre-printed ruling and eraser noise"),
        ("510 Validation Lines", "Curated literary prose, grammar exercises, student names, and arithmetic expressions"),
        ("Laplacian Quality Gate", "Blur variance filtering (\u03c3\u00b2 \u2265 60.0) rejecting defocused camera captures")
    ]

    sy = row1_y + row1_h - 0.048
    sh = 0.064
    for s_title, s_desc in setup_data:
        sy -= sh + 0.008
        sbox = FancyBboxPatch((col2_x + 0.010, sy), pw - 0.020, sh,
                              boxstyle="square,pad=0.003",
                              facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=0.7)
        ax.add_patch(sbox)
        ax.text(col2_x + 0.018, sy + sh - 0.018, f"\u25aa {s_title}",
                ha='left', va='center', fontsize=7.4, fontweight='bold', color=PRIMARY_NAVY)
        w_sdesc = textwrap.fill(s_desc, width=62)
        ax.text(col2_x + 0.018, sy + 0.018, w_sdesc,
                ha='left', va='bottom', fontsize=6.6, color=TEXT_MAIN, linespacing=1.2)

    # Panel (c): Categorized Error Taxonomy Benchmark
    p3 = FancyBboxPatch((col1_x, row2_y), pw, row2_h,
                        boxstyle="square,pad=0.008",
                        facecolor='#FFFFFF', edgecolor=BORDER_COLOR, linewidth=1.0)
    ax.add_patch(p3)

    p3_hdr = FancyBboxPatch((col1_x + 0.004, row2_y + row2_h - 0.038), pw - 0.008, 0.032,
                            boxstyle="square,pad=0.002",
                            facecolor=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.5)
    ax.add_patch(p3_hdr)
    ax.text(col1_x + 0.015, row2_y + row2_h - 0.022, "(c) Classified Error Analysis Benchmark (n = 102 Errors)",
            ha='left', va='center', fontsize=8.8, fontweight='bold', color='white')

    err_data = [
        ("Base Grapheme Confusion", "42 errors", "41.18%", "Visual cursive arch ambiguity (n\u2192m, d\u2192\u0111)"),
        ("Tone Mark Dropout", "24 errors", "23.53%", "Sub-pixel diacritic loss in 32px height downsampling (u\u2192\u01b0, a\u2192\u0103)"),
        ("Line Segmentation Collision", "20 errors", "19.61%", "Ascender and descender overlap across ruled notebook grid lines"),
        ("Image Blur / Defocus", "10 errors", "9.80%", "Motion blur failing Laplacian threshold (\u03c3\u00b2 < 60.0)"),
        ("AI Over-correction Error", "6 errors", "5.88%", "Statistical hallucination on proper nouns or math terms")
    ]

    ey = row2_y + row2_h - 0.046
    eh = 0.052
    for cat_name, cnt, pct, mech in err_data:
        ey -= eh + 0.005
        ebox = FancyBboxPatch((col1_x + 0.010, ey), pw - 0.020, eh,
                              boxstyle="square,pad=0.003",
                              facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=0.7)
        ax.add_patch(ebox)

        ax.text(col1_x + 0.018, ey + eh / 2, f"{cnt} ({pct})",
                ha='left', va='center', fontsize=7.2, fontweight='bold', color=ACCENT_ORANGE)
        ax.text(col1_x + 0.115, ey + eh - 0.016, cat_name,
                ha='left', va='center', fontsize=7.4, fontweight='bold', color=TEXT_MAIN)
        ax.text(col1_x + 0.115, ey + 0.014, f"Mechanism: {mech}",
                ha='left', va='center', fontsize=6.4, color=TEXT_MUTED)

    # Panel (d): Dataset Characteristics (Renamed from Big Data Evaluation Attributes as requested)
    p4 = FancyBboxPatch((col2_x, row2_y), pw, row2_h,
                        boxstyle="square,pad=0.008",
                        facecolor='#FFFFFF', edgecolor=BORDER_COLOR, linewidth=1.0)
    ax.add_patch(p4)

    p4_hdr = FancyBboxPatch((col2_x + 0.004, row2_y + row2_h - 0.038), pw - 0.008, 0.032,
                            boxstyle="square,pad=0.002",
                            facecolor=PRIMARY_NAVY, edgecolor=PRIMARY_NAVY, linewidth=0.5)
    ax.add_patch(p4_hdr)
    ax.text(col2_x + 0.015, row2_y + row2_h - 0.022, "(d) Dataset Characteristics",
            ha='left', va='center', fontsize=8.8, fontweight='bold', color='white')

    attributes = [
        ("Scale", "59,462 Lines Training Corpus", "5.96M parameters trained across 16,900 optimization steps"),
        ("Diversity", "72 Student Cohorts \u00b7 173 Pages", "Heterogeneous cursive handwriting, 4-line grid paper, and math expressions"),
        ("Throughput", "0.42s / Line Inference Latency", "Real-time edge triage and asynchronous Redis inference queue"),
        ("Validation", "100% Manually Audited Benchmark", "500-line golden validation set with 12,410 ground-truth characters"),
        ("Impact", "\u221227.6% Error Reduction (AI Layer)", "Two-stage pipeline enables automated homework grading in primary schools")
    ]

    ay = row2_y + row2_h - 0.046
    ah = 0.052
    for a_name, a_val, a_desc in attributes:
        ay -= ah + 0.005
        abox = FancyBboxPatch((col2_x + 0.010, ay), pw - 0.020, ah,
                              boxstyle="square,pad=0.003",
                              facecolor=BG_LIGHT, edgecolor=BORDER_COLOR, linewidth=0.7)
        ax.add_patch(abox)

        ax.text(col2_x + 0.018, ay + ah / 2, a_name,
                ha='left', va='center', fontsize=7.4, fontweight='bold', color=PRIMARY_NAVY)
        ax.text(col2_x + 0.080, ay + ah - 0.016, a_val,
                ha='left', va='center', fontsize=7.4, fontweight='bold', color=TEXT_MAIN)
        ax.text(col2_x + 0.080, ay + 0.014, a_desc,
                ha='left', va='center', fontsize=6.4, color=TEXT_MUTED)

    out_path = os.path.join(OUTPUT_DIR, "fig8_dataset_scale_evidence.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 8 generated:", out_path)


# ==============================================================================
# FIGURE 9: Circular Human-in-the-Loop Learning Cycle
# ==============================================================================
def plot_fig9():
    fig = plt.figure(figsize=(14.0, 9.6), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor('#FFFFFF')
    ax.axis('off')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)

    # Master Header
    ax.text(0.50, 0.972, "Figure 9: Circular Human-in-the-Loop Learning Cycle",
            ha='center', va='center', fontsize=15, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0.50, 0.945, "Closed-Loop Active Learning Pipeline: Transforming Routine Grading into Ground Truth",
            ha='center', va='center', fontsize=10.5, color=TEXT_MUTED)

    # 7 Stages of the Circular Learning Cycle
    stages = [
        {
            "step": "Step 1", "name": "Capture", "sub": "Mobile Edge Ingestion",
            "desc": "Camera capture & quad detection\nHomography rectification\nLaplacian gate (\u03c3\u00b2 \u2265 60.0)",
            "center": (0.50, 0.77), "color": PRIMARY_NAVY
        },
        {
            "step": "Step 2", "name": "OCR Recognition", "sub": "CRNN Sequence Model",
            "desc": "Conv2D + 2-layer BiLSTM\nCTC greedy decoding\nLatency 0.42s / line",
            "center": (0.78, 0.65), "color": PRIMARY_NAVY
        },
        {
            "step": "Step 3", "name": "Context Correction", "sub": "Linguistic Post-Processing",
            "desc": "N-gram phonotactic validator\nDisambiguates tone mark loss\nCER \u221227.6%, WER \u221224.0%",
            "center": (0.83, 0.41), "color": PRIMARY_NAVY
        },
        {
            "step": "Step 4", "name": "Confidence Evaluation", "sub": "5-Bin Reliability Triage",
            "desc": "Posterior calibration routing\nAuto-accept for >90%\nFlags low-confidence (<70%)",
            "center": (0.64, 0.19), "color": ACCENT_ORANGE
        },
        {
            "step": "Step 5", "name": "Teacher Verification", "sub": "Human Educator Audit",
            "desc": "Teacher audits flagged lines in UI\nCorrects misrecognized glyphs\nSupervision from routine grading",
            "center": (0.36, 0.19), "color": SECONDARY_TEAL
        },
        {
            "step": "Step 6", "name": "Ground Truth Database", "sub": "Golden Corpus Expansion",
            "desc": "Teacher-Assisted Ground Truth\nVerified image-text pairs committed\nEnriched with error diagnostic tags",
            "center": (0.17, 0.41), "color": SECONDARY_TEAL
        },
        {
            "step": "Step 7", "name": "Model Retraining", "sub": "Active Learning Pipeline",
            "desc": "Hard-example mining prioritization\nCRNN retraining on golden mix\nAutomated CER gate before rollout",
            "center": (0.22, 0.65), "color": PRIMARY_NAVY
        }
    ]

    cw, ch = 0.205, 0.120

    # Draw 7 Stage Cards
    for s in stages:
        kx, ky = s["center"]
        x_left = kx - cw / 2
        y_bot = ky - ch / 2
        col = s["color"]

        # Card container
        card = FancyBboxPatch((x_left, y_bot), cw, ch,
                              boxstyle="square,pad=0.005",
                              facecolor='#FFFFFF', edgecolor=BORDER_COLOR, linewidth=1.0)
        ax.add_patch(card)

        # Header pill for Step
        pill_w = 0.052
        pill_h = 0.020
        pill = FancyBboxPatch((x_left + 0.006, y_bot + ch - pill_h - 0.006), pill_w, pill_h,
                              boxstyle="square,pad=0.002",
                              facecolor=col, edgecolor=col, linewidth=0.5)
        ax.add_patch(pill)
        ax.text(x_left + 0.006 + pill_w / 2, y_bot + ch - 0.016, s["step"],
                ha='center', va='center', fontsize=7.0, fontweight='bold', color='white')

        ax.text(x_left + 0.064, y_bot + ch - 0.016, s["name"],
                ha='left', va='center', fontsize=8.2, fontweight='bold', color=PRIMARY_NAVY)
        ax.text(x_left + 0.006, y_bot + ch - 0.038, s["sub"],
                ha='left', va='center', fontsize=6.8, fontweight='bold', color=col)

        # Divider line
        ax.plot([x_left + 0.006, x_left + cw - 0.006], [y_bot + ch - 0.046, y_bot + ch - 0.046],
                color=BORDER_COLOR, lw=0.6)

        # Bullet description
        ax.text(x_left + 0.006, y_bot + ch - 0.056, s["desc"],
                ha='left', va='top', fontsize=6.3, color=TEXT_MAIN, linespacing=1.22)

    # Clean Explicit Connecting Directed Arrows Between Consecutive Stages (Zero Overlaps)
    # 1. Step 1 (Capture) -> Step 2 (OCR Recognition)
    ax.annotate(
        '', xy=(0.70, 0.71), xytext=(0.61, 0.76),
        arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=2.0, mutation_scale=13,
                        connectionstyle="arc3,rad=-0.12")
    )

    # 2. Step 2 (OCR Recognition) -> Step 3 (Context Correction)
    ax.annotate(
        '', xy=(0.83, 0.48), xytext=(0.80, 0.58),
        arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=2.0, mutation_scale=13,
                        connectionstyle="arc3,rad=-0.08")
    )

    # 3. Step 3 (Context Correction) -> Step 4 (Confidence Evaluation)
    ax.annotate(
        '', xy=(0.73, 0.255), xytext=(0.78, 0.34),
        arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=2.0, mutation_scale=13,
                        connectionstyle="arc3,rad=-0.12")
    )

    # 4. Step 4 (Confidence Evaluation) -> Step 5 (Teacher Verification)
    # Clean horizontal arrow between bottom cards with triage label
    ax.annotate(
        '', xy=(0.470, 0.190), xytext=(0.530, 0.190),
        arrowprops=dict(arrowstyle="-|>", color=ACCENT_ORANGE, lw=2.0, mutation_scale=13)
    )
    triage_pill = FancyBboxPatch((0.465, 0.215), 0.070, 0.024,
                                boxstyle="square,pad=0.002",
                                facecolor='#FFFBEB', edgecolor=ACCENT_ORANGE, linewidth=0.7)
    ax.add_patch(triage_pill)
    ax.text(0.50, 0.227, "Flagged (<70%)", ha='center', va='center',
            fontsize=6.2, fontweight='bold', color=ACCENT_ORANGE)

    # 5. Step 5 (Teacher Verification) -> Step 6 (Ground Truth Database)
    ax.annotate(
        '', xy=(0.22, 0.34), xytext=(0.27, 0.255),
        arrowprops=dict(arrowstyle="-|>", color=SECONDARY_TEAL, lw=2.0, mutation_scale=13,
                        connectionstyle="arc3,rad=-0.12")
    )

    # 6. Step 6 (Ground Truth Database) -> Step 7 (Model Retraining)
    ax.annotate(
        '', xy=(0.20, 0.58), xytext=(0.17, 0.48),
        arrowprops=dict(arrowstyle="-|>", color=SECONDARY_TEAL, lw=2.0, mutation_scale=13,
                        connectionstyle="arc3,rad=-0.08")
    )

    # 7. Step 7 (Model Retraining) -> Step 1 (Capture) [Completing the Circle]
    ax.annotate(
        '', xy=(0.39, 0.76), xytext=(0.30, 0.71),
        arrowprops=dict(arrowstyle="-|>", color=PRIMARY_NAVY, lw=2.0, mutation_scale=13,
                        connectionstyle="arc3,rad=-0.12")
    )

    # Central Hub: Highlighting the Active Learning Loop
    cx, cy = 0.50, 0.47
    hub_w, hub_h = 0.28, 0.18
    hub_x = cx - hub_w / 2
    hub_y = cy - hub_h / 2

    hub_box = FancyBboxPatch((hub_x, hub_y), hub_w, hub_h,
                             boxstyle="square,pad=0.008",
                             facecolor=BG_LIGHT, edgecolor=SECONDARY_TEAL, linewidth=1.2)
    ax.add_patch(hub_box)

    ax.text(cx, cy + 0.055, "Human-in-the-Loop Active Learning",
            ha='center', va='center', fontsize=8.8, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(cx, cy + 0.030, "Continuous Closed-Loop Cycle",
            ha='center', va='center', fontsize=7.8, fontweight='bold', color=SECONDARY_TEAL)

    hub_body = (
        "Routine educator verification converts classroom\n"
        "grading into high-value ground truth pairs.\n"
        "Hard grapheme confusions are prioritized for\n"
        "retraining without manual labeling overhead."
    )
    ax.text(cx, cy - 0.030, hub_body,
            ha='center', va='center', fontsize=6.8, color=TEXT_MUTED, linespacing=1.25)

    # Bottom Figure Caption Style Note
    ax.text(0.50, 0.035,
            "Fig. 9. Circular human-in-the-loop active learning cycle for primary Vietnamese handwriting recognition.\n"
            "Routine teacher audit of low-confidence predictions systematically refines the ground-truth corpus and drives incremental model iterations.",
            ha='center', va='center', fontsize=8.4, fontstyle='italic', color=TEXT_MUTED, linespacing=1.25)

    out_path = os.path.join(OUTPUT_DIR, "fig9_continuous_learning_feedback_loop.png")
    plt.savefig(out_path, dpi=300, facecolor='white')
    plt.close()
    print("[OK] Figure 9 generated:", out_path)


# ==============================================================================
# Main Generation Runner
# ==============================================================================
if __name__ == '__main__':
    print("==================================================================")
    print("Generating Publication-Quality Scientific Figures (IEEE/ACM Standard)")
    print("==================================================================")
    plot_fig1()
    plot_fig2()
    plot_fig3()
    plot_fig4()
    plot_fig5()
    plot_fig6()
    plot_fig7()
    plot_fig8()
    plot_fig9()
    print("==================================================================")
    print(f"All 9 scientific figures generated successfully in: {OUTPUT_DIR}")
    print("==================================================================")
