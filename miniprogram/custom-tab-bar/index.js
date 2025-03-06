Component({
  data: {
    selected: 0,
    color: "#999",
    selectedColor: "#07c160",
    adminList: [{
      pagePath: "/pages/admin/index/index",
      text: "首页",
      iconPath: "/images/home.png",
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
    list: []
  },

  lifetimes: {
    attached() {
      console.log('TabBar组件初始化')
      // 初始化选择的标签页
      const isAdmin = wx.getStorageSync('isAdmin')
      const list = isAdmin ? this.data.adminList : this.data.userList
      this.setData({ list })
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