(() => {
  const hero = document.getElementById('hero');
  const targets = [...document.querySelectorAll('.spotlight-text')];
  if (!hero || !targets.length) return;

  const pointer = {
    x: innerWidth * .3,
    y: innerHeight * .55,
    tx: innerWidth * .3,
    ty: innerHeight * .55
  };

  const updateTarget = event => {
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
  };

  hero.addEventListener('pointerenter', updateTarget);
  hero.addEventListener('pointermove', updateTarget, { passive: true });

  const render = () => {
    pointer.x += (pointer.tx - pointer.x) * .2;
    pointer.y += (pointer.ty - pointer.y) * .2;

    targets.forEach(target => {
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--light-x', `${(pointer.x - rect.left).toFixed(1)}px`);
      target.style.setProperty('--light-y', `${(pointer.y - rect.top).toFixed(1)}px`);
    });

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
})();
