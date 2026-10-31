import Cairo from 'cairo';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import { clockState, dialAngle, DESIGN_WIDTH, DESIGN_HEIGHT } from './model.js';
function text(cr, value, x, y, size, alpha, flip, fontName, style) {
    const layout = PangoCairo.create_layout(cr);
    const font = Pango.FontDescription.from_string(fontName);
    font.set_absolute_size(size * style.scale * Pango.SCALE);
    font.set_weight(style.bold ? Pango.Weight.BOLD : Pango.Weight.NORMAL);
    layout.set_font_description(font);
    layout.set_text(value, -1);
    const ink = layout.get_pixel_extents()[0];
    cr.setSourceRGBA(...style.color, alpha);
    cr.save();
    cr.translate(x, y);
    if (flip)
        cr.scale(-1, 1);
    cr.moveTo(-ink.width / 2 - ink.x, -ink.height / 2 - ink.y);
    PangoCairo.layout_path(cr, layout);
    cr.fill();
    cr.restore();
}
function ring(cr, current, radius, labelRadius, opacity, flip, fontName, style, strokeColor) {
    const cx = -3;
    const cy = 430;
    for (let value = 0; value < 60; value++) {
        const angle = dialAngle(value, current);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const major = value % 5 === 0;
        const fade = Math.max(0.05, Math.min(1, (cosine + 0.2) / 0.9));
        const length = major ? 26 : 14;
        cr.setSourceRGBA(...strokeColor, opacity * 0.47 * fade);
        cr.setLineWidth(major ? 1.6 : 1.3);
        cr.moveTo(cx + (radius - length) * cosine, cy + (radius - length) * sine);
        cr.lineTo(cx + radius * cosine, cy + radius * sine);
        cr.stroke();
        if (major) {
            text(cr, String(value).padStart(2, '0'), cx + labelRadius * cosine, cy + labelRadius * sine, 27, opacity * 0.53 * fade, flip, fontName, style);
        }
    }
}
function capsule(cr, x, y, width, height) {
    const radius = height / 2;
    cr.newSubPath();
    cr.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
    cr.arc(x + radius, y + radius, radius, Math.PI / 2, Math.PI * 1.5);
    cr.closePath();
}
export function drawClock(cr, width, height, date, options = {}) {
    const { use24Hour = false, showSeconds = true, opacity = 1, flip = false, fontName = 'Sans', fontColor = '#ffffff', fontBold = false, fontSize = 100, strokeColor = '#ffffff' } = options;
    const color = /^#[0-9a-f]{6}$/i.test(fontColor) ? fontColor : '#ffffff';
    const stroke = /^#[0-9a-f]{6}$/i.test(strokeColor) ? strokeColor : '#ffffff';
    const strokeRgb = [1, 3, 5].map(offset => parseInt(stroke.slice(offset, offset + 2), 16) / 255);
    const style = {
        color: [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255),
        bold: fontBold,
        scale: Math.max(50, Math.min(150, fontSize)) / 100,
    };
    const state = clockState(date, use24Hour);
    cr.save();
    cr.scale(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    if (flip) {
        cr.translate(DESIGN_WIDTH, 0);
        cr.scale(-1, 1);
    }
    cr.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    cr.clip();
    if (showSeconds)
        ring(cr, state.secondValue, 352, 308, opacity, flip, fontName, style, strokeRgb);
    cr.save();
    cr.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    capsule(cr, 175, 385, 190, 90);
    cr.setFillRule(Cairo.FillRule.EVEN_ODD);
    cr.clip();
    ring(cr, state.minuteValue, 270, 226, opacity, flip, fontName, style, strokeRgb);
    cr.restore();
    capsule(cr, 175, 385, 190, 90);
    cr.setSourceRGBA(...strokeRgb, 0.10 * opacity);
    cr.setLineWidth(1.8);
    cr.stroke();
    text(cr, state.hour, 80, 430, 116, opacity, flip, fontName, style);
    text(cr, state.minute, 229, 430, 48, opacity, flip, fontName, style);
    cr.restore();
}
