/*!
 * 看板娘（Live2D）加载器
 *
 * 三条规矩：
 *   1. 窗口太窄就不加载（手机、平板、窄窗口既看不到、也不会下载模型文件）
 *   2. 系统开了"减少动态效果"就不加载
 *   3. 所有文件都在本仓库 assets/live2d/ 里，不连任何外部服务器
 *
 * 想换模型 / 改大小 / 改位置，只改下面 CONFIG 这几行即可。
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

  var script = document.createElement('script');
  script.src = CONFIG.lib;
  script.onload = function () {
    if (typeof OML2D === 'undefined') return;
    host.classList.add('is-on');   // 加载成功才把她显示出来
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
      sayHello: false,          // 不打招呼
      primaryColor: '#d9c8a1',  // 跟全站的香槟金一致
      transitionTime: 1000,
      // 不说话：把三种气泡的文字全部清空（气泡本身另外用 CSS 藏掉）
      tips: {
        idleTips: { message: [] },
        welcomeTips: {
          message: {
            daybreak: '', morning: '', noon: '', afternoon: '',
            dusk: '', night: '', lateNight: '', weeHours: ''
          }
        },
        copyTips: { message: [] }
      },
      statusBar: { disable: true },  // 不要"加载成功/失败"那条
      menus: { disable: true }       // 不要右下角那排按钮
    });
  };
  document.head.appendChild(script);
})();
