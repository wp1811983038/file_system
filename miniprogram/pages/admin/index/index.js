// index.js
const app = getApp()

Page({
 data: {
   stats: {
     template_count: 0,
     user_count: 0, 
     today_uploads: 0
   },
   activities: []
 },

 onLoad() {
   wx.showLoading({ title: '加载中...' })
   
   Promise.all([
     this.loadStats(),
     this.loadActivities()  
   ]).finally(() => {
     wx.hideLoading()
   })
 },

 onShow() {
  if (typeof this.getTabBar === 'function' && this.getTabBar()) {
    this.getTabBar().setData({
      selected: 0  // 首页
    })
  }
},

 onPullDownRefresh() {
   Promise.all([
     this.loadStats(),
     this.loadActivities()
   ]).finally(() => {
     wx.stopPullDownRefresh()
   })
 },

 loadStats() {
   return new Promise((resolve, reject) => {
     wx.request({
       url: `${app.globalData.baseUrl}/api/v1/admin/stats`,
       method: 'GET',
       header: {
         'Authorization': `Bearer ${wx.getStorageSync('token')}`
       },
       success: (res) => {
         console.log('Stats response:', res.data)
         if (res.statusCode === 200 && res.data) {
           this.setData({
             stats: {
               template_count: res.data.template_count || 0,
               user_count: res.data.user_count || 0,
               today_uploads: res.data.today_uploads || 0
             }
           })
         }
         resolve()
       },
       fail: (err) => {
         console.error('加载统计数据失败:', err)
         reject(err)
       }
     })
   })
 },

 loadActivities() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/admin/submissions`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        console.log('Activities response:', res.data)
        if (res.statusCode === 200 && res.data && Array.isArray(res.data.submissions)) {
          this.setData({
            activities: res.data.submissions.map(file => ({
              id: file.id,
              username: file.user.username,
              action: `上传了 ${file.template.name}`,
              time: file.upload_date,
              fileType: file.template.name,
              filename: file.filename
            }))
          })
        }
        resolve()
      },
      fail: (err) => {
        console.error('加载活动数据失败:', err)
        reject(err)
      }
    })
  })
}
})