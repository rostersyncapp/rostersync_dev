
export function hexToRgb(hex?: string): string {
    if (!hex || hex.length < 6) return "";
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? "" : `${r}, ${g}, ${b}`;
}

export function padJersey(num: string | number): string {
    const s = String(num).replace(/[^0-9]/g, '');
    if (!s) return String(num); // return original if not numeric
    return s.padStart(2, '0');
}
