/* ==========================================================================
   个人主页交互（原生 JS，无任何外部依赖）
   全部效果都会做降级：关掉动效、旧浏览器、弱设备下页面依然可读可用
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrowMQ = window.matchMedia('(max-width: 760px)');   // 实时判断，窗口缩放/手机横竖屏切换后跟着变

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
  var phrases = ['水利水电工程大一在读', '在关注 AIGC 视频', '喜欢打乒乓球', '喜欢听音乐', '本名李育晓'];

  if (typedEl && !reduceMotion) {
    var pIndex = 0, cIndex = 0, deleting = false;

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
      window.setTimeout(tick, wait);
    };
    window.setTimeout(tick, 600);
  } else if (typedEl) {
    typedEl.textContent = phrases[0];
  }

  /* --- 5. 复制邮箱 --------------------------------------------------------- */
  var copyBtn = document.getElementById('copyMail');
  var mailLink = document.getElementById('mailLink');

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var address = mailLink ? mailLink.textContent.trim() : '';
      var done = function (ok) {
        copyBtn.textContent = ok ? '已复制 ' + address : '复制失败，请手动选中';
        window.setTimeout(function () { copyBtn.textContent = '复制邮箱'; }, 2200);
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
        copyBtn.textContent = '已选中，按 Ctrl+C 复制';
        window.setTimeout(function () { copyBtn.textContent = '复制邮箱'; }, 3200);
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
      btn.setAttribute('data-label', '《' + songText + '》' + artistText);
      btn.title = '选择用什么软件听：' + query;
      btn.setAttribute('aria-label', '选择用什么软件听：' + query);

      var badge = document.createElement('span');
      badge.className = 'tile__play';
      badge.textContent = '去听 ▸';

      // 把封面和歌名那两行搬进按钮里，整张封面就都能点了
      while (li.firstChild) btn.appendChild(li.firstChild);
      btn.appendChild(badge);
      li.appendChild(btn);
    };
    tiles.forEach(withListenLink);   // 先给原列表加工，各列的克隆会自动带上

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
       name = 按钮上的字；
       url  = 搜索地址，中间的 {q} 会被换成「歌名 歌手」。
              没有 {q} 的（比如汽水音乐）就直接打开那个地址，不带搜索词。
     想加平台、去掉平台、换名字，改这张表就行，改完刷新页面生效。
     为什么不加"打开 App"那种特殊跳转：那属于各家 App 私有的协议，写错了
     访客手机上会弹出"打不开"甚至一片空白；而直接用各家的搜索网页，装了 App
     的手机通常会自己进 App（这些平台自己做了这个跳转），没装的也能看到网页。
     面板里的按钮都是开新标签：万一对面要登录或要下载 App，关掉标签就回到本站。 */
  var PLATFORMS = [
    { name: '网易云音乐',  url: 'https://music.163.com/#/search/m/?s={q}' },
    { name: 'QQ 音乐',     url: 'https://y.qq.com/n/ryqq/search?w={q}' },
    { name: '酷狗音乐',    url: 'https://m.kugou.com/search?keyword={q}' },
    /* 汽水音乐（2026-09-21 实测）：没有给听众用的网页版搜索——官网 qishui.douyin.com
       只有下载页，music.douyin.com 是给音乐人/合作方用的平台，所以这里只能把人送到
       官网；手机上装了 App 的一般会直接进 App，没装的会看到下载页。 */
    { name: '汽水音乐',    url: 'https://qishui.douyin.com/' },
    { name: 'Apple Music', url: 'https://music.apple.com/cn/search?term={q}' }
  ];

  /* B 站：不用装任何东西、不用登录就能看结果，留给"这些都没装"的访客兜底
     （2026-09-21 实测：B 站搜索页免登录就能看；酷狗、Apple Music 的手机网页
     也能直接看；网易云、QQ 音乐的网页会引导装 App 或登录） */
  var BILI = 'https://search.bilibili.com/all?keyword=';

  var picker = document.getElementById('picker');
  var pickerSong = document.getElementById('pickerSong');
  var pickerList = document.getElementById('pickerList');
  var pickerBili = document.getElementById('pickerBili');
  var openedFrom = null;

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

    if (pickerSong) pickerSong.textContent = label || query;

    pickerList.textContent = '';
    PLATFORMS.forEach(function (platform) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'picker__btn';
      a.href = platform.url.indexOf('{q}') >= 0
        ? platform.url.replace('{q}', encodeURIComponent(query))
        : platform.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = platform.name;
      a.setAttribute('aria-label', '用' + platform.name + '听：' + query);
      li.appendChild(a);
      pickerList.appendChild(li);
    });

    if (pickerBili) pickerBili.href = BILI + encodeURIComponent(query);
  }

  function openPicker(query, label, trigger) {
    if (!picker || !pickerList || !query) return false;
    openedFrom = trigger || null;
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
      // 点了遮罩或"取消"就关掉；选好某个平台也把面板收起来（那个平台自己开新标签）
      if (t.closest('[data-picker-close]') || t.closest('.picker__btn')) closePicker();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) closePicker();
    });
  }

  /* --- 8. 页脚年份 --------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
