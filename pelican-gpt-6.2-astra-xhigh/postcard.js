// Printed details are drawn locally so the postcard also works offline.
export function printDetails() {
  const grain = document.createElement('canvas');
  grain.width = grain.height = 144;
  const gc = grain.getContext('2d'), data = gc.createImageData(144, 144);
  let state = 493;
  for (let i = 0; i < data.data.length; i += 4) {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    const tone = state >>> 24;
    data.data.set([tone, tone, tone, 255], i);
  }
  gc.putImageData(data, 0, 0);
  document.querySelector('.grain').style.backgroundImage = 'url(' + grain.toDataURL() + ')';
  const ctx = document.querySelector('#postage').getContext('2d');
  ctx.scale(2, 2);
  const ink = '#315c5b', paper = '#fff1cd', green = '#54867e';
  ctx.save();
  ctx.translate(151, 64);
  ctx.rotate(0.048);
  ctx.translate(-52, -59);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 104, 118);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 4; i < 104; i += 8) {
    for (const y of [0, 118]) {
      ctx.beginPath();
      ctx.arc(i, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 4; i < 118; i += 8) {
    for (const x of [0, 104]) {
      ctx.beginPath();
      ctx.arc(x, i, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = green;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(6.5, 6.5, 91, 105);
  ctx.fillStyle = green;
  ctx.fillRect(9, 9, 86, 100);
  ctx.strokeStyle = paper;
  ctx.lineWidth = 0.65;
  ctx.strokeRect(11, 11, 82, 96);
  ctx.fillStyle = paper;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COASTAL POST', 52, 22);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 13; i++) {
    const y = 28 + i * 3;
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(88, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = paper;
  ctx.arc(68, 46, 11, 0, Math.PI * 2);
  ctx.fill();
  // The small engraved pelican flies across the printed sun.
  ctx.beginPath();
  ctx.moveTo(17, 63);
  ctx.bezierCurveTo(26, 58, 36, 56, 44, 55);
  ctx.bezierCurveTo(37, 46, 34, 34, 36, 28);
  ctx.bezierCurveTo(40, 39, 46, 44, 56, 50);
  ctx.bezierCurveTo(62, 47, 66, 44, 70, 46);
  ctx.lineTo(74, 49);
  ctx.lineTo(89, 50);
  ctx.lineTo(75, 53);
  ctx.bezierCurveTo(69, 57, 63, 55, 58, 56);
  ctx.bezierCurveTo(50, 65, 40, 69, 29, 72);
  ctx.lineTo(36, 65);
  ctx.lineTo(25, 68);
  ctx.lineTo(32, 62);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const y = 76 + i * 2.8;
    ctx.beginPath();
    for (let x = 15; x <= 89; x += 2) {
      const v = y + Math.sin(x * 0.12 + i) * 1.2;
      if (x === 15)
        ctx.moveTo(x, v);
      else
        ctx.lineTo(x, v);
    }
    ctx.strokeStyle = paper;
    ctx.lineWidth = 0.65;
    ctx.stroke();
  }
  ctx.fillStyle = paper;
  ctx.fillRect(13, 92, 78, 12);
  ctx.fillStyle = ink;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('AIR  MAIL', 17, 101);
  ctx.font = 'bold 12px Georgia';
  ctx.textAlign = 'right';
  ctx.fillText('25¢', 87, 102);
  ctx.restore();
  ctx.save();
  ctx.translate(72, 76);
  ctx.rotate(-0.17);
  ctx.strokeStyle = 'rgba(51,85,77,.7)';
  ctx.fillStyle = 'rgba(51,85,77,.75)';
  ctx.lineWidth = 1.4;
  for (const r of [25, 21]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  const text = 'SALTWIND';
  for (let i = 0; i < text.length; i++) {
    const a = (i - (text.length - 1) / 2) * 0.195;
    ctx.save();
    ctx.rotate(a);
    ctx.fillText(text[i], 0, -14);
    ctx.restore();
  }
  ctx.font = 'bold 8px monospace';
  ctx.fillText('SEA POST', 0, 2);
  ctx.fillRect(-15, 5, 30, 0.7);
  ctx.font = 'bold 6px monospace';
  ctx.fillText('ROUTE 01', 0, 13);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let x = -66; x < -22; x += 2) {
      const y = -7 + i * 5 + 2.6 * Math.sin(x * 0.15);
      if (x === -66)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
