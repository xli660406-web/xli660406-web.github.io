/*!
 * 看板娘（Live2D）加载器
 *
 * 四条规矩：
 *   1. 窗口太窄就不加载（手机、平板、窄窗口既看不到、也不会下载模型文件）
 *   2. 系统开了"减少动态效果"就不加载
 *   3. 所有文件都在本仓库 assets/live2d/ 里，不连任何外部服务器
 *   4. 气泡、状态条的文字跟全站的中英文切换保持一致
 *
 * 想换模型 / 改大小 / 改位置，只改下面 CONFIG 这几行即可。
 * 菜单只留"休息"一个按钮，另外三个（切换衣服 / 切换模型 / 关于）由 style.css 藏掉——
 * 因为仓库里只放了一个模型、一套衣服，点那两项会报"挂载模型失败"。
 */
(function () {
  var CONFIG = {
    minWidth: 1400,     // 窗口宽度门槛（像素）。低于它就不显示，免得挡住文字
    scale: 0.055,       // 模型大小（0.14 → 0.07 → 0.055，2026-09-24 按用户要求逐步缩小）
    lib: 'assets/live2d/oml2d.min.js',
    model: 'assets/live2d/Hiyori/Hiyori.model3.json'
  };

  if (window.innerWidth < CONFIG.minWidth) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var host = document.getElementById('mascot');
  if (!host) return;

  /* ---- 文字。中文那 8 句问候是库自带的原文，照抄回来；英文是我们配的 ---- */
  var TEXT = {
    zh: {
      greet: {
        daybreak: '早上好！一日之计在于晨，美好的一天就要开始了。',
        morning: '上午好！工作顺利嘛，不要久坐，多起来走动走动哦！',
        noon: '中午了，工作了一个上午，现在是午餐时间！',
        afternoon: '午后很容易犯困呢，来杯咖啡吧~',
        dusk: '傍晚了！工作一天幸苦啦~',
        night: '晚上好，今天过得怎么样呢？',
        lateNight: '已经这么晚了呀，早点休息吧，晚安~',
        weeHours: '这么晚还不睡吗？当心熬夜秃头哦！'
      },
      copy: '你复制了什么内容呢？记得注明出处哦~',
      loading: '加载中',
      loaded: '加载成功',
      failed: '加载失败',
      reload: '重新加载',
      resting: '看板娘休息中',
      switching: '正在切换',
      rest: '休息'
    },
    en: {
      greet: {
        daybreak: 'Good morning — a good day starts early.',
        morning: 'Good morning. Sit less, stretch more.',
        noon: 'It is noon — time for lunch.',
        afternoon: 'Afternoons get sleepy. How about a coffee?',
        dusk: 'It is evening — you have worked hard today.',
        night: 'Good evening. How was your day?',
        lateNight: 'It is late — get some rest. Good night.',
        weeHours: 'Still awake? Do not make a habit of it.'
      },
      copy: 'Copied something? Please credit the source.',
      loading: 'Loading',
      loaded: 'Ready',
      failed: 'Failed to load',
      reload: 'Reload',
      resting: 'Taking a break',
      switching: 'Switching',
      rest: 'Rest'
    }
  };

  var isEn = function () {
    return document.documentElement.classList.contains('lang-en');
  };
  var t = function () { return isEn() ? TEXT.en : TEXT.zh; };

  /* 菜单按钮的悬浮提示是库里写死的中文，语言切换后就地改掉 */
  var relabelMenu = function () {
    var rest = document.getElementById('Rest');
    if (rest) rest.title = t().rest;
  };

  var script = document.createElement('script');
  script.src = CONFIG.lib;
  script.onload = function () {
    if (typeof OML2D === 'undefined') return;
    host.classList.add('is-on');   // 加载成功才把她显示出来
    var L = t();
    OML2D.loadOml2d({
      parentElement: host,
      models: [{
        path: CONFIG.model,
        scale: CONFIG.scale,
        position: [0, 0],
        stageStyle: { width: '100%', height: '100%' },
        volume: 0
      }],
      dockedPosition: 'left',
      mobileDisplay: false,     // 移动端不加载
      sayHello: true,           // 加载完做一次招呼，并说一句问候（2026-09-25 按用户要求加回）
      primaryColor: '#d9c8a1',  // 跟全站的香槟金一致
      transitionTime: 1000,
      tips: {
        idleTips: { message: [] },         // 闲置时不说话（库默认就是空的）
        welcomeTips: { message: L.greet }, // 按访客当地钟点挑一句
        copyTips: { message: [L.copy] }    // 访客复制页面文字时说一句
      },
      statusBar: {
        disable: false,                    // 加载中/成功/失败那条（2026-09-25 按用户要求加回）
        loadMessage: L.loading,
        loadSuccessMessage: L.loaded,
        loadFailMessage: L.failed,
        reloadMessage: L.reload,
        restMessage: L.resting,
        switchingMessage: L.switching,
        transitionTime: 800
      },
      menus: { disable: false }            // 只留"休息"，另外三个由 style.css 藏掉
    });
    relabelMenu();
    /* 菜单按钮是模型加载完之后才插进页面的，所以刚启动时它还不在 DOM 里，
       要隔一会儿再看一次；一旦找到就停，最多看 18 秒。 */
    var tries = 0;
    var timer = setInterval(function () {
      relabelMenu();
      if (document.getElementById('Rest') || ++tries > 60) clearInterval(timer);
    }, 300);
    /* 全站中英切换是给 <html> 加/去 lang-en，跟着更新菜单提示 */
    new MutationObserver(relabelMenu).observe(document.documentElement, {
      attributes: true, attributeFilter: ['class']
    });
  };
  document.head.appendChild(script);
})();
