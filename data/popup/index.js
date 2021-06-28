/* globals locale */
'use strict';
let tab;

let converter = {
  firefox: {
    id: '{0ff128a1-c286-4e73-bffa-9ae879b244d5}',
    url: 'https://addons.mozilla.org/firefox/addon/media-conversion-tool/'
  },
  opera: {
    id: 'fabccabfpmdadbhljpcmcbmepepfllnb',
    url: ''
  },
  chrome: {
    id: 'ocnfecjfebnllnapjjoncgjnnkfmobjc',
    url: 'https://chrome.google.com/webstore/detail/media-converter-and-muxer/ocnfecjfebnllnapjjoncgjnnkfmobjc'
  }
};
if (/Firefox/.test(navigator.userAgent)) {
  converter = converter.firefox;
}
else if (/OPR/.test(navigator.userAgent)) {
  converter = converter.opera;
}
else {
  converter = converter.chrome;
}

function quickDownload() {
  return new Promise((resolve, reject) => {
    const next = () => window.getFullInfo(tab.url).then(info => chrome.storage.local.get({
      doMerge: true,
      ffmpeg: '',
      pattern: '[file_name].[extension]'
    }, prefs => {
      const format = document.querySelector('[name=format]:checked').id;
      let formats = info.formats.filter(o => o.container === format)
        .filter(o => o.mimeType.startsWith('video/'))
        .filter(o => o.audioBitrate || (prefs.ffmpeg && prefs.doMerge))
        .sort((a, b) => b.bitrate - a.bitrate);
      if (formats.length) {
        const quality = document.querySelector('[name=quality]:checked').id;
        if (quality === '1080p') {
          formats = [
            formats.filter(o => o.qualityLabel === '1080p').shift(),
            ...formats
          ].filter(o => o);
        }
        else if (quality === '720p') {
          formats = [
            formats.filter(o => o.qualityLabel === '720p').shift(),
            formats.filter(o => o.qualityLabel === '1080p').shift(),
            ...formats
          ].filter(o => o);
        }
        else if (quality === 'high') {
          formats = [
            formats.filter(o => o.qualityLabel === '480p').shift(),
            formats.filter(o => o.qualityLabel === '360p').shift(),
            formats.filter(o => o.qualityLabel === '720p').shift(),
            formats.filter(o => o.qualityLabel === '1080p').shift(),
            ...formats
          ].filter(o => o);
        }
        else if (quality === 'medium') {
          formats = [
            formats.filter(o => o.qualityLabel === '240p').shift(),
            formats.filter(o => o.qualityLabel === '360p').shift(),
            formats.filter(o => o.qualityLabel === '480p').shift(),
            formats.filter(o => o.qualityLabel === '720p').shift(),
            formats.filter(o => o.qualityLabel === '1080p').shift(),
            ...formats
          ].filter(o => o);
        }
        else if (quality === 'small') {
          formats = formats.reverse();
        }
        const filename = prefs.pattern
          .replace('[file_name]', info.videoDetails.title)
          .replace('.[extension]', '')
          .replace('[extension]', '')
          .replace('[author]', info.videoDetails.author.name)
          .replace('[video_id]', info.videoDetails.videoId)
          .replace('[published_date]', info.videoDetails.publishDate);

        chrome.runtime.sendMessage({
          method: 'download',
          filename,
          format: formats[0],
          dash: formats[0].audioBitrate ? '' : 'v',
          formats: info.formats
        });
        if (Array.isArray(formats[0].url) === false) {
          resolve();
        }
      }
      else {
        reject(new Error('error_7'));
      }
    }));
    if (window.dd) {
      next();
    }
    else {
      const s = document.getElementById('youtube');
      s.onload = next;
      s.src = '/data/inject/youtbe-dl/youtube.js';
    }
  });
}

document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd;
  if (cmd === 'more') {
    document.body.dataset.settings = document.body.dataset.settings === 'false';
    e.preventDefault();
  }
  else {
    if (!e.target.closest('#settings')) {
      document.body.dataset.settings = false;
    }
  }
});
document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd || e.target.closest('div').dataset.cmd;
  if (cmd === 'display-panel') {
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, ([tab]) => {
      chrome.runtime.sendMessage({
        method: 'display-panel',
        tabId: tab.id
      }, () => window.close());
    });
  }
  else if (cmd === 'open-converter') {
    chrome.runtime.sendMessage(converter.id, {
      method: 'open'
    }, r => {
      if (r) {
        window.close();
      }
      else {
        if (converter.url) {
          chrome.tabs.create({
            url: converter.url
          });
        }
        else {
          chrome.runtime.sendMessage({
            method: 'message',
            error: 'message_3'
          });
        }
      }
    });
  }
  else if (cmd === 'open-options') {
    chrome.runtime.openOptionsPage();
  }
  else if (cmd === 'open-youtube') {
    chrome.tabs.create({
      url: 'https://www.youtube.com/'
    }, () => window.close());
  }
  else if (cmd === 'quick-download') {
    const div = document.querySelector('[data-cmd="quick-download"]');
    div.dataset.working = true;
    div.querySelector('span').textContent = locale.get('pp_7');
    quickDownload().then(
      window.close,
      error => {
        chrome.runtime.sendMessage({
          method: 'error',
          error: error.message || error
        });
        div.dataset.working = false;
        div.querySelector('span').textContent = locale.get('pp_1');
      }
    );
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'progress') {
    const div = document.querySelector('[data-cmd="quick-download"]');
    div.dataset.working = true;
    const {current, total} = request.progress;
    div.querySelector('span').textContent = (current / total * 100).toFixed(0) + '%';
    if (current === total) {
      window.close();
    }
  }
});

// persist
document.addEventListener('change', e => {
  const target = e.target;
  if (target.name === 'format' || target.name === 'quality') {
    chrome.storage.local.set({
      [target.name]: target.id
    });
  }
});
// init
chrome.tabs.query({
  active: true,
  currentWindow: true
}, ([t]) => {
  tab = t;
  const isYouTube = tab.url && tab.url.indexOf('youtube.com/') !== -1;
  document.body.dataset.youtube = !!isYouTube;
  if (isYouTube) {
    document.querySelector('[data-cmd="open-youtube"]').dataset.cmd = 'quick-download';
  }
});

chrome.storage.local.get({
  quality: 'highest',
  format: 'mp4'
}, prefs => {
  document.getElementById(prefs.quality).checked = true;
  document.getElementById(prefs.format).checked = true;
});

