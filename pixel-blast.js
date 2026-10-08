(() => {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('pixel-blast');
  if (!hero || !canvas) return;

  const ctx = canvas.getContext('2d');
  const pointer = { x: innerWidth * .5, y: innerHeight * .5, active: false };
  const ripples = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 1;
  let height = 1;
  let dpr = 1;

  const hash = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.round(innerWidth * dpr));
    height = Math.max(1, Math.round(innerHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  };

  const updatePointer = event => {
    pointer.x = event.clientX * dpr;
    pointer.y = event.clientY * dpr;
    pointer.active = true;
  };

  hero.addEventListener('pointerenter', updatePointer);
  hero.addEventListener('pointermove', updatePointer, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });
  hero.addEventListener('pointerdown', event => {
    ripples.push({ x: event.clientX * dpr, y: event.clientY * dpr, start: performance.now() });
    if (ripples.length > 10) ripples.shift();
  });
  addEventListener('resize', resize, { passive: true });

  const render = now => {
    const time = reducedMotion ? 0 : now * .00025;
    const step = Math.max(15, Math.round(18 * dpr));
    const baseRadius = 2.5 * dpr;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#d43a27';

    for (let y = step * .5; y < height; y += step) {
      for (let x = step * .5; x < width; x += step) {
        const seed = hash(Math.floor(x / step), Math.floor(y / step));
        const flow = (
          Math.sin(x * .012 + time * 3.1) +
          Math.sin(y * .015 - time * 2.2) +
          Math.sin((x + y) * .007 + time * 1.7)
        ) / 3;
        let energy = flow * .42 + seed * .58;
        let dx = 0;
        let dy = 0;
        let rippleEnergy = 0;

        if (pointer.active) {
          const pd = Math.hypot(x - pointer.x, y - pointer.y);
          const influence = Math.max(0, 1 - pd / (190 * dpr));
          if (influence > 0) {
            const wobble = Math.sin(pd * .045 - time * 20) * influence;
            dx += wobble * 8 * dpr;
            dy += Math.cos(pd * .038 - time * 17) * influence * 6 * dpr;
            energy += influence * .16;
          }
        }

        for (let index = ripples.length - 1; index >= 0; index -= 1) {
          const ripple = ripples[index];
          const age = (now - ripple.start) / 1000;
          if (age > 2.6) continue;
          const distance = Math.hypot(x - ripple.x, y - ripple.y);
          const waveRadius = age * 245 * dpr;
          const band = Math.exp(-Math.pow((distance - waveRadius) / (18 * dpr), 2));
          rippleEnergy = Math.max(rippleEnergy, band * Math.exp(-age * .72));
        }

        energy += rippleEnergy * 1.15;
        if (energy < .31) continue;

        const edge = Math.min(x / width, y / height, 1 - x / width, 1 - y / height);
        const edgeFade = Math.min(1, edge / .29);
        const density = Math.min(1, (energy - .31) * 1.85);
        const alpha = (.045 + density * .24 + rippleEnergy * .42) * edgeFade;
        if (alpha < .012) continue;

        const jitter = .85 + seed * .3;
        const radius = baseRadius * jitter * (1 + rippleEnergy * 1.5);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      if (now - ripples[index].start > 2600) ripples.splice(index, 1);
    }
    requestAnimationFrame(render);
  };

  resize();
  requestAnimationFrame(render);
})();
