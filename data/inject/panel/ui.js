'use strict';

const tItem = document.getElementById('template-item');
const tPage = document.getElementById('template-page');
const items = document.getElementById('items');
const toolbar = document.getElementById('toolbar');

function page() {
  toolbar.textContent = '';
  const a = items.querySelector('a:last-of-type');
  if (a) {
    const pages = Math.floor(
      a.getBoundingClientRect().left / window.innerWidth
    ) + 1;
    for (let i = 1; i <= pages; i += 1) {
      const item = document.importNode(tPage.content, true);
      item.querySelector('label').textContent = i;
      item.querySelector('label').setAttribute('for', 'page-' + i);
      item.querySelector('input').id = 'page-' + i;
      item.querySelector('input').checked = i === 1;
      toolbar.appendChild(item);
    }
  }
}
window.addEventListener('resize', page);

function size(o) {
  const format = (bytes, si) => {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }
    const units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let u = -1;
    do {
      bytes /= thresh;
      u += 1;
    }
    while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + units[u];
  };

  const next = s => {
    const bytes = Number(s);
    if (isNaN(bytes)) {
      return 0;
    }
    else {
      return format(bytes, false);
    }
  };
  if (o.contentLength) {
    return Promise.resolve(next(o.contentLength));
  }
  else {
    const controller = new AbortController();
    const signal = controller.signal;
    return fetch(o.url, {
      signal
    }).then(response => {
      controller.abort();
      return next(response.headers.get('Content-Length'));
    });
  }
}

function build(o) {
  document.body.dataset.loading = false;
  o.formats.forEach(format => {
    let item = document.importNode(tItem.content, true);

    // normal stream
    if (format.mimeType.startsWith('video/') && format.audioBitrate) {
      const a = format.codecs.split(', ').pop().split('.').shift().toUpperCase();
      item.querySelector('span:nth-child(2)').textContent =
        format.container.toUpperCase() + ' ' + format.qualityLabel + ' - ' + a + ' ' + format.audioBitrate + 'K';
    }
    // video only
    else if (format.mimeType.startsWith('video/')) {
      item.querySelector('span:nth-child(2)').textContent =
        format.container.toUpperCase() + ' ' + format.qualityLabel + ' - video-only';
      item.querySelector('img').src = 'video-only.svg';
      item.querySelector('a').dash = 'v';
    }
    // audio only
    else {
      const a = format.codecs.split('.').shift().toUpperCase();
      item.querySelector('span:nth-child(2)').textContent =
        format.container.toUpperCase() + ' audio-only - ' + a + ' ' + format.audioBitrate + 'K';
      item.querySelector('img').src = 'audio-only.svg';
      item.querySelector('a').dash = 'a';
    }

    item.querySelector('a').href = format.url;
    item.querySelector('a').download = o.videoDetails.title + '.' + format.container;
    item.querySelector('a').format = format;
    item.querySelector('a').dataset.itag = format.itag;

    const e = item.querySelector('span:last-of-type');
    if (Array.isArray(format.url)) {
      e.textContent = `Segments (${format.url.length})`;
    }
    else {
      size(format).then(
        size => e.textContent = size,
        () => e.textContent = 'NA'
      );
    }

    item = items.appendChild(item);
  });
  items.o = o;

  page();
}

document.addEventListener('change', e => {
  const id = /\d+/.exec(e.target.id);
  if (id) {
    items.style = `transform: translate(-${100 * (id[0] - 1)}%, 0)`;
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'progress') {
    const a = document.querySelector(`a[data-itag="${request.itag}"]`);
    a.dataset.disabled = true;
    if (a) {
      const {current, total, real} = request.progress;
      if (current === total) {
        a.querySelector('span:last-child').textContent = `Segments (${real})`;
        a.dataset.disabled = false;
      }
      else {
        a.querySelector('span:last-child').textContent = (current / total * 100).toFixed(0) + '%';
      }
    }
  }
});

