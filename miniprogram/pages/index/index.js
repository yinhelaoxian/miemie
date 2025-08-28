// miniprogram/pages/index/index.js
Page({
  data: {
    imageSrc: '', // 拍照后的图片路径
    cropperWidth: 250, // 裁剪框宽度（初始值）
    cropperHeight: 250, // 裁剪框高度（初始值）
    imgWidth: 0, // 图片宽度
    imgHeight: 0, // 图片高度
    maxCropperWidth: 0, // 裁剪框最大宽度
    maxCropperHeight: 0, // 裁剪框最大高度
    showCropper: false // 控制裁剪控件显示
  },

  onLoad() {
    // 动态设置最大宽度和高度
    wx.getSystemInfo({
      success: res => {
        this.setData({
          maxCropperWidth: res.windowWidth * 0.9, // 最大裁剪框宽度为屏幕宽度的90%
          maxCropperHeight: res.windowHeight * 0.9 // 最大裁剪框高度为屏幕高度的90%
        });
      },
      fail: err => {
        console.error('获取系统信息失败', err);
        wx.showToast({
          title: '初始化失败',
          icon: 'none'
        });
      }
    });

    // 检查云开发环境
    if (!wx.cloud) {
      wx.showToast({
        title: '云开发未初始化',
        icon: 'none'
      });
      return;
    }
  },

  // 拍照
  takePhoto() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera'],
      success: res => {
        console.log('拍照路径:', res.tempFilePaths[0]);
        this.setData({
          imageSrc: res.tempFilePaths[0],
          showCropper: true
        });
        wx.showLoading({
          title: '加载中'
        });
      },
      fail: err => {
        console.error('拍照失败', err);
        wx.showToast({
          title: '拍照失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 裁剪控件初始化完成
  cropperload(e) {
    console.log('cropper 初始化完成');
    this.cropper = this.selectComponent('#image-cropper');
  },

  // 图片加载完成
  loadimage(e) {
    console.log('图片加载完成', e.detail);
    const { width: originalWidth, height: originalHeight } = e.detail;

    // 计算缩放比例，确保宽度和高度不超过屏幕的90%
    const screenWidth = wx.getSystemInfoSync().windowWidth;
    const screenHeight = wx.getSystemInfoSync().windowHeight;
    const scale = Math.min(screenWidth * 0.9 / originalWidth, screenHeight * 0.9 / originalHeight, 1); // 不超过1，防止放大

    // 计算显示宽度和高度
    const displayWidth = originalWidth * scale;
    const displayHeight = originalHeight * scale;

    this.setData({
      imgWidth: displayWidth,
      imgHeight: displayHeight,
      cropperWidth: displayWidth,
      cropperHeight: displayHeight
    });

    setTimeout(() => {
      // 设置初始裁剪框大小为图片大小（四个角重合）
      this.cropper.setCutSize(displayWidth, displayHeight);
      this.cropper.imgReset();
      wx.hideLoading();
    }, 100);
  },

  // 点击裁剪框预览图片
  clickcut(e) {
    console.log('裁剪框点击', e.detail);
    wx.previewImage({
      current: e.detail.url,
      urls: [e.detail.url]
    });
  },

  // 确认剪裁并获取图片
  getCroppedImage() {
    this.cropper.getImg(res => {
      if (res.url) {
        wx.compressImage({
          src: res.url,
          quality: 80,
          success: compressRes => {
            this.uploadToCloud(compressRes.tempFilePath);
            this.setData({
              showCropper: false
            });
          },
          fail: err => {
            console.error('压缩失败', err);
            wx.showToast({
              title: '压缩失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        });
      } else {
        wx.showToast({
          title: '裁剪失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 取消剪裁
  cancelCrop() {
    this.setData({
      showCropper: false,
      imageSrc: ''
    });
    wx.showToast({
      title: '已取消',
      icon: 'none'
    });
  },

  // 上传到腾讯云存储（兼容 yinhelaoxian/miemie）
  uploadToCloud(filePath) {
    wx.cloud.uploadFile({
      cloudPath: `images/${Date.now()}.jpg`,
      filePath: filePath,
      success: res => {
        console.log('上传成功', res.fileID);
        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: err => {
        console.error('上传失败', err);
        wx.showToast({
          title: '上传失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  }
});