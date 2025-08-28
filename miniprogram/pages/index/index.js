Page({
  data: {
    imageSrc: '', // 拍照后的图片路径
    cropperWidth: 250, // 裁剪框宽度（初始值）
    cropperHeight: 250, // 裁剪框高度（初始值）
    imgWidth: 0, // 图片宽度
    maxCropperWidth: 0, // 裁剪框最大宽度
    showCropper: false // 控制裁剪控件显示
  },

  onLoad() {
    // 动态设置裁剪框高度和最大宽度
    wx.getSystemInfo({
      success: res => {
        this.setData({
          cropperHeight: res.windowHeight * 0.6, // 裁剪框高度为屏幕高度的60%
          cropperWidth: res.windowWidth * 0.9, // 初始裁剪框宽度为屏幕宽度的90%
          maxCropperWidth: res.windowWidth * 0.9 // 最大裁剪框宽度
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
    this.setData({
      imgWidth: this.data.cropperWidth // 图片宽度与裁剪框宽度一致（屏幕宽度的90%）
    });
    setTimeout(() => {
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

  // 取消裁剪
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