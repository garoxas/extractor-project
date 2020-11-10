/* globals build, items */
'use strict';

const args = new URLSearchParams(location.search);

const s = document.getElementById('youtube');
s.onload = () => {
  window.getFullInfo(args.get('href')).then(o => {
    build(o);
    if (o.formats.length === 0) {
      items.setAttribute('pack', 'center');
      items.setAttribute('align', 'center');
      items.textContent = 'No Link Available for This Video';
    }
  }).catch(e => {
    document.body.dataset.loading = false;
    items.setAttribute('pack', 'center');
    items.setAttribute('align', 'center');
    items.textContent = e.message;
    console.warn(e);
  });
};
s.src = '../youtbe-dl/youtube.js';

document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd;
  if (cmd === 'toggle-toolbar') {
    e.preventDefault();
    const item = e.target.parentNode;
    [...items.querySelectorAll('a')]
      .filter(a => a !== item)
      .forEach(a => a.dataset.toolbar = 'false');
    item.dataset.toolbar =
    document.body.dataset.integration =
      item.dataset.toolbar === 'false';
    return;
  }
  else if (cmd === 'close-me') {
    chrome.runtime.sendMessage({
      method: 'close-panel'
    });
  }
  else if (cmd === 'mp3-converter') {
    chrome.runtime.sendMessage({
      method: 'open',
      cmd
    });
  }
  else if (cmd === 'download-with-tdm') {
    const item = document.querySelector('.item[data-toolbar=true]');
    if (item) {
      let id = 'pabnknalmhfecdheflmcaehlepmhjlaa';

      let link = 'https://chrome.google.com/webstore/detail/pabnknalmhfecdheflmcaehlepmhjlaa';
      if (navigator.userAgent.indexOf('Firefox') !== -1) {
        id = 'jid0-dsq67mf5kjjhiiju2dfb6kk8dfw@jetpack';
        link = 'https://addons.mozilla.org/firefox/addon/turbo-download-manager/';
      }
      else if (navigator.userAgent.indexOf('OPR') !== -1) {
        id = 'lejgoophpfnabjcnfbphcndcjfpinbfk';
        link = 'https://addons.opera.com/extensions/details/turbo-download-manager/';
      }
      else if (navigator.userAgent.indexOf('Edg/') !== -1) {
        id = 'mkgpbehnmcnadhklbcigfbehjfnpdblf';
        link = 'https://microsoftedge.microsoft.com/addons/detail/mkgpbehnmcnadhklbcigfbehjfnpdblf';
      }

      chrome.storage.local.get({
        pattern: '[file_name].[extension]'
      }, prefs => {
        const o = document.getElementById('items').o;
        const {format} = item;
        const filename = prefs.pattern
          .replace('[file_name]', o.videoDetails.title)
          .replace('.[extension]', '.' + format.container)
          .replace('[extension]', format.container)
          .replace('[author]', o.videoDetails.author.name)
          .replace('[video_id]', o.videoDetails.videoId)
          .replace('[video_resolution]', format.qualityLabel)
          .replace('[audio_bitrate]', format.audioBitrate)
          .replace('[published_date]', o.videoDetails.publishDate);
        const job = {
          threads: 3,
          filename
        };
        job[Array.isArray(format.url) ? 'links' : 'link'] = format.url;
        chrome.runtime.sendMessage(id, {
          method: 'add-jobs',
          jobs: [job]
        }, resp => {
          if (!resp) {
            chrome.tabs.create({
              url: link
            });
          }
        });
      });
    }
  }
  // do not load audio or video files inside the iframe
  const a = e.target.closest('a');
  if (a) {
    if (a.format) {
      e.stopPropagation();
      e.preventDefault();

      const o = document.getElementById('items').o;

      chrome.storage.local.get({
        pattern: '[file_name].[extension]'
      }, prefs => {
        const {format, dash} = a;
        const filename = prefs.pattern
          .replace('[file_name]', o.videoDetails.title)
          .replace('.[extension]', '')
          .replace('[extension]', '')
          .replace('[author]', o.videoDetails.author.name)
          .replace('[video_id]', o.videoDetails.videoId)
          .replace('[published_date]', o.videoDetails.publishDate);
        chrome.runtime.sendMessage({
          method: 'download',
          filename,
          format,
          dash,
          formats: o.formats
        });
      });
    }
  }
});
