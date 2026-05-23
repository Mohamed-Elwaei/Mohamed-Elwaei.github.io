/* ───────────────────────────────────────
   main.js — interactivity
   ─────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Highlight nav link on scroll ── */
  const navLinks = document.querySelectorAll('.nav__links a');
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY + 100;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      const link = document.querySelector('.nav__links a[href="#' + id + '"]');

      if (!link) return;

      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(l => l.style.color = '');
        link.style.color = 'var(--accent)';
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  /* ── Reveal sections on scroll ── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    revealObserver.observe(section);
  });

  /* ── Console easter egg ── */
  console.log('%cHey there! 👋', 'font-size: 18px; font-weight: bold; color: #006a4e;');
  console.log('%cInterested in the source? https://github.com/Mohamed-Elwaei', 'font-size: 13px; color: #6b7280;');
})();


/* ── LeetCode solved count ── */
async function loadLeetCodeStats() {
  const sub = document.getElementById('lc-sub');
  if (!sub) return;

  try {
    const res = await fetch('https://leetcode-stats.tashif.codes/Mohammed_Elwaei');
    const data = await res.json();
    if (data.status === 'success') {
      sub.textContent = `${data.totalSolved} solved`;
      document.getElementById('lc-easy').textContent   = data.easySolved;
      document.getElementById('lc-medium').textContent = data.mediumSolved;
      document.getElementById('lc-hard').textContent   = data.hardSolved;
      document.getElementById('lc-breakdown').style.display = 'flex';
    }
  } catch {
    sub.textContent = 'Mohammed_Elwaei';
  }
}

/* ── Chess.com Elo ── */
async function loadChessStats() {
  const sub = document.getElementById('chess-sub');
  if (!sub) return;

  try {
    const res = await fetch('https://api.chess.com/pub/player/mohamed_al-waei/stats');
    const data = await res.json();
    const rapid = data?.chess_rapid?.last?.rating;
    const blitz = data?.chess_blitz?.last?.rating;
    const parts = [];
    if (rapid) parts.push(`Rapid ${rapid}`);
    if (blitz) parts.push(`Blitz ${blitz}`);
    sub.textContent = parts.length ? parts.join(' · ') : 'mohamed_al-waei';
  } catch {
    sub.textContent = 'mohamed_al-waei';
  }
}

loadLeetCodeStats();
loadChessStats();