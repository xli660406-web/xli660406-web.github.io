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

    /* 点击封面去听：链接不是一张一张手写的，而是拿封面下面那两行字
       （歌名 + 歌手）现算一个搜索地址——以后加歌、改名，链接自动跟着变，
       不会出现写错或者点开是死链的情况。想换平台只改下面这一行。

       ⚠️ 为什么是 B 站而不是网易云 / QQ 音乐：那两家网页版会把搜索结果
       挡在"扫码登录"弹窗后面（2026-09-20 实测截图 /tmp/site1.png 网易云、
       /tmp/qq_search.png QQ 音乐），访客不登录就看不到歌；B 站搜索页免登录
       就能看结果（实测截图 /tmp/bili_search.png 宽屏、/tmp/bili_mobile.png
       手机尺寸），所以选它。链接是"搜索页"，不是某一首歌，永不会失效。   */
    var SEARCH = 'https://search.bilibili.com/all?keyword=';
    var withListenLink = function (li) {
      var song = li.querySelector('.tile__cap b');
      var artist = li.querySelector('.tile__cap i');
      var query = [
        (song && song.textContent.trim()) || '',
        (artist && artist.textContent.trim()) || ''
      ].join(' ').trim();
      if (!query) return;

      var link = document.createElement('a');
      link.className = 'tile__link';
      link.href = SEARCH + encodeURIComponent(query);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = '去听：' + query + '（B 站搜索）';
      link.setAttribute('aria-label', '去听：' + query + '（B 站搜索）');

      var badge = document.createElement('span');
      badge.className = 'tile__play';
      badge.textContent = '去听 ▸';

      // 把封面和歌名那两行搬进链接里，整张封面就都能点了
      while (li.firstChild) link.appendChild(li.firstChild);
      link.appendChild(badge);
      li.appendChild(link);
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

  /* --- 7. 页脚年份 --------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
