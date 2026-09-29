const tabs = [
  { pagePath: '/pages/index/index', text: '首页', icon: '/assets/nav/home.svg', selectedIcon: '/assets/nav/home-active.svg' },
  { pagePath: '/pages/discover/discover', text: '发现', icon: '/assets/nav/search.svg', selectedIcon: '/assets/nav/search-active.svg' },
  { pagePath: '/pages/create/create', text: '发起', icon: '', selectedIcon: '' },
  { pagePath: '/pages/messages/messages', text: '消息', icon: '/assets/nav/message.svg', selectedIcon: '/assets/nav/message-active.svg' },
  { pagePath: '/pages/me/me', text: '我的', icon: '/assets/nav/profile.svg', selectedIcon: '/assets/nav/profile-active.svg' }
];

Component({
  data: { tabs, selected: 0, hidden: false },
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
