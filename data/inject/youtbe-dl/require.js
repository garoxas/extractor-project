'use strict';

window.exports = {};
window.module = {
  exports: {}
};
// disable updates
window.process = {
  env: {
    YTDL_NO_UPDATE: true
  }
};

window.require = name => {
  // console.log(name);
  if (name === './cache') {
    return window.Cache;
  }
  else if (name === './utils') {
    return window.utils;
  }
  else if (name === './info') {
    return window.info;
  }
  else if (name === './info-extras') {
    return window.extras;
  }
  else if (name === 'timers') {
    return {
      setTimeout(...args) {
        setTimeout(...args);
        return {
          unref() {}
        };
      }
    };
  }
  else if (name === 'url') {
    return window;
  }
  else if (name === './url-utils') {
    return window.urlUtils;
  }
  else if (name === './formats') {
    return window.formats;
  }
  else if (name === './format-utils') {
    return window.formatUtils;
  }
  else if (name === './sig') {
    return window.sig;
  }
  else if (name === 'miniget') {
    const r = (href, options = {}) => {
      options.headers = options.headers || {};
      options.headers.Cache = 'no-store';
      options.headers['Cache-Control'] = 'no-store';
      options.maxRetries = options.maxRetries || 0;

      return {
        setEncoding() {},
        text() {
          return fetch(href, options).then(r => r.text());
        },
        on(method, callback) {
          if (method === 'data') {
            fetch(href, options).then(r => r.text()).then(callback);
          }
        }
      };
    };
    r.defaultOptions = {
      maxRetries: 1
    };
    return r;
  }
  else if (name === 'url') {
    return {
      parse(href) {
        const u = new URL(href);
        u.query = {};
        for (const [key, value] of u.searchParams) {
          try {
            u.query[key] = decodeURIComponent(value);
          }
          catch (e) {
            u.query[key] = value;
          }
        }
        return u;
      },
      format(o) {
        return (o.protocol + '://').replace('::', ':') + o.host + o.pathname + '?' + Object.entries(o.query).map(([key, value]) => {
          if (value !== undefined) {
            return `${key}=${encodeURIComponent(value)}`;
          }
          return key;
        }).join('&');
      },
      resolve(href, pathname) {
        if (pathname.startsWith('http')) {
          return pathname;
        }
        return (new URL(href)).origin + pathname;
      }
    };
  }
  else if (name === 'querystring') {
    return {
      parse(body) {
        const r = {};
        for (const [key, value] of new URLSearchParams(body)) {
          try {
            r[key] = decodeURIComponent(value);
          }
          catch (e) {
            r[key] = value;
          }
        }
        return r;
      }
    };
  }
  else if (name === 'sax') {
    const o = {
      close() {},
      write(content) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        [...doc.querySelectorAll('*')].forEach(node => {
          o.onopentag({
            node,
            name: node.tagName.toUpperCase(),
            attributes: [...node.attributes].reduce((p, c) => {
              p[c.name.toUpperCase()] = c.value;
              return p;
            }, {})
          });
        });
        o.onend();
      }
    };
    return {
      parser() {
        return o;
      }
    };
  }
  else if (name === 'html-entities') {
    return {
      AllHtmlEntities: {
        decode(str) {
          const parser = new DOMParser();
          const dom = parser.parseFromString(str, 'text/html');
          return dom.body.textContent;
        }
      }
    };
  }
  // console.warn('unexpected require', name);
  return {};
};
