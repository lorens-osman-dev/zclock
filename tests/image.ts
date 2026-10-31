import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';

export type Box = readonly [left: number, top: number, right: number, bottom: number];
export type Pixel = readonly [red: number, green: number, blue: number, alpha: number];

export function readImage(path: string): PNG {
    return PNG.sync.read(readFileSync(path));
}

export function pixel(image: PNG, x: number, y: number): Pixel {
    const offset = (y * image.width + x) * 4;
    return [image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]];
}

export function pixels(image: PNG, box: Box = [0, 0, image.width, image.height]): Pixel[] {
    const result: Pixel[] = [];
    for (let y = box[1]; y < box[3]; y++) {
        for (let x = box[0]; x < box[2]; x++)
            result.push(pixel(image, x, y));
    }
    return result;
}

export function equalPixels(a: PNG, b: PNG, box: Box = [0, 0, a.width, a.height], channels: readonly number[] = [0, 1, 2, 3]): boolean {
    if (a.width !== b.width || a.height !== b.height) return false;
    for (let y = box[1]; y < box[3]; y++) {
        for (let x = box[0]; x < box[2]; x++) {
            const offset = (y * a.width + x) * 4;
            for (const channel of channels) {
                if (a.data[offset + channel] !== b.data[offset + channel]) return false;
            }
        }
    }
    return true;
}

export function alphaSum(image: PNG, box: Box): number {
    return pixels(image, box).reduce((sum, value) => sum + value[3], 0);
}

export function inkHeight(image: PNG, box: Box): number {
    let top = box[3];
    let bottom = box[1] - 1;
    for (let y = box[1]; y < box[3]; y++) {
        for (let x = box[0]; x < box[2]; x++) {
            if (pixel(image, x, y)[3] > 0) {
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
            }
        }
    }
    return Math.max(0, bottom - top + 1);
}

export function compositeBlack(image: PNG): PNG {
    const result = new PNG({width: image.width, height: image.height});
    for (let offset = 0; offset < image.data.length; offset += 4) {
        const alpha = image.data[offset + 3] / 255;
        for (let channel = 0; channel < 3; channel++)
            result.data[offset + channel] = Math.round(image.data[offset + channel] * alpha);
        result.data[offset + 3] = 255;
    }
    return result;
}
