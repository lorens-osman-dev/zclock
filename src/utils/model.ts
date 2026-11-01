// This module deliberately has no GNOME/GI imports. Keeping the clock's math
// separate from drawing and Shell makes edge cases testable with plain Node.

// All drawing coordinates use this reference canvas. Resizing scales that
// canvas uniformly instead of independently repositioning every tick and label.
export const DESIGN_WIDTH = 640;
export const DESIGN_HEIGHT = 860;

// There are 60 evenly spaced marks in one revolution (2π / 60 = π / 30).
// Subtracting the mark from the current time puts the selected value at angle
// zero, pointing right. Larger values lie above it, like the reference image.
// Don't round `current`: the fractional part is what makes the dial sweep.
// A rollover changes the angle by 2π, which is the SAME screen position.
export function dialAngle(value: number, current: number): number {
    return (current - value) * Math.PI / 30;
}

// Positions are percentages of the FREE SPACE, not of the screen dimensions.
// This means 100% aligns the widget's far edge with the monitor's far edge,
// rather than putting its origin there and cutting most of the clock off.
export function widgetBounds(area: Rectangle, requestedHeight: number, xPercent: number, yPercent: number): Rectangle {
    // Constrain both dimensions while preserving the reference aspect ratio.
    // Work areas already exclude panels/docks. Their origins can be negative
    // when another monitor is positioned to the left of the primary display.
    const height = Math.max(1, Math.min(requestedHeight, area.height,
        area.width * DESIGN_HEIGHT / DESIGN_WIDTH));
    const width = Math.round(height * DESIGN_WIDTH / DESIGN_HEIGHT);
    const fraction = (value: number) => Math.max(0, Math.min(100, value)) / 100;
    return {
        x: Math.round(area.x + (area.width - width) * fraction(xPercent)),
        y: Math.round(area.y + (area.height - height) * fraction(yPercent)),
        width,
        height: Math.round(height),
    };
}

// Derive every value from ONE local-time snapshot. Using separate Date objects
// for the hour and minute could briefly show inconsistent values at a rollover.
export function clockState(date: Date, use24Hour = false): ClockState {
    const hours = date.getHours();
    // Milliseconds make seconds continuous between whole-second boundaries.
    // Feed that same fraction into minutes, so the inner dial also creeps
    // forward smoothly instead of advancing once every second.
    const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
    return {
        // Midnight/noon are 12 in 12-hour format; 24-hour format keeps 00–23.
        hour: String(use24Hour ? hours : hours % 12 || 12).padStart(use24Hour ? 2 : 1, '0'),
        // Digital text still changes only at the actual minute boundary.
        minute: String(date.getMinutes()).padStart(2, '0'),
        minuteValue: date.getMinutes() + seconds / 60,
        secondValue: seconds,
    };
}

export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ClockState {
    hour: string;
    minute: string;
    minuteValue: number;
    secondValue: number;
}
