const tabs = [
  { pagePath: '/pages/index/index', text: '首页' },
  { pagePath: '/pages/discover/discover', text: '发现' },
  { pagePath: '/pages/create/create', text: '发起' },
  { pagePath: '/pages/messages/messages', text: '消息' },
  { pagePath: '/pages/me/me', text: '我的' }
];
const icons = [
  ['h-home', 'h-find', 'h-plus', 'h-msg', 'h-me'],
  ['d-home', 'd-find', 'd-plus', 'd-msg', 'd-me'],
  ['f-home', 'f-find', 'n-plus', 'f-msg', 'f-me'],
  ['n-home', 'n-find', 'n-plus', 'n-msg', 'n-me'],
  ['p-home', 'p-find', 'p-plus', 'p-msg', 'p-me']
].map(row => row.map(name => '/assets/nav/' + name + '.svg'));

Component({
  data: { tabs, icons, selected: 0, hidden: false },
  attached() { this.syncSelected(); },
  pageLifetimes: { show() { this.syncSelected(); } },
  methods: {
    syncSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const selected = tabs.findIndex(tab => tab.pagePath === '/' + (current && current.route));
      const hidden = selected === 2 && current?.data?.stage !== 'FORM';
      if (selected >= 0 && (selected !== this.data.selected || hidden !== this.data.hidden))
        this.setData({ selected, hidden });
    },
    setCreateStage(stage) {
      const hidden = stage !== 'FORM';
      if (this.data.selected !== 2 || this.data.hidden !== hidden) this.setData({ selected: 2, hidden });
    },
    selectTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const target = tabs[index];
      if (!target || index === this.data.selected) return;
      wx.switchTab({ url: target.pagePath, success: () => this.setData({ selected: index }) });
    }
  }
});
