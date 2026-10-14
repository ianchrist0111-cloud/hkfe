export function downloadReceiptImage(options: {
  title: string;
  filename: string;
  rows: Array<[string, string]>;
}) {
  const width = 680;
  const pad = 32;
  const rowH = 42;
  const height = 132 + options.rows.length * rowH + 56;
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = dark ? '#10151c' : '#ffffff';
  const ink = dark ? '#f4f7fb' : '#12171f';
  const muted = dark ? '#8b97a8' : '#5c6775';
  const line = dark ? '#243040' : '#e6ebf1';
  const accent = '#00a87a';

  ctx.scale(dpr, dpr);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 8);

  ctx.fillStyle = accent;
  ctx.font = '800 20px sans-serif';
  ctx.fillText('HKFES', pad, 48);
  ctx.fillStyle = ink;
  ctx.font = '700 18px sans-serif';
  ctx.fillText(options.title, pad, 80);

  options.rows.forEach(([label, value], index) => {
    const y = 118 + index * rowH;
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(pad, y + 14);
    ctx.lineTo(width - pad, y + 14);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '13px sans-serif';
    ctx.fillText(label, pad, y);
    ctx.fillStyle = ink;
    ctx.font = '600 14px sans-serif';
    const text = value.length > 46 ? `${value.slice(0, 20)}…${value.slice(-18)}` : value;
    const measured = ctx.measureText(text).width;
    ctx.fillText(text, Math.max(pad + 180, width - pad - measured), y);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = options.filename;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function readScreenshotFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image screenshot.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('That screenshot is larger than 8 MB.'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxEdge = 1280;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that screenshot.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that screenshot.'));
    };
    img.src = url;
  });
}
