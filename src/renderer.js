import Cairo from 'cairo';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import {clockState, dialAngle, DESIGN_WIDTH, DESIGN_HEIGHT} from './model.js';

function text(cr, value, x, y, size, alpha) {
    const layout = PangoCairo.create_layout(cr);
    const font = Pango.FontDescription.from_string('Sans');
    font.set_absolute_size(size * Pango.SCALE);
    layout.set_font_description(font);
    layout.set_text(value, -1);
    const [ink] = layout.get_pixel_extents();
    cr.setSourceRGBA(1, 1, 1, alpha);
    cr.moveTo(x - ink.width / 2 - ink.x, y - ink.height / 2 - ink.y);
    // Fill outlines, avoiding subpixel-colored glyph edges on transparency.
    PangoCairo.layout_path(cr, layout);
    cr.fill();
}

function ring(cr, current, radius, labelRadius, opacity) {
    const cx = -3;
    const cy = 430;
    for (let value = 0; value < 60; value++) {
        const angle = dialAngle(value, current);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const major = value % 5 === 0;
        // The hidden left half fades away, rather than ending abruptly.
        const fade = Math.max(0.05, Math.min(1, (cosine + 0.2) / 0.9));
        const length = major ? 26 : 14;
        cr.setSourceRGBA(1, 1, 1, opacity * 0.47 * fade);
        cr.setLineWidth(major ? 1.6 : 1.3);
        cr.moveTo(cx + (radius - length) * cosine, cy + (radius - length) * sine);
        cr.lineTo(cx + radius * cosine, cy + radius * sine);
        cr.stroke();
        if (major) {
            text(cr, String(value).padStart(2, '0'),
                cx + labelRadius * cosine, cy + labelRadius * sine,
                27, opacity * 0.53 * fade);
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

// No GTK/Shell dependencies: exactly the same renderer runs in the widget
// and in the offscreen GJS/Cairo render test.
export function drawClock(cr, width, height, date, options = {}) {
    const {use24Hour = false, showSeconds = true, opacity = 1} = options;
    const state = clockState(date, use24Hour);
    cr.save();
    cr.scale(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    cr.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    cr.clip();
    if (showSeconds)
        ring(cr, state.secondValue, 352, 308, opacity);
    ring(cr, state.minuteValue, 270, 226, opacity);

    // A subtle dark glass pill is the only background: wallpaper remains visible.
    capsule(cr, 175, 385, 190, 90);
    // Remove dial pixels inside the glass instead of letting them bleed through.
    cr.setOperator(Cairo.Operator.CLEAR);
    cr.fillPreserve();
    cr.setOperator(Cairo.Operator.OVER);
    cr.setSourceRGBA(0.015, 0.015, 0.018, 0.88 * opacity);
    cr.fillPreserve();
    cr.setSourceRGBA(1, 1, 1, 0.10 * opacity);
    cr.setLineWidth(1.8);
    cr.stroke();
    text(cr, state.hour, 80, 430, 116, opacity);
    text(cr, state.minute, 229, 430, 48, opacity);
    cr.restore();
}
