const qrcode = require('../vendor/qrcode.js');

function createCheckInMatrix(token) {
  if (typeof token !== 'string' || !/^\d+\.[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('无效的签到口令');
  const qr = qrcode(0, 'M');
  qr.addData(token);
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, col) => qr.isDark(row, col)));
}

function drawCheckInQr(token, context, size = 240) {
  const matrix = createCheckInMatrix(token);
  const unit = size / (matrix.length + 8);
  context.setFillStyle('#fff');
  context.fillRect(0, 0, size, size);
  context.setFillStyle('#000');
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) context.fillRect(Math.floor((x + 4) * unit), Math.floor((y + 4) * unit),
      Math.ceil((x + 5) * unit) - Math.floor((x + 4) * unit),
      Math.ceil((y + 5) * unit) - Math.floor((y + 4) * unit));
  }));
  context.draw(false);
}

module.exports = { createCheckInMatrix, drawCheckInQr };
