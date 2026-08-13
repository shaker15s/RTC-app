/* Decorative ambient canvas; pauses off-screen and for reduced motion. */
// Ambient Background Particle Canvas
(function initAmbientCanvas() {
  const canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  let animId = null;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const particles = Array.from({ length: 28 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 2 + 1,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.3) * 0.3,
    alpha: Math.random() * 0.5 + 0.2
  }));

  function draw() {
    if (document.hidden || prefersReduced.matches) return;
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(137, 245, 231, ${p.alpha})`;
      ctx.fill();
    });
    animId = requestAnimationFrame(draw);
  }

  function startOrStop() {
    if (document.hidden || prefersReduced.matches) {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      ctx.clearRect(0, 0, width, height);
    } else {
      if (!animId) draw();
    }
  }

  document.addEventListener('visibilitychange', startOrStop);
  if (prefersReduced.addEventListener) {
    prefersReduced.addEventListener('change', startOrStop);
  }
  startOrStop();
})();
