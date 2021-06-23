/* globals download, ffmpeg, locale */
'use strict';

function close(id, callback = () => {}) {
  chrome.tabs.executeScript(id, {
    'runAt': 'document_start',
    'code': `
      [...document.querySelectorAll('.iaextractor-webx-iframe')].forEach(p => p.parentNode.removeChild(p));
    `
  }, callback);
}

function notify(request) {
  chrome.storage.local.get({
    notification: true
  }, prefs => {
    if (prefs.notification) {
      const message = locale.get(request.error || request.message || request);
      const optns = Object.assign({
        type: 'basic',
        iconUrl: '/data/icons/48.png',
        title: locale.get('title'),
        message
      }, {
        // requireInteraction: request.requireInteraction,
        isClickable: request.isClickable
      });
      chrome.notifications.create(optns);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'error' || request.method === 'message') {
    notify(request);
  }
  else if (request.method === 'display-panel') {
    const id = request.tabId || sender.tab.id;

    chrome.tabs.executeScript(id, {
      'runAt': 'document_start',
      'code': `!!document.querySelector('.iaextractor-webx-iframe')`
    }, rs => {
      const error = chrome.runtime.lastError;
      const r = rs && rs[0];
      if (error) {
        notify(error);
      }
      else if (r) {
        close(id);
      }
      else {
        chrome.tabs.executeScript(id, {
          'runAt': 'document_start',
          'file': '/data/inject/panel.js'
        });
      }
    });
  }
  else if (request.method === 'notify') {
    notify(request);
  }
  else if (request.method === 'download') {
    chrome.storage.local.get({
      pretendHD: true,
      opusmixing: false,
      doMerge: true,
      toAudio: true,
      toMP3: false,
      remove: true,
      ffmpeg: '',
      savein: '',
      saveAs: false,
      commands: {
        toMP3: '-loglevel error -i %input -q:a 0 %output',
        toAudio: '-loglevel error -i %input -acodec copy -vn %output',
        muxing: '-loglevel error -i %audio -i %video -acodec copy -vcodec copy %output'
      }
    }, prefs => {
      const progress = progress => {
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, {
            method: 'progress',
            progress,
            itag: request.format.itag
          });
        }
        else {
          chrome.runtime.sendMessage({
            method: 'progress',
            progress,
            itag: request.format.itag
          });
        }
      };

      download.get(request, prefs, progress).then(ds => {
        const vd = ds.length === 1 ? ds[0] : (ds.filter(o => o.mime.startsWith('video')).shift() || ds[0]);
        const root = prefs.savein || ffmpeg.parent(vd.filename);
        let [leafname, extension] = ffmpeg.extract(vd.filename);
        let ad;
        // if audio leafname is smaller than video one, use it as the leafname
        if (ds.length > 1) {
          ad = ds.filter(d => d !== vd).shift();
          const [name] = ffmpeg.extract(ad.filename);
          if (name.length < leafname.length) {
            leafname = name;
          }
        }
        leafname = leafname.replace(' - DASH_V', '').replace(' - DASH_A', '');

        // audio and video muxing
        if (ds.length === 2 && prefs.doMerge && !prefs.ffmpeg) {
          notify({
            message: 'message_2',
            isClickable: true,
            requireInteraction: true
          });
          window.setTimeout(() => chrome.runtime.openOptionsPage(), 2000);
        }
        else if (ds.length === 2 && prefs.doMerge) {
          // we now allow OPUS for muxing; if vInfo === 'mp4', change container to MKV
          if (prefs.opusmixing && request.format.container === 'mp4') {
            extension = 'mkv';
          }
          ffmpeg.resolve(root, leafname, extension).then(output => {
            return ffmpeg.convert(prefs.ffmpeg, prefs.commands.muxing, {
              '%audio': ad.filename,
              '%video': vd.filename,
              '%output': output
            });
          }).then(() => {
            if (prefs.remove) {
              return ffmpeg.remove([vd.filename, ad.filename]);
            }
          }).catch(e => notify(e));
        }
        // extract audio
        else if (ds.length === 1 && request.dash !== 'v' && prefs.toAudio && prefs.ffmpeg) {
          let newExtension = extension;
          if (['weba', 'webm', 'ogg', 'vorbis'].indexOf(extension) !== -1) {
            newExtension = 'webm';
          }
          else if (extension === 'mp4') {
            newExtension = 'm4a';
          }

          ffmpeg.resolve(root, leafname, newExtension).then(output => {
            return ffmpeg.convert(prefs.ffmpeg, prefs.commands.toAudio, {
              '%input': vd.filename,
              '%output': output
            });
          }).then(() => {
            if (prefs.remove) {
              return ffmpeg.remove([vd.filename]);
            }
          }).catch(e => notify(e));
        }
        // convert to mp3
        else if (ds.length === 1 && request.dash !== 'v' && prefs.toMP3 && prefs.ffmpeg) {
          ffmpeg.resolve(root, leafname, 'mp3').then(output => {
            return ffmpeg.convert(prefs.ffmpeg, prefs.commands.toMP3, {
              '%input': vd.filename,
              '%output': output
            });
          }).catch(e =>notify(e));
        }
      },
      e => notify(e));
    });
  }
  else if (request.method === 'fetch') {
    const req = new XMLHttpRequest();
    req.open(request.type, request.url);
    req.onload = () => response({
      req
    });
    req.onerror = error => response({
      error
    });
    req.send();
    return true;
  }
  else if (request.method === 'open') {
    if (request.cmd === 'mp3-converter') {
      chrome.tabs.create({
        url: 'https://webbrowsertools.com/convert-to-mp3/'
      });
    }
  }
  //
  if (request.method === 'close-panel') {
    const id = request.tabId || sender.tab.id;
    close(id, response);
    return true;
  }
});

// FAQs
{
  const {onInstalled, getManifest} = chrome.runtime;
  const {version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': false,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '?version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
}
