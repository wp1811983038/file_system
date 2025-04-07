Component({
  data: {
    selected: 0,
    color: "#999",
    selectedColor: "#07c160",
    // 在adminList数组中添加设置选项
    adminList: [{
      pagePath: "/pages/admin/index/index",
      text: "首页",
      iconPath: "/images/.png",
      selectedIconPath: "/images/home-active.png"
    }, {
      pagePath: "/pages/admin/template/list",
      text: "模板管理",
      iconPath: "/images/template.png",
      selectedIconPath: "/images/template-active.png"
    }, {
      pagePath: "/pages/admin/user/list",
      text: "用户管理",
      iconPath: "/images/user.png",
      selectedIconPath: "/images/user-active.png"
    }, {
      pagePath: "/pages/admin/settings/index",
      text: "设置",
      iconPath: "/images/setting.png",
      selectedIconPath: "/images/setting-active.png"
    }],
    userList: [{
      pagePath: "/pages/user/files/list",
      text: "文件",
      iconPath: "/images/file.png",
      selectedIconPath: "/images/file-active.png"
    }, {
      pagePath: "/pages/user/profile/list",
      text: "我的",
      iconPath: "/images/user.png",
      selectedIconPath: "/images/user-active.png"
    }],
    enforcerList: [
      {
        pagePath: "/pages/enforcer/index/index",
        text: "首页",
        iconPath: "/images/home.png",
        selectedIconPath: "/images/home-active.png"
      },
      {
        pagePath: "/pages/user/profile/list",
        text: "我的",
        iconPath: "/images/user.png",
        selectedIconPath: "/images/user-active.png"
      }
    ],
    list: []
  },

  lifetimes: {
    attached: function() {
      // 获取用户角色
      const userRole = wx.getStorageSync('userRole') || 'user';
      console.log('当前用户角色:', userRole);
      
      // 根据角色设置对应TabBar项
      if (userRole === 'admin' || wx.getStorageSync('isAdmin')) {
        this.setData({ list: this.data.adminList });
      } else if (userRole === 'enforcer') {
        this.setData({ list: this.data.enforcerList });
        console.log('设置执法端导航栏');
      } else {
        this.setData({ list: this.data.userList });
      }
    }
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path

      console.log('切换Tab:', data.index, url)

      this.setData({
        selected: data.index
      })

      wx.switchTab({
        url,
        success: () => {
          console.log('Tab切换成功:', data.index)
          this.setData({
            selected: data.index
          })
        },
        fail: (err) => {
          console.error('Tab切换失败:', err)
        }
      })
    }
  }
})