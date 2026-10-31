import Cairo from 'cairo';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import {clockState, dialAngle, DESIGN_WIDTH, DESIGN_HEIGHT} from './model.js';

// Draw text by the center of its visible ink, not its font's baseline. This
// keeps digits visually centered even when font metrics differ across systems.
// Add the flip parameter and un-mirror the context before drawing text
function text(cr: Cairo.Context, value: string, x: number, y: number, size: number, alpha: number, flip: boolean, fontName: string, style: TextStyle): void {
    // Pango uses its own integer units. Absolute size means reference-canvas
    // pixels, not points affected by the desktop's text DPI setting.
    const layout = PangoCairo.create_layout(cr);
    const font = Pango.FontDescription.from_string(fontName);
    font.set_absolute_size(size * style.scale * Pango.SCALE);
    font.set_weight(style.bold ? Pango.Weight.BOLD : Pango.Weight.NORMAL);
    layout.set_font_description(font);
    layout.set_text(value, -1);
    const ink = layout.get_pixel_extents()[0]!;
    cr.setSourceRGBA(...style.color, alpha);
    
    cr.save();
    cr.translate(x, y);
    // Un-flip the text horizontally so it remains readable left-to-right
    if (flip) cr.scale(-1, 1);
    cr.moveTo(-ink.width / 2 - ink.x, -ink.height / 2 - ink.y);
    // Fill glyph outlines rather than using Cairo's toy showText API. Desktop
    // subpixel font settings can otherwise produce colored edges when the
    // drawing is transparent and later composited over an arbitrary wallpaper.
    PangoCairo.layout_path(cr, layout);
    cr.fill();
    cr.restore();
}

// `current` can be fractional (e.g. 43.250 seconds). The positions change
// continuously, but numbers remain upright because we move their centers
// along the circle rather than rotating the entire Cairo coordinate system.
// Add the flip parameter and pass it down to text()
function ring(cr: Cairo.Context, current: number, radius: number, labelRadius: number, opacity: number, flip: boolean, fontName: string, style: TextStyle): void {
    // A center just beyond the left edge gives the intentionally cropped,
    // off-center instrument-dial appearance from the reference.
    const cx = -3;
    const cy = 430;
    for (let value = 0; value < 60; value++) {
        const angle = dialAngle(value, current);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const major = value % 5 === 0;
        // cos(angle) is the horizontal direction. Fade the hidden/left half
        // down gently, while keeping marks on the visible right side brighter.
        const fade = Math.max(0.05, Math.min(1, (cosine + 0.2) / 0.9));
        const length = major ? 26 : 14;
        cr.setSourceRGBA(1, 1, 1, opacity * 0.47 * fade);
        cr.setLineWidth(major ? 1.6 : 1.3);
        // A tick is a short radial segment: its endpoints share an angle,
        // but have slightly different distances from the center.
        cr.moveTo(cx + (radius - length) * cosine, cy + (radius - length) * sine);
        cr.lineTo(cx + radius * cosine, cy + radius * sine);
        cr.stroke();
        if (major) {
            // Label every fifth mark and pad zero so all labels are two digits.
            text(cr, String(value).padStart(2, '0'),
                cx + labelRadius * cosine, cy + labelRadius * sine,
                27, opacity * 0.53 * fade, flip, fontName, style);
        }
    }
}
// Append a pill-shaped path without painting it. Sharing this geometry between
// clipping and the border guarantees the empty interior matches the outline.
function capsule(cr: Cairo.Context, x: number, y: number, width: number, height: number): void {
    const radius = height / 2;
    cr.newSubPath();
    cr.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
    cr.arc(x + radius, y + radius, radius, Math.PI / 2, Math.PI * 1.5);
    cr.closePath();
}

// No GTK/Shell dependencies: the desktop widget, preferences and offscreen
// tests all use this exact drawing function. The caller owns the Cairo context.
// Add the flip option, apply the mirror transform, and pass it to elements
export function drawClock(cr: Cairo.Context, width: number, height: number, date: Date, options: ClockOptions = {}): void {
    const {use24Hour = false, showSeconds = true, opacity = 1, flip = false,
        fontName = 'Sans', fontColor = '#ffffff', fontBold = false, fontSize = 100} = options;
    // The picker stores #RRGGBB. Invalid externally supplied colors stay legible.
    const color = /^#[0-9a-f]{6}$/i.test(fontColor) ? fontColor : '#ffffff';
    const style: TextStyle = {
        color: [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255) as [number, number, number],
        bold: fontBold,
        scale: Math.max(50, Math.min(150, fontSize)) / 100,
    };
    const state = clockState(date, use24Hour);
    // Save/restore prevents our transforms and clips from affecting the caller.
    cr.save();
    cr.scale(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

    // Mirror the entire drawing horizontally if positioned on the right
    if (flip) {
        cr.translate(DESIGN_WIDTH, 0);
        cr.scale(-1, 1);
    }

    cr.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    cr.clip();

    // Draw the seconds dial globally so it is visible underneath the capsule.
    if (showSeconds)
        ring(cr, state.secondValue, 352, 308, opacity, flip, fontName, style);

    cr.save();
    cr.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    capsule(cr, 175, 385, 190, 90);
    cr.setFillRule(Cairo.FillRule.EVEN_ODD);
    cr.clip();
    ring(cr, state.minuteValue, 270, 226, opacity, flip, fontName, style);
    cr.restore();

    // Only stroke the outline: there is deliberately NO fill/color behind
    // the minute element. Its interior is fully transparent except the digits.
    capsule(cr, 175, 385, 190, 90);
    cr.setSourceRGBA(1, 1, 1, 0.10 * opacity);
    cr.setLineWidth(1.8);
    cr.stroke();
      // Draw the digital readout last, above the dials and capsule outline.
    text(cr, state.hour, 80, 430, 116, opacity, flip, fontName, style);
    text(cr, state.minute, 229, 430, 48, opacity, flip, fontName, style);
    cr.restore();
}
export interface ClockOptions {
    use24Hour?: boolean;
    showSeconds?: boolean;
    opacity?: number;
    flip?: boolean;
    fontName?: string;
    fontColor?: string;
    fontBold?: boolean;
    fontSize?: number;
}

interface TextStyle {
    color: [number, number, number];
    bold: boolean;
    scale: number;
}
