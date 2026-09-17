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
  var phrases = ['水利水电工程大一在读', '在关注 AIGC 视频', '喜欢打乒乓球', '本名李育晓'];

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

  /* --- 6. 页脚年份 --------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
