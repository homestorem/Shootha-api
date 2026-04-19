/**
 * يولّد أيقونة 1024×1024 بمساحة آمنة (padding) لأندرويد Adaptive ولآيفون.
 * المصدر: assets/images/icon.png → assets/images/icon-app-safe.png
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "assets/images/icon.png");
const dst = path.join(root, "assets/images/icon-app-safe.png");

const OUT = 1024;
/** حجم الشعار داخل الإطار (~منطقة آمنة Material) */
const INNER = Math.round(OUT * 0.58);

/** خلفية بيضاء صلبة — شفافية + adaptive أخضر تُظهر «حافة خضراء» حول الأيقونة */
const buf = await sharp(src)
  .resize(INNER, INNER, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

const m = await sharp(buf).metadata();
const w = m.width ?? INNER;
const h = m.height ?? INNER;
const left = Math.floor((OUT - w) / 2);
const top = Math.floor((OUT - h) / 2);

await sharp({
  create: {
    width: OUT,
    height: OUT,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .composite([{ input: buf, left, top }])
  .png()
  .toFile(dst);

console.log("[pad-app-icon] wrote", path.relative(root, dst));
