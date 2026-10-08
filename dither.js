(() => {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('dither-veil');
  const cursor = document.getElementById('cursor');
  if (!hero || !canvas) return;

  const ctx = canvas.getContext('2d');
  const makeCanvas = (read = false) => {
    const element = document.createElement('canvas');
    return { element, context: element.getContext('2d', read ? { willReadFrequently: true } : undefined) };
  };

  const bgSource = makeCanvas();
  const subjectSource = makeCanvas(true);
  const originalSource = makeCanvas();
  const bgSample = makeCanvas(true);
  const subjectSample = makeCanvas(true);
  const bgDots = makeCanvas();
  const subjectDots = makeCanvas();
  const hoverMask = makeCanvas();
  const maskGrid = makeCanvas();
  const subjectReveal = makeCanvas();
  const clickMask = makeCanvas();
  const clickReveal = makeCanvas();

  const cleanBackground = new Image();
  const cutout = new Image();
  const original = new Image();
  const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const BACKGROUND_CONTRAST = 1.4;
  const SUBJECT_CONTRAST = 1;
  const SUBJECT_SCALE = .9;
  const pointer = { x: 0, y: 0, px: 0, py: 0, inside: false, onSubject: false, fresh: true };
  let width = 1;
  let height = 1;
  let dpr = 1;
  let last = performance.now();
  let clickStarted = -Infinity;
  let clickX = 0;
  let clickY = 0;
  let maskCell = 4;
  let maskCols = 1;
  let maskRows = 1;
  let revealField = new Float32Array(1);
  let maskPixels = null;

  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = value => 1 - Math.pow(1 - clamp(value), 3);
  const smoothstep = (a, b, value) => {
    const t = clamp((value - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const coverRect = (iw, ih, w, h) => {
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    return [(w - dw) / 2, (h - dh) / 2, dw, dh];
  };

  const sizeCanvas = (target, w, h) => {
    target.element.width = w;
    target.element.height = h;
  };

  const drawCover = (target, image) => {
    const [x, y, w, h] = coverRect(image.naturalWidth, image.naturalHeight, width, height);
    target.context.clearRect(0, 0, width, height);
    target.context.drawImage(image, x, y, w, h);
  };

  const drawCenteredSubject = target => {
    const [x, y, w, h] = coverRect(cutout.naturalWidth, cutout.naturalHeight, width, height);
    const drawW = w * SUBJECT_SCALE;
    const drawH = h * SUBJECT_SCALE;
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;
    target.context.clearRect(0, 0, width, height);
    target.context.drawImage(cutout, drawX, drawY, drawW, drawH);
  };

  const buildDither = () => {
    const cell = Math.max(4, Math.round(4 * dpr));
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    maskCell = cell;
    maskCols = cols;
    maskRows = rows;
    revealField = new Float32Array(cols * rows);
    sizeCanvas(maskGrid, cols, rows);
    maskPixels = maskGrid.context.createImageData(cols, rows);
    [bgSample, subjectSample, bgDots, subjectDots].forEach(target => sizeCanvas(target, cols, rows));
    bgSample.context.drawImage(bgSource.element, 0, 0, cols, rows);
    subjectSample.context.drawImage(subjectSource.element, 0, 0, cols, rows);

    const bgPixels = bgSample.context.getImageData(0, 0, cols, rows).data;
    const subjectPixels = subjectSample.context.getImageData(0, 0, cols, rows).data;
    const bgOutput = bgDots.context.createImageData(cols, rows);
    const subjectOutput = subjectDots.context.createImageData(cols, rows);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const threshold = (bayer[(y & 3) * 4 + (x & 3)] + .5) / 16;

        const bgLum = (bgPixels[i] * .2126 + bgPixels[i + 1] * .7152 + bgPixels[i + 2] * .0722) / 255;
        const bgGrade = clamp((bgLum - .5) * BACKGROUND_CONTRAST + .5);
        if (.035 + bgGrade * .93 > threshold) {
          bgOutput.data[i] = 247;
          bgOutput.data[i + 1] = 243;
          bgOutput.data[i + 2] = 241;
          bgOutput.data[i + 3] = 228;
        }

        const alpha = subjectPixels[i + 3] / 255;
        if (alpha > .035) {
          const subjectLum = (subjectPixels[i] * .2126 + subjectPixels[i + 1] * .7152 + subjectPixels[i + 2] * .0722) / 255;
          const subjectGrade = clamp((subjectLum - .5) * SUBJECT_CONTRAST + .5);
          if (.06 + subjectGrade * .94 > threshold) {
            subjectOutput.data[i] = 226;
            subjectOutput.data[i + 1] = 48;
            subjectOutput.data[i + 2] = 37;
            subjectOutput.data[i + 3] = Math.round(alpha * 255);
          }
        }
      }
    }

    bgDots.context.putImageData(bgOutput, 0, 0);
    subjectDots.context.putImageData(subjectOutput, 0, 0);
  };

  const layout = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.round(innerWidth * dpr));
    height = Math.max(1, Math.round(innerHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    [bgSource, subjectSource, originalSource, hoverMask, subjectReveal, clickMask, clickReveal].forEach(target => sizeCanvas(target, width, height));
    drawCover(bgSource, cleanBackground);
    drawCenteredSubject(subjectSource);
    originalSource.context.clearRect(0, 0, width, height);
    originalSource.context.drawImage(bgSource.element, 0, 0);
    originalSource.context.drawImage(subjectSource.element, 0, 0);
    buildDither();
  };

  const updateDissolveMask = dt => {
    const fade = dt / .95;
    for (let i = 0; i < revealField.length; i++) {
      revealField[i] = Math.max(0, revealField[i] - fade);
    }

    if (pointer.inside) {
      const follow = 1 - Math.exp(-dt / .035);
      pointer.px += (pointer.x - pointer.px) * follow;
      pointer.py += (pointer.y - pointer.py) * follow;
      const cx = pointer.px * dpr;
      const cy = pointer.py * dpr;
      const radius = 195 * dpr;
      const minX = Math.max(0, Math.floor((cx - radius) / maskCell));
      const maxX = Math.min(maskCols - 1, Math.ceil((cx + radius) / maskCell));
      const minY = Math.max(0, Math.floor((cy - radius) / maskCell));
      const maxY = Math.min(maskRows - 1, Math.ceil((cy + radius) / maskCell));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = (x + .5) * maskCell;
          const py = (y + .5) * maskCell;
          const distance = Math.hypot(px - cx, py - cy) / radius;
          const strength = 1 - smoothstep(.54, 1, distance);
          const index = y * maskCols + x;
          revealField[index] = Math.max(revealField[index], strength);
        }
      }
    }

    const pixels = maskPixels.data;
    for (let y = 0; y < maskRows; y++) {
      for (let x = 0; x < maskCols; x++) {
        const index = y * maskCols + x;
        const p = index * 4;
        const signal = revealField[index];
        const threshold = (bayer[(y & 3) * 4 + (x & 3)] + .5) / 16;
        const alpha = signal <= .001 ? 0 : signal >= .985 ? 1 : clamp((signal - threshold + .08) / .18);
        pixels[p] = 255;
        pixels[p + 1] = 255;
        pixels[p + 2] = 255;
        pixels[p + 3] = Math.round(alpha * 255);
      }
    }
    maskGrid.context.putImageData(maskPixels, 0, 0);
    hoverMask.context.clearRect(0, 0, width, height);
    hoverMask.context.imageSmoothingEnabled = false;
    hoverMask.context.drawImage(maskGrid.element, 0, 0, width, height);
  };

  const drawClickMask = now => {
    const age = now - clickStarted;
    clickMask.context.clearRect(0, 0, width, height);
    if (age < 0 || age > 1900) return false;

    const cx = clickX * dpr;
    const cy = clickY * dpr;
    const farthestX = Math.max(cx, width - cx);
    const farthestY = Math.max(cy, height - cy);
    const maxRadius = Math.hypot(farthestX, farthestY) + 90 * dpr;
    const expansion = smoothstep(0, 1, Math.min(1, age / 500));
    const radius = Math.max(2, maxRadius * expansion);
    const fadeOut = age < 900 ? 1 : 1 - ease((age - 900) / 1000);
    const feather = Math.min(radius * .42, 86 * dpr);
    const innerStop = Math.max(0, (radius - feather) / radius);
    const gradient = clickMask.context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${fadeOut})`);
    gradient.addColorStop(innerStop, `rgba(255,255,255,${fadeOut})`);
    gradient.addColorStop(Math.min(1, innerStop + (1 - innerStop) * .62), `rgba(255,255,255,${fadeOut * .62})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    clickMask.context.fillStyle = gradient;
    clickMask.context.beginPath();
    clickMask.context.arc(cx, cy, radius, 0, Math.PI * 2);
    clickMask.context.fill();
    return true;
  };

  const render = now => {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;

    updateDissolveMask(dt);

    const hasClickReveal = drawClickMask(now);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(subjectDots.element, 0, 0, width, height);

    subjectReveal.context.clearRect(0, 0, width, height);
    subjectReveal.context.globalCompositeOperation = 'source-over';
    subjectReveal.context.drawImage(subjectSource.element, 0, 0);
    subjectReveal.context.globalCompositeOperation = 'destination-in';
    subjectReveal.context.drawImage(hoverMask.element, 0, 0);
    subjectReveal.context.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(subjectReveal.element, 0, 0);
    ctx.restore();
    ctx.drawImage(subjectReveal.element, 0, 0);

    if (hasClickReveal) {
      clickReveal.context.clearRect(0, 0, width, height);
      clickReveal.context.globalCompositeOperation = 'source-over';
      clickReveal.context.drawImage(originalSource.element, 0, 0);
      clickReveal.context.globalCompositeOperation = 'destination-in';
      clickReveal.context.drawImage(clickMask.element, 0, 0);
      clickReveal.context.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(clickMask.element, 0, 0);
      ctx.restore();
      ctx.drawImage(clickReveal.element, 0, 0);
    }
    requestAnimationFrame(render);
  };

  const updatePointer = event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointer.fresh) {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.fresh = false;
    }
    const sx = Math.max(0, Math.min(width - 1, Math.floor(pointer.x * dpr)));
    const sy = Math.max(0, Math.min(height - 1, Math.floor(pointer.y * dpr)));
    pointer.onSubject = subjectSource.context.getImageData(sx, sy, 1, 1).data[3] > 24;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.style.borderColor = pointer.onSubject ? 'rgba(255,80,65,.9)' : 'rgba(245,242,240,.58)';
  };

  hero.addEventListener('pointerenter', event => {
    pointer.inside = true;
    pointer.fresh = true;
    hero.classList.add('has-pointer');
    updatePointer(event);
  });
  hero.addEventListener('pointermove', event => {
    pointer.inside = true;
    hero.classList.add('has-pointer');
    updatePointer(event);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.onSubject = false;
    pointer.fresh = true;
    hero.classList.remove('has-pointer', 'is-pressing');
  });
  hero.addEventListener('pointerdown', event => {
    updatePointer(event);
    clickX = event.clientX;
    clickY = event.clientY;
    clickStarted = performance.now();
    hero.classList.add('is-pressing');
  });
  hero.addEventListener('pointerup', () => hero.classList.remove('is-pressing'));
  window.addEventListener('resize', layout, { passive: true });

  const load = (image, src) => new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = src;
  });

  Promise.all([
    load(cleanBackground, './assets/clown-scene-clean.png'),
    load(cutout, './assets/clown-cutout.png'),
    load(original, './assets/clown-scene.png')
  ]).then(() => {
    layout();
    requestAnimationFrame(render);
  }).catch(error => console.error('Dither assets failed to load', error));
})();
