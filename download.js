'use strict';

const download = {};
window.download = download;

// select a proper audio track
download.guessAudio = (request, opusmixing = false, pretendHD = false) => {
  const v = request.format;
  const audios = request.formats.filter(a => a.mimeType.startsWith('audio/'));
  let as;
  if (v.container === 'mp4' && opusmixing) {
    as = audios;
  }
  else {
    as = audios.filter(o => o.mimeType.indexOf(v.container) !== -1);
    if (as.length === 0) {
      console.warn('Cannot detect proper audio stream');
      as = audios;
    }
  }
  if (pretendHD === false) {
    // return lowest quality
    if (['tiny', 'small'].indexOf(v.quality) !== -1) {
      return as.pop();
    }
    // returns lowest quality that is greater than 48K
    else if (['medium', 'large'].indexOf(v.quality) !== -1) {
      const a = as.filter(a => a.audioBitrate > 48).pop();
      if (a) {
        return a;
      }
    }
  }
  // return the highest quality
  return as.shift();
};

download.get = (request, {doMerge, pretendHD, opusmixing, saveAs}, progress = () => {}) => new Promise((resolve, reject) => {
  const ids = [];
  const count = doMerge && request.dash === 'v' ? 2 : 1;
  let active = 0;
  const stat = {
    total: 0,
    current: 0,
    real: request.format.url.length
  };

  const search = id => new Promise((resolve, reject) => {
    chrome.downloads.search({id}, ([d]) => {
      if (d) {
        resolve(d);
      }
      else {
        reject(new Error('error_5'));
      }
    });
  });
  const observe = d => {
    if (!d.state || d.state.current === 'in_progress') {
      return;
    }
    const index = ids.indexOf(d.id);
    if (index === -1) {
      return;
    }

    if (d.state.current === 'interrupted') {
      chrome.downloads.onChanged.removeListener(observe);
      for (const id of ids) {
        chrome.downloads.cancel(id);
      }
      reject(new Error('error_6'));
    }
    else if (d.state.current === 'complete') {
      active += 1;

      if (count === active) {
        chrome.downloads.onChanged.removeListener(observe);
        Promise.all(ids.map(search)).then(resolve, reject);
      }
    }
    else {
      chrome.downloads.onChanged.removeListener(observe);
      reject(new Error('Download State is Unknown'));
    }
  };
  chrome.downloads.onChanged.addListener(observe);

  const native = async (options, callback) => {
    options.filename = options.filename
      .replace(/[`~!@#$%^&*()|+=?;:'",<>{}[\]\\/]/gi, '-')
      .replace(/[\\/:*?"<>|]/g, '-')
      .substring(0, 240);

    if (Array.isArray(options.url)) {
      stat.total += options.url.length;
      const blobs = [];
      for (const href of options.url) {
        await fetch(href).then(r => r.blob()).then(b => blobs.push(b));
        stat.current += 1;
        progress(stat);
      }
      const blob = new Blob(blobs, {
        type: request.format.mimeType
      });
      options.url = URL.createObjectURL(blob);
    }

    const next = id => {
      callback(id);
      if (options.url.startsWith('http') === false) {
        setTimeout(() => URL.revokeObjectURL(options.url), 5000);
      }
    };
    chrome.downloads.download(options, id => {
      if (chrome.runtime.lastError) {
        options.filename = options.filename.replace(/\s/g, '-');
        chrome.downloads.download(options, id => {
          if (chrome.runtime.lastError) {
            delete options.filename;
            chrome.downloads.download(options, next);
          }
          else {
            next(id);
          }
        });
      }
      else {
        next(id);
      }
    });
  };

  // also used by ffmpeg.js to get FFMpeg's executable
  const filename = request.filename
    .replace('[video_resolution]', request.format.qualityLabel)
    .replace('[audio_bitrate]', request.format.audioBitrate) +
    (request.dash === 'v' ? ' - DASH_V' : '') +
    (request.format.container ? '.' + request.format.container : '');

  native({
    url: request.format.url,
    filename,
    saveAs
  }, id => ids.push(id));
  if (doMerge && request.dash === 'v') {
    const aInfo = download.guessAudio(request, opusmixing, pretendHD);

    const filename = request.filename
      .replace('[video_resolution]', aInfo.qualityLabel)
      .replace('[audio_bitrate]', aInfo.audioBitrate) + ' - DASH_A.' + aInfo.container;
    native({
      url: aInfo.url,
      filename,
      saveAs
    }, id => ids.push(id));
  }
});
