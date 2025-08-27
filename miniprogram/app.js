// app.js
const { envId } = require('./envList.js');
App({
  onLaunch: function () {
    wx.cloud.init({
      env: envId,
      traceUser: true
    });
  }
});
