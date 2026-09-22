/* ==========================================================================
   个人主页交互（原生 JS，无任何外部依赖）
   全部效果都会做降级：关掉动效、旧浏览器、弱设备下页面依然可读可用
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrowMQ = window.matchMedia('(max-width: 760px)');   // 实时判断，窗口缩放/手机横竖屏切换后跟着变

  /* --- 0. 中英文切换：引擎 -------------------------------------------------
     中文原文直接写在页面里，英文写在同一个标签的 data-en 上：
         <p data-en="Hello">你好</p>
     标签里还夹着别的标签（链接、加粗）时，改用 data-en-html，里面可以写 HTML：
         <p data-en-html='read <a href="x">this</a>'>读<a href="x">这里</a></p>
     写在属性里的字（图片说明 alt、无障碍标注 aria-label、照片说明 data-cap）就用
     data-en-alt / data-en-aria-label / data-en-cap。
     切换按钮在页面顶部（id="langBtn"）：点一下换语言，选过就记在浏览器里，
     下次打开还是上次那个语言；两个页面（首页 / 项目详情页）共用这一个设置。
     歌名、歌手、人名、型号不翻——它们是名字，不是说明文字。  */
  var LANG_KEY = 'site-lang';
  var lang = 'zh';

  try {
    if (window.localStorage.getItem(LANG_KEY) === 'en') lang = 'en';
  } catch (e) { /* 隐私模式下本地存储会报错：不影响看，只是记不住选择 */ }

  /* JS 自己拼出来的那几句（打字机、听歌面板、复制邮箱）也得分语言 */
  var T = {
    phrases: {
      zh: ['水利水电工程大一在读', '在关注 AIGC 视频', '喜欢打乒乓球', '喜欢听音乐', '本名李育晓'],
      en: ['Water & Hydropower, year 1', 'Following AIGC video', 'Playing table tennis',
           'Listening to music', 'Li Yuxiao']
    },
    copied:   { zh: function (a) { return '已复制 ' + a; },
                en: function (a) { return 'Copied ' + a; } },
    copyFail: { zh: function () { return '复制失败，请手动选中'; },
                en: function () { return 'Copy failed — please select it manually'; } },
    copySel:  { zh: function () { return '已选中，按 Ctrl+C 复制'; },
                en: function () { return 'Selected — press Ctrl+C'; } },
    copyTitle:{ zh: function () { return '复制邮箱'; },
                en: function () { return 'Copy email'; } },
    listen:   { zh: function () { return '去听 ▸'; },
                en: function () { return 'Listen ▸'; } },
    listenTitle: { zh: function (q) { return '选择用什么软件听：' + q; },
                   en: function (q) { return 'Choose an app to listen in: ' + q; } },
    songLabel:   { zh: function (s, a) { return '《' + s + '》' + a; },
                   en: function (s, a) { return '“' + s + '” ' + a; } },
    opening:  { zh: function (n) { return '正在试着打开「' + n + '」'; },
                en: function (n) { return 'Trying to open “' + n + '”'; } },
    pickerLabel: { zh: function (n, q) { return '用' + n + '听：' + q; },
                   en: function (n, q) { return 'Listen to ' + q + ' in ' + n; } },
    noteLabel:   { zh: function (n, q) { return '用网页打开' + n + '，搜索：' + q; },
                   en: function (n, q) { return 'Open ' + n + ' on the web, searching: ' + q; } },
    noteOpen:    { zh: function () { return '没反应？点这里用网页打开'; },
                   en: function () { return 'No response? Open the web version'; } },
    noteOpenShort: { zh: function () { return '点这里用网页打开'; },
                     en: function () { return 'Open the web version'; } },
    /* 微信、QQ、微博这类"自带浏览器"是白名单制，不是它自家 App 一律不给跳。
       网易云自己的网页遇到这种情况也只是提示"点右上角 → 在浏览器中打开"，
       我们照抄这句人话（文案见 https://music.163.com/m/applink 的源码）。 */
    inAppBlock:  { zh: function () { return '微信、QQ 这类自带浏览器不许网页跳 App，点了不会有用——点右上角的 ⋯，选「在浏览器中打开」，再点一次就能进 App。歌名已经帮你复制好了。'; },
                   en: function () { return 'Browsers inside WeChat or QQ block app links, so tapping does nothing here. Tap ⋯ at the top right, choose “Open in browser”, then tap again. The track name is already copied.'; } }
  };

  /* t('copied', 'a@b.com') → 按当前语言取出那一条，拼成一句话 */
  function t(key, a, b) {
    var item = T[key];
    if (!item || !item[lang]) return '';
    return item[lang](a, b);
  }

  /* 属性里的文字：左边是页面上的属性名，右边是 data-en-??? 里的那个后缀 */
  var EN_ATTRS = [
    ['alt', 'alt'], ['aria-label', 'aria-label'], ['content', 'content'],
    ['title', 'title'], ['placeholder', 'placeholder'], ['data-cap', 'cap']
  ];

  function swapLang(toEn) {
    var i, j, el, key, zhKey;

    /* 1) 标签之间的文字 */
    var nodes = document.querySelectorAll('[data-en], [data-en-html]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      if (el.hasAttribute('data-en')) {
        /* 第一次切到英文时，把中文原文抄在 data-zh 里（切回来要用） */
        if (toEn) {
          if (!el.hasAttribute('data-zh')) el.setAttribute('data-zh', el.textContent);
          el.textContent = el.getAttribute('data-en');
        } else if (el.hasAttribute('data-zh')) {
          el.textContent = el.getAttribute('data-zh');
        }
      }
      if (el.hasAttribute('data-en-html')) {
        if (toEn) {
          if (!el.hasAttribute('data-zh-html')) el.setAttribute('data-zh-html', el.innerHTML);
          el.innerHTML = el.getAttribute('data-en-html');
        } else if (el.hasAttribute('data-zh-html')) {
          el.innerHTML = el.getAttribute('data-zh-html');
        }
      }
    }

    /* 2) 属性里的文字（图片说明、无障碍标注、照片说明……） */
    var all = document.querySelectorAll('*');
    for (i = 0; i < all.length; i++) {
      el = all[i];
      for (j = 0; j < EN_ATTRS.length; j++) {
        key = 'data-en-' + EN_ATTRS[j][1];
        if (!el.hasAttribute(key)) continue;
        zhKey = 'data-zh-' + EN_ATTRS[j][1];
        if (toEn) {
          if (!el.hasAttribute(zhKey)) el.setAttribute(zhKey, el.getAttribute(EN_ATTRS[j][0]) || '');
          el.setAttribute(EN_ATTRS[j][0], el.getAttribute(key));
        } else if (el.hasAttribute(zhKey)) {
          el.setAttribute(EN_ATTRS[j][0], el.getAttribute(zhKey));
        }
      }
    }
  }

  var langBtn = document.getElementById('langBtn');

  function applyLang(next, remember) {
    lang = next === 'en' ? 'en' : 'zh';
    var toEn = lang === 'en';

    document.documentElement.lang = toEn ? 'en' : 'zh-CN';
    if (toEn) document.documentElement.classList.add('lang-en');
    else document.documentElement.classList.remove('lang-en');

    swapLang(toEn);

    if (langBtn) {
      /* 按钮上写的是"点了会换成哪种语言"：中文时显示 EN，英文时显示「中」 */
      langBtn.textContent = toEn ? '中' : 'EN';
      langBtn.setAttribute('lang', toEn ? 'zh-CN' : 'en');
      langBtn.setAttribute('aria-label', toEn ? '切换成中文' : 'Switch to English');
    }

    if (remember) {
      try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    }

    /* 打字机这类 JS 生成的内容，各自监听这个事件跟着换 */
    document.dispatchEvent(new CustomEvent('site:lang', { detail: { lang: lang } }));
  }

  /* --- 1. 滚动淡入 --------------------------------------------------------- */
  var revealItems = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealItems.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    revealItems.forEach(function (el) { io.observe(el); });
  }

  /* --- 2. 景深：滚动时背景层分层移动 --------------------------------------- */
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-depth]'));
  var nav = document.getElementById('nav');
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;

    if (nav) nav.classList.toggle('is-scrolled', y > 24);

    if (!reduceMotion && !narrowMQ.matches) {
      layers.forEach(function (layer) {
        var depth = parseFloat(layer.getAttribute('data-depth')) || 0;
        layer.style.transform = 'translate3d(0,' + (y * depth).toFixed(2) + 'px,0)';
      });
    }

    ticking = false;
  }

  function requestScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }

  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll, { passive: true });
  onScroll();

  /* --- 3. 跟随鼠标的柔光（仅桌面） ----------------------------------------- */
  var spotlight = document.querySelector('.spotlight');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (spotlight && finePointer && !reduceMotion && !narrowMQ.matches) {
    var move = function (x, y) {
      spotlight.style.setProperty('--mx', x + 'px');
      spotlight.style.setProperty('--my', y + 'px');
    };
    window.addEventListener('pointermove', function (e) {
      spotlight.classList.add('is-on');
      window.requestAnimationFrame(function () { move(e.clientX, e.clientY); });
    }, { passive: true });
    window.addEventListener('pointerleave', function () {
      spotlight.classList.remove('is-on');
    });
  }

  /* --- 4. 打字机：轮流显示几个标签 ----------------------------------------- */
  var typedEl = document.getElementById('typed');
  var phrases = T.phrases[lang];

  if (typedEl) {
    var pIndex = 0, cIndex = 0, deleting = false, typeTimer = null;

    var tick = function () {
      var text = phrases[pIndex];
      cIndex += deleting ? -1 : 1;
      typedEl.textContent = text.slice(0, cIndex);

      var wait = deleting ? 45 : 110;
      if (!deleting && cIndex === text.length) { wait = 1500; deleting = true; }
      else if (deleting && cIndex === 0) {
        deleting = false;
        pIndex = (pIndex + 1) % phrases.length;
        wait = 320;
      }
      typeTimer = window.setTimeout(tick, wait);
    };

    /* 换语言时从头再打一遍：不然会接着打上一门语言打到一半的那半句 */
    var startTyping = function () {
      window.clearTimeout(typeTimer);
      phrases = T.phrases[lang];
      pIndex = 0; cIndex = 0; deleting = false;
      if (reduceMotion) { typedEl.textContent = phrases[0]; return; }
      typedEl.textContent = '';
      typeTimer = window.setTimeout(tick, 600);
    };

    startTyping();
    document.addEventListener('site:lang', startTyping);
  }

  /* --- 5. 复制邮箱 --------------------------------------------------------- */
  var copyBtn = document.getElementById('copyMail');
  var mailLink = document.getElementById('mailLink');

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var address = mailLink ? mailLink.textContent.trim() : '';
      var done = function (ok) {
        copyBtn.textContent = ok ? t('copied', address) : t('copyFail');
        window.setTimeout(function () { copyBtn.textContent = t('copyTitle'); }, 2200);
      };

      // 老办法：造一个看不见的输入框，选中后调用系统的复制命令。
      // 新版剪贴板接口只在"安全环境"下可用，直接用 file:// 打开或老浏览器里会失效，
      // 所以下面留了一条兜底，实在不行就把邮箱选中让你自己按 Ctrl+C。
      var legacyCopy = function (text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(ta);
        return ok;
      };

      var fallback = function () {
        if (legacyCopy(address)) { done(true); return; }
        if (mailLink && window.getSelection) {
          var range = document.createRange();
          range.selectNodeContents(mailLink);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        copyBtn.textContent = t('copySel');
        window.setTimeout(function () { copyBtn.textContent = t('copyTitle'); }, 3200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(function () { done(true); }, fallback);
      } else {
        fallback();
      }
    });
  }

  /* --- 6. 音乐墙：把封面分给几列，每列各走各的上下循环滑动 -----------------
     页面上只写了一份"按顺序排的列表"（好维护：改歌只改那一处），这里把它按
     顺序分给各列：第 1 张→第 1 列、第 2 张→第 2 列……转回来再放第 6 张。

     ⚠️ 关键：每一列装的必须是**不同的专辑**（互不重叠）。
     第一版是"每列都装同一份 25 张、只是起点不同"，只要各列快慢一错开，屏幕上
     就会同时冒出两张一样的封面；现在从结构上就重叠不了，怎么错开都不会重复。
     每列再放两份自己的内容：滚到一半正好接上开头，看不出接缝。             */
  var wall = document.getElementById('musicWall');
  var wallList = document.getElementById('wallList');

  if (wall && wallList && wallList.children.length) {
    // 每列"每张封面走完要几秒"和方向（false=往上，true=往下）：快慢不同才不像复制粘贴
    var SPEEDS = [4.5, 5.67, 6.67, 5, 6];
    var DIRS = [false, true, false, true, false];
    var tiles = Array.prototype.slice.call(wallList.children);
    var count = tiles.length;
    var currentCols = 0;

    /* 点击封面不直接跳走，而是弹「用哪个软件听」的面板（见下面第 7 段）：
       访客用什么软件听歌，让他自己挑，不再统一跳一个地方。
       按钮只是"入口"，具体地址由第 7 段拿封面下面那两行字（歌名 + 歌手）现算，
       所以以后加歌、改名，地址自动跟着变，不会写错、也不会变成死链。       */
    var withListenLink = function (li) {
      var song = li.querySelector('.tile__cap b');
      var artist = li.querySelector('.tile__cap i');
      var songText = (song && song.textContent.trim()) || '';
      var artistText = (artist && artist.textContent.trim()) || '';
      var query = (songText + ' ' + artistText).trim();
      if (!query) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile__link';
      btn.setAttribute('data-query', query);
      btn.setAttribute('data-label', t('songLabel', songText, artistText));
      btn.title = t('listenTitle', query);
      btn.setAttribute('aria-label', t('listenTitle', query));

      var badge = document.createElement('span');
      badge.className = 'tile__play';
      badge.textContent = t('listen');

      // 把封面和歌名那两行搬进按钮里，整张封面就都能点了
      while (li.firstChild) btn.appendChild(li.firstChild);
      btn.appendChild(badge);
      li.appendChild(btn);
    };
    tiles.forEach(withListenLink);   // 先给原列表加工，各列的克隆会自动带上

    /* 换语言之后，封面角标「去听 ▸」和按钮上的说明也跟着换一遍
       （歌名、歌手本身不翻，它们是名字） */
    var relabelTiles = function () {
      var list = document.querySelectorAll('.tile__link');
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        var q = b.getAttribute('data-query') || '';
        var s = b.querySelector('.tile__cap b');
        var a = b.querySelector('.tile__cap i');
        b.setAttribute('data-label',
          t('songLabel', s ? s.textContent.trim() : '', a ? a.textContent.trim() : ''));
        b.title = t('listenTitle', q);
        b.setAttribute('aria-label', t('listenTitle', q));
        var badge = b.querySelector('.tile__play');
        if (badge) badge.textContent = t('listen');
      }
    };
    document.addEventListener('site:lang', relabelTiles);

    // 列数按屏幕宽度定：宽屏 5 列，窄了逐级减到 2 列（列少时每列分到的封面更多）
    var colsForWidth = function () {
      var w = window.innerWidth;
      if (w > 1150) return 5;
      if (w > 900) return 4;
      if (w > 760) return 3;
      return 2;
    };

    var build = function (cols) {
      wall.textContent = '';                 // 重新铺列（原来的列表已经存在 tiles 里）
      for (var c = 0; c < cols; c++) {
        var mine = [];
        for (var i = c; i < count; i += cols) mine.push(tiles[i]);

        var track = document.createElement('ol');
        track.className = 'wall__track' + (DIRS[c] ? ' wall__track--down' : '');
        // 一列里放两份自己的封面，滚到一半正好接上开头
        for (var copy = 0; copy < 2; copy++) {
          mine.forEach(function (li) { track.appendChild(li.cloneNode(true)); });
        }
        track.style.animationDuration = Math.round(SPEEDS[c % SPEEDS.length] * mine.length) + 's';

        var col = document.createElement('div');
        col.className = 'wall__col';
        col.appendChild(track);
        wall.appendChild(col);
      }
    };

    var sync = function () {
      var cols = colsForWidth();
      if (cols === currentCols) return;
      currentCols = cols;
      build(cols);
    };
    sync();
    window.addEventListener('resize', sync, { passive: true });
  }

  /* --- 7. 「用哪个软件听」面板：让访客自己挑播放器 -------------------------
     以前是所有人统一跳到 B 站。现在访客大多在手机上打开，而手机上本来就装着
     听歌软件，所以改成"点封面 → 先问用哪个软件"。

     下面 PLATFORMS 就是全部可选平台，一行一个：
       name = 按钮上的字（中文）；nameEn = 切到英文时按钮上的字；
       app  = 这个 App 自己的跳转协议（手机上用它唤起 App），没有就留空；
       applink = iPhone 上的**官方入口地址**（只有平台自己配了"通用链接"才有，
                 见下面网易云那行的说明）；有它就优先走它；
       pkg  = 安卓包名，安卓浏览器用 intent:// 唤起时要写；
       url  = 网页地址（电脑上点它、以及手机上唤不起 App 时退回这里），
              中间的 {q} 会被换成「歌名 歌手」，没有 {q} 的就原样打开。
     想加平台、去掉平台、换名字，改这张表就行，改完刷新页面生效。

     这些协议是 2026-09-21 从各家自己的网页脚本里翻出来的（不是网上抄的）：
       网易云 orpheus://  —— 网易云手机版脚本里写着 ORPHEUS_SCHEME="orpheus://"
       酷狗   kugou://    —— 酷狗自己的 open-kugou-app 脚本里在用 kugou://start.weixin?
       QQ 音乐 qqmusic:// —— 没找到证据，按常见写法填的，需要拿手机实测
       汽水音乐 —— 官网脚本里只有它自己内部用的 bytedance://、nativeapp://，
                   没有对外的唤起协议，所以这一家只能打开官网（下面的 app 留空）  */
  var PLATFORMS = [
    { name: '网易云音乐',  nameEn: 'NetEase Cloud Music', app: 'orpheus://', pkg: 'com.netease.cloudmusic',
      /* iPhone 上的官方入口（2026-09-22 实测）：
         网易云在自己域名的 apple-app-site-association 里**只放行了 /m/applink 这一条路径**
         （见 https://music.163.com/.well-known/apple-app-site-association），
         也就是说只有走这个地址，iOS 才肯把网页交给网易云 App。它自己也是这么用的。
         打开后：装了 App 就直接进 App；没装它自己会提示"下拉点打开"或给下载入口。
         它还会认 UA——在微信里打开时，它自己显示的就是"点右上角→在Safari中打开"。 */
      applink: 'https://music.163.com/m/applink?scheme=orpheus%3A%2F%2F',
      url: 'https://music.163.com/#/search/m/?s={q}' },
    { name: 'QQ 音乐',     nameEn: 'QQ Music', app: 'qqmusic://', pkg: 'com.tencent.qqmusic',
      url: 'https://y.qq.com/n/ryqq/search?w={q}' },
    { name: '酷狗音乐',    nameEn: 'Kugou Music', app: 'kugou://',   pkg: 'com.kugou.android',
      url: 'https://m.kugou.com/search?keyword={q}' },
    /* 汽水音乐（2026-09-21 实测）：没有给听众用的网页版搜索——官网 qishui.douyin.com
       只有下载页，music.douyin.com 是给音乐人/合作方用的平台，所以这里只能把人送到
       官网；也没有找到对外的唤起协议，所以手机上点它不会直接进 App。 */
    { name: '汽水音乐',    nameEn: 'Soda Music', app: '', pkg: '', url: 'https://qishui.douyin.com/' },
    /* Apple Music 不用协议：iOS 上打开它的网页链接，系统会自己交给"音乐"App */
    { name: 'Apple Music', nameEn: 'Apple Music', app: '', pkg: '', url: 'https://music.apple.com/cn/search?term={q}' }
  ];

  /* 平台名跟着语言走（没有英文名的就还用中文名） */
  function platName(platform) {
    return (lang === 'en' && platform.nameEn) ? platform.nameEn : platform.name;
  }

  /* B 站：不用装任何东西、不用登录就能看结果，留给"这些都没装"的访客兜底
     （2026-09-21 实测：B 站搜索页免登录就能看；酷狗、Apple Music 的手机网页
     也能直接看；网易云、QQ 音乐的网页会引导装 App 或登录） */
  var BILI = 'https://search.bilibili.com/all?keyword=';

  var picker = document.getElementById('picker');
  var pickerSong = document.getElementById('pickerSong');
  var pickerList = document.getElementById('pickerList');
  var pickerBili = document.getElementById('pickerBili');
  var openedFrom = null;
  var currentQuery = '';

  /* 手机/平板 = 没有鼠标悬停的设备。电脑上没有这些 App，就别白等那 1.6 秒 */
  var noHover = window.matchMedia('(hover: none)').matches;
  var isAndroid = /android/i.test(navigator.userAgent);

  /* 微信、微博、QQ 这类"自带浏览器"是白名单制：只要不是它自家的 App，一律不给跳。
     这个判断照抄网易云自己网页里的写法（micromessenger|weibo|qq，但 QQ 浏览器不算），
     出自 https://music.163.com/m/applink 的源码。命中它就别白点那一下，直接给提示。 */
  var isInApp = /micromessenger|weibo|qq(?!browser)/i.test(navigator.userAgent);

  function pickerUrl(platform, query) {
    return platform.url.indexOf('{q}') >= 0
      ? platform.url.replace('{q}', encodeURIComponent(query))
      : platform.url;
  }

  /* 把「歌名 歌手」放进剪贴板：进 App 后长按粘贴就能搜到，不用一个字一个字打。
     复制失败（浏览器不给权限）也没关系，不影响下面的唤起。 */
  function copyQuery() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentQuery);
      }
    } catch (err) { /* 复制不了就算了 */ }
  }

  /* 唤起 App：手机上点平台名走这里（iPhone 上有官方入口的平台不进来，见上面）。
     ⚠️ 2026-09-21 用户实测"点网易云、QQ 音乐没反应"之后改的，两个坑：
       1) 必须在这一下点击里同步跳，挪进 setTimeout 再跳 iPhone 就不认了；
       2) 唤起成不成功，网页这边**测不出来**：微信、QQ 这类自带浏览器直接禁止
          网页跳 App，点了就是一点动静都没有。所以这里只负责"试着唤起"，
          兜底交给下面那行一直显示着的文字链接，不再自己掐 1.6 秒去判断
          ——之前那套判断会被浏览器的 pagehide 误伤，变成既不跳 App 也不跳
          网页的死路，用户遇到的就是这个。 */
  function launchApp(platform, webUrl) {
    if (isAndroid && platform.pkg) {
      /* 安卓浏览器的标准写法：App 没装时，浏览器自己会去 S.browser_fallback_url，
         不用我们掐时间判断——这段是照网易云自己网页里的写法抄的 */
      var scheme = platform.app.split('://')[0];
      var path = platform.app.slice(scheme.length + 3);
      window.location.href = 'intent://' + path + '#Intent;scheme=' + scheme +
        ';package=' + platform.pkg +
        ';S.browser_fallback_url=' + encodeURIComponent(webUrl) + ';end';
      return;
    }

    /* iPhone 等：直接把地址换成 App 的协议。App 起来了整页会被切到后台；
       起不来的话浏览器通常什么都不做——没关系，面板还开着，下面那行提示还在。 */
    window.location.href = platform.app;
  }

  /* 「没反应？点这里用网页打开」那一行：点平台名的同时同步显示出来。
     它是个真的链接（用户自己点，浏览器不会拦），所以永远点得动，不会再出现
     "点了什么都不发生"的死路。 */
  var note = document.getElementById('pickerNote');
  var noteText = document.getElementById('pickerNoteText');
  var noteLink = document.getElementById('pickerNoteLink');
  var noteState = null;      /* 记住这次提示说的是谁、哪种情况，切换语言时好重写一遍 */

  /* 提示行的字全部由脚本写（这行本来就只有脚本会显示出来），
     好处是切换语言时能就地重写一遍，不用去改 HTML 里的 data-en。 */
  function paintNote() {
    if (!note || !noteText || !noteLink || !noteState) return;
    var blocked = noteState.mode === 'inApp';
    noteText.textContent = blocked
      ? t('inAppBlock')
      : t('opening', platName(noteState.platform));
    noteLink.textContent = blocked ? t('noteOpenShort') : t('noteOpen');
    noteLink.href = noteState.webUrl;
    noteLink.setAttribute('aria-label', t('noteLabel', platName(noteState.platform), currentQuery));
    note.hidden = false;
  }

  /* mode 不传 = 手机正在试唤起 App；mode='inApp' = 在微信/QQ 里，跳不了，只能提示换浏览器 */
  function showNote(platform, webUrl, mode) {
    noteState = { platform: platform, webUrl: webUrl, mode: mode || 'app' };
    paintNote();
  }

  function hideNote() {
    noteState = null;
    if (note) note.hidden = true;
  }

  document.addEventListener('site:lang', paintNote);

  function closePicker() {
    if (!picker || picker.hidden) return;
    picker.hidden = true;
    document.body.style.overflow = '';
    // 焦点还给刚才点的那张封面（用键盘的人才知道自己回到哪儿了）
    if (openedFrom && document.contains(openedFrom)) openedFrom.focus();
    openedFrom = null;
  }

  function fillPicker(query, label) {
    if (!picker || !pickerList) return;

    currentQuery = query;
    if (pickerSong) pickerSong.textContent = label || query;

    pickerList.textContent = '';
    PLATFORMS.forEach(function (platform, i) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'picker__btn';
      a.href = pickerUrl(platform, query);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = platName(platform);
      a.setAttribute('data-platform', String(i));
      /* 网页版地址单独存一份：提示行要拿它当兜底，不能受下面那条替换影响 */
      a.setAttribute('data-web', pickerUrl(platform, query));
      a.setAttribute('aria-label', t('pickerLabel', platName(platform), query));
      /* iPhone 上平台有官方入口的（目前只有网易云），按钮直接指向那个入口：
         浏览器在新标签里打开它，iOS 才会把网页交给 App（见下面的点击处理）。 */
      if (noHover && !isAndroid && platform.applink) a.href = platform.applink;
      li.appendChild(a);
      pickerList.appendChild(li);
    });

    if (pickerBili) pickerBili.href = BILI + encodeURIComponent(query);
  }

  function openPicker(query, label, trigger) {
    if (!picker || !pickerList || !query) return false;
    openedFrom = trigger || null;
    hideNote();                                // 面板重新打开，先把上一次的提示清掉
    fillPicker(query, label);
    picker.hidden = false;
    document.body.style.overflow = 'hidden';   // 面板开着，后面那页别跟着上下滑

    var first = pickerList.querySelector('.picker__btn');
    if (first) first.focus();
    return true;
  }

  /* 点封面 → 弹面板。这里用"事件委托"而不是给每张封面挂监听：
     封面会被脚本复制成好几列，复制出来的那些挂不上监听，委托则一视同仁。  */
  if (wall) {
    wall.addEventListener('click', function (e) {
      var t = e.target;
      var btn = (t && t.closest) ? t.closest('.tile__link') : null;
      if (!btn) return;

      e.preventDefault();
      var query = btn.getAttribute('data-query') || '';
      var label = btn.getAttribute('data-label') || query;

      // 万一面板的 HTML 被删掉了，也别让这一下点击没反应：直接去 B 站
      if (!openPicker(query, label, btn)) {
        window.open(BILI + encodeURIComponent(query), '_blank', 'noopener');
      }
    });
  }

  if (picker) {
    picker.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-picker-close]')) closePicker();   // 点遮罩或"取消"就关掉
    });

    /* 选好某个平台之后：手机上我们自己来（先唤起 App，唤不起再退回网页）；
       电脑上没有这些 App，就交给这个链接自己开新标签。 */
    if (pickerList) {
      pickerList.addEventListener('click', function (e) {
        var t = e.target;
        var a = (t && t.closest) ? t.closest('.picker__btn') : null;
        if (!a) return;

        var platform = PLATFORMS[Number(a.getAttribute('data-platform'))];
        if (!platform) return;

        var webUrl = a.getAttribute('data-web') || a.href;

        /* 微信、QQ、微博里点了也是白点——它们的浏览器是白名单制，一律不给跳 App。
           网易云自己碰到这种情况也只是提示"点右上角→在浏览器中打开"，
           所以这里干脆不试，直接把那句话摆出来。 */
        if (isInApp && noHover) {
          e.preventDefault();
          copyQuery();                       // 歌名先复制好，换到浏览器里就能用
          showNote(platform, webUrl, 'inApp');
          return;
        }

        /* iPhone 上有官方入口的平台（现在只有网易云）：按钮的地址已经换成那个
           官方地址，这里**不拦**——让浏览器在新标签里打开它，App 装了就进 App；
           没装就是它自己的"打开/下载"页，而且在新标签里，不会把我们这张页面顶掉。
           为什么不用自己跳 orpheus://：iOS 只在自己放行过的网址上才认 App。 */
        if (!isAndroid && noHover && platform.applink) {
          copyQuery();
          return;
        }

        if (platform.app && noHover) {
          e.preventDefault();
          copyQuery();                       // 歌名先复制好，进 App 直接粘贴
          showNote(platform, webUrl);        // 先摆好兜底，再试唤起
          launchApp(platform, webUrl);       // 别挪进 setTimeout：晚了浏览器不让跳
          /* 面板故意不关：App 没起来时，那行"用网页打开"要留在屏幕上给用户点 */
        } else {
          closePicker();
        }
      });
    }

    /* 点了那行兜底链接 = 用户不打算等 App 了，直接把面板收掉 */
    if (noteLink) {
      noteLink.addEventListener('click', function () { closePicker(); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) closePicker();
    });
  }

  /* --- 8. 项目详情页：点照片看大图 -----------------------------------------
     只对带 .shot 的按钮生效（目前用在 FAKE_POD_NANO 详情页的制作过程与成品图上）。
     没有这段脚本时，照片照常显示，只是点不开——不影响阅读。
     关闭方式给三种：右上角 ✕、点照片以外的黑底、按 Esc；关掉之后焦点回到原来那张。 */
  var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));

  if (shots.length) {
    var lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', '放大看照片');
    lightbox.setAttribute('data-en-aria-label', 'View a larger photo');
    lightbox.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="关闭" data-en-aria-label="Close">✕</button>' +
      '<figure class="lightbox__inner"><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(lightbox);

    var bigImg = lightbox.querySelector('img');
    var bigCap = lightbox.querySelector('figcaption');
    var closeBtn = lightbox.querySelector('.lightbox__close');
    var lastShot = null;

    function openBox(shot) {
      var thumb = shot.querySelector('img');
      var fig = shot.closest('figure');
      var cap = fig ? fig.querySelector('figcaption') : null;
      /* 照片下面的说明优先：时间线里没有 figure，就退回按钮上的 data-cap；再没有才用 alt */
      var text = (cap && cap.textContent) || shot.getAttribute('data-cap') ||
                 (thumb ? thumb.getAttribute('alt') : '');

      bigImg.src = thumb.currentSrc || thumb.src;
      bigImg.alt = thumb.alt || '';
      bigCap.textContent = text || '';
      bigCap.style.display = text ? '' : 'none';

      lastShot = shot;
      lightbox.classList.add('is-open');
      document.body.classList.add('is-zoomed');
      closeBtn.focus();
    }

    function closeBox() {
      lightbox.classList.remove('is-open');
      document.body.classList.remove('is-zoomed');
      bigImg.removeAttribute('src');
      if (lastShot) lastShot.focus();
      lastShot = null;
    }

    shots.forEach(function (shot) {
      shot.addEventListener('click', function () { openBox(shot); });
    });

    closeBtn.addEventListener('click', closeBox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeBox();     // 点黑底关掉，点照片本身不关
    });
    document.addEventListener('keydown', function (e) {
      if (lightbox.classList.contains('is-open') && (e.key === 'Escape' || e.keyCode === 27)) {
        closeBox();
      }
    });
  }

  /* --- 9. 页脚年份 --------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* --- 10. 语言按钮：切换 + 记住选择 ---------------------------------------
     放在最后执行：先把页面上所有内容都铺好（包括脚本自己生成的那几块），
     再统一按当前语言刷一遍，免得漏掉谁。
     注意这里会把 #year 里刚写好的年份也保护起来——年份那个 span 不带
     data-en，所以不会被覆盖。 */
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      applyLang(lang === 'en' ? 'zh' : 'en', true);
    });
  }
  applyLang(lang, false);
})();
