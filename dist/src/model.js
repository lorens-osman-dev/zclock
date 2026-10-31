export const DESIGN_WIDTH = 640;
export const DESIGN_HEIGHT = 860;
export function dialAngle(value, current) {
    return (current - value) * Math.PI / 30;
}
export function widgetBounds(area, requestedHeight, xPercent, yPercent) {
    const height = Math.max(1, Math.min(requestedHeight, area.height, area.width * DESIGN_HEIGHT / DESIGN_WIDTH));
    const width = Math.round(height * DESIGN_WIDTH / DESIGN_HEIGHT);
    const fraction = (value) => Math.max(0, Math.min(100, value)) / 100;
    return {
        x: Math.round(area.x + (area.width - width) * fraction(xPercent)),
        y: Math.round(area.y + (area.height - height) * fraction(yPercent)),
        width,
        height: Math.round(height),
    };
}
export function clockState(date, use24Hour = false) {
    const hours = date.getHours();
    const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
    return {
        hour: String(use24Hour ? hours : hours % 12 || 12).padStart(use24Hour ? 2 : 1, '0'),
        minute: String(date.getMinutes()).padStart(2, '0'),
        minuteValue: date.getMinutes() + seconds / 60,
        secondValue: seconds,
    };
}
