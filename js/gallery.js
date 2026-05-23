/* ───────────────────────────────────────
   gallery.js — Drive API, albums, lightbox
   ─────────────────────────────────────── */

(function () {
  'use strict';

  const API_KEY = 'AIzaSyCxfQ4CVYShgRHpmtYmgA95za5D_7AZ71A';
  const ROOT_ID = '1JUCr_uKeLQuZN7MTBEqcooH2aD0gADfT';
  const BATCH   = 18;

  /* ── Lightbox state ── */
  let lbFiles     = [];
  let lbIndex     = 0;
  let lbAlbumName = '';

  /* ══════════════════════════════════════
     Drive API helper
  ══════════════════════════════════════ */
  async function driveList(query, pageToken = null) {
    let url = 'https://www.googleapis.com/drive/v3/files'
      + `?q=${encodeURIComponent(query)}`
      + '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType)')
      + '&pageSize=100'
      + '&orderBy=name'
      + `&key=${API_KEY}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const res  = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  /* ── URL helpers ── */
  function thumbUrl(id)  { return `https://drive.google.com/thumbnail?id=${id}&sz=w800`; }
  function imageUrl(id)  { return `https://lh3.googleusercontent.com/d/${id}`; }
  function videoUrl(id)  { return `https://drive.google.com/file/d/${id}/preview`; }

  /* ══════════════════════════════════════
     Bootstrap: fetch subfolders
  ══════════════════════════════════════ */
  async function init() {
    const container = document.getElementById('albums-container');

    try {
      const data = await driveList(
        `'${ROOT_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      const folders = data.files || [];

      container.innerHTML = '';

      if (folders.length === 0) {
        container.innerHTML = '<div class="gallery-error">No albums found.<br><small>Make sure the folder is shared as "Anyone with the link".</small></div>';
        return;
      }

      folders.forEach(folder => buildAlbum(folder, container));

    } catch (err) {
      container.innerHTML = `<div class="gallery-error">Could not load gallery: ${err.message}<br><small>Make sure the folder is shared publicly.</small></div>`;
    }
  }

  /* ══════════════════════════════════════
     Build one album accordion
  ══════════════════════════════════════ */
  function buildAlbum(folder, container) {
    const state = {
      folderId:      folder.id,
      folderName:    folder.name,
      files:         [],
      rendered:      0,
      nextPageToken: null,
      fetchedAll:    false,
      loading:       false,
    };

    /* ── Create DOM ── */
    const album = document.createElement('div');
    album.className = 'album';
    album.innerHTML = `
      <div class="album__header" id="hdr-${folder.id}">
        <div class="album__header-left">
          <svg class="album__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="album__name">${folder.name}</span>
          <span class="album__count" id="cnt-${folder.id}">—</span>
        </div>
        <svg class="album__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="album__body" id="body-${folder.id}">
        <div class="album-grid" id="grid-${folder.id}"></div>
        <div class="album__load-more" id="more-${folder.id}" style="display:none;">
          <button class="album__load-btn" id="btn-${folder.id}">Load more</button>
        </div>
        <div class="album__end" id="end-${folder.id}" style="display:none;">— end of album —</div>
      </div>
    `;
    container.appendChild(album);

    const header   = album.querySelector(`#hdr-${folder.id}`);
    const body     = album.querySelector(`#body-${folder.id}`);
    const grid     = album.querySelector(`#grid-${folder.id}`);
    const moreDiv  = album.querySelector(`#more-${folder.id}`);
    const btn      = album.querySelector(`#btn-${folder.id}`);
    const endDiv   = album.querySelector(`#end-${folder.id}`);
    const countEl  = album.querySelector(`#cnt-${folder.id}`);

    /* ── Toggle open / close ── */
    header.addEventListener('click', async () => {
      const isOpen = body.classList.contains('open');
      if (isOpen) {
        body.classList.remove('open');
        header.classList.remove('open');
      } else {
        body.classList.add('open');
        header.classList.add('open');
        if (state.files.length === 0 && !state.fetchedAll) {
          await fetchAndRender(state, grid, moreDiv, btn, endDiv, countEl);
        }
      }
    });

    /* ── Load more ── */
    btn.addEventListener('click', async () => {
      if (state.rendered < state.files.length) {
        renderBatch(state, grid, moreDiv, btn, endDiv);
      } else if (!state.fetchedAll) {
        await fetchAndRender(state, grid, moreDiv, btn, endDiv, countEl);
      }
    });
  }

  /* ══════════════════════════════════════
     Fetch next page from Drive
  ══════════════════════════════════════ */
  async function fetchAndRender(state, grid, moreDiv, btn, endDiv, countEl) {
    if (state.loading || state.fetchedAll) return;
    state.loading = true;
    btn.disabled  = true;
    btn.innerHTML = '<span class="album__spinner"></span> Loading…';

    try {
      const data = await driveList(
        `'${state.folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
        state.nextPageToken
      );

      state.files.push(...(data.files || []));
      state.nextPageToken = data.nextPageToken || null;
      if (!state.nextPageToken) state.fetchedAll = true;

      if (countEl) {
        countEl.textContent = state.fetchedAll
          ? `${state.files.length} items`
          : `${state.files.length}+ items`;
      }

      renderBatch(state, grid, moreDiv, btn, endDiv);

    } catch (err) {
      btn.innerHTML = 'Error — tap to retry';
      btn.disabled  = false;
      console.error('Gallery fetch error:', err);
    }

    state.loading = false;
  }

  /* ══════════════════════════════════════
     Render a batch of items into the grid
  ══════════════════════════════════════ */
  function renderBatch(state, grid, moreDiv, btn, endDiv) {
    const slice = state.files.slice(state.rendered, state.rendered + BATCH);

    slice.forEach((file, i) => {
      const globalIndex = state.rendered + i;
      const isVideo     = file.mimeType.startsWith('video/');

      const item = document.createElement('div');
      item.className = 'gallery-item';

      /* Thumbnail — videos also have a Drive-generated thumb */
      item.innerHTML = `
        <img
          src="${thumbUrl(file.id)}"
          alt="${file.name}"
          loading="lazy"
          onerror="this.style.minHeight='120px'"
        />
        ${isVideo ? '<span class="gallery-item__badge">VIDEO</span>' : ''}
        <div class="gallery-item__overlay">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isVideo
              ? '<polygon points="5 3 19 12 5 21 5 3"/>'
              : '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'}
          </svg>
        </div>
      `;

      item.addEventListener('click', () => {
        lbFiles     = state.files;
        lbIndex     = globalIndex;
        lbAlbumName = state.folderName;
        openLightbox();
      });

      grid.appendChild(item);
    });

    state.rendered += slice.length;

    const hasMore = state.rendered < state.files.length || !state.fetchedAll;
    if (hasMore) {
      moreDiv.style.display = 'block';
      btn.innerHTML = 'Load more';
      btn.disabled  = false;
      endDiv.style.display = 'none';
    } else {
      moreDiv.style.display = 'none';
      endDiv.style.display  = state.files.length > 0 ? 'block' : 'none';
    }
  }

  /* ══════════════════════════════════════
     Lightbox
  ══════════════════════════════════════ */
  function openLightbox() {
    renderLbItem();
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
    const inner = document.getElementById('lb-inner');
    /* Stop any playing iframe/video */
    const iframe = inner.querySelector('iframe');
    if (iframe) iframe.src = '';
    inner.innerHTML = '';
  }

  function renderLbItem() {
    const file    = lbFiles[lbIndex];
    if (!file) return;

    const inner   = document.getElementById('lb-inner');
    const isVideo = file.mimeType.startsWith('video/');

    /* Show spinner while loading */
    inner.innerHTML = `
      <div class="lightbox__loading">
        <div class="lightbox__loading-spinner"></div>
        Loading…
      </div>`;

    if (isVideo) {
      /* Use an iframe embed — avoids CORS issues with direct video URLs */
      inner.innerHTML = `
        <iframe
          src="${videoUrl(file.id)}"
          width="860"
          height="540"
          style="max-width:90vw;max-height:80vh;border:none;border-radius:var(--radius-lg);"
          allow="autoplay"
          allowfullscreen>
        </iframe>`;
    } else {
      const img = new Image();
      img.alt   = file.name;
      img.style.cssText = 'max-width:90vw;max-height:88vh;border-radius:var(--radius-lg);object-fit:contain;box-shadow:0 24px 80px rgba(0,0,0,0.6);';

      img.onload = () => { inner.innerHTML = ''; inner.appendChild(img); };
      img.onerror = () => {
        /* fallback to thumbnail if full-res fails */
        inner.innerHTML = `<img src="${thumbUrl(file.id)}" alt="${file.name}"
          style="max-width:90vw;max-height:88vh;border-radius:var(--radius-lg);object-fit:contain;" />`;
      };
      img.src = imageUrl(file.id);
    }

    document.getElementById('lb-album').textContent   = lbAlbumName;
    document.getElementById('lb-counter').textContent = `${lbIndex + 1} / ${lbFiles.length}`;
  }

  /* ── Lightbox controls ── */
  function lbPrev() { lbIndex = (lbIndex - 1 + lbFiles.length) % lbFiles.length; renderLbItem(); }
  function lbNext() { lbIndex = (lbIndex + 1) % lbFiles.length; renderLbItem(); }

  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', lbPrev);
  document.getElementById('lb-next').addEventListener('click', lbNext);

  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   lbPrev();
    if (e.key === 'ArrowRight')  lbNext();
  });

  /* ── Kick off ── */
  init();

})();
