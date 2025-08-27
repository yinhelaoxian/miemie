Page({
  data: {
    src: '', // 原始图片路径
    cropperSrc: '', // 剪裁组件专用路径
    uploadedUrl: '' // 上传后的云存储URL
  },
 
  // 拍照（改用chooseMedia）
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ 
          src: tempFilePath,
          cropperSrc: tempFilePath 
        });
        // 跳转到剪裁页面（或通过组件渲染）
        this.startCrop();
      },
      fail: () => wx.showToast({ title: '拍照失败', icon: 'error' })
    });
  },
 
  // 启动剪裁（假设使用image-cropper组件）
  startCrop() {
    // 渲染剪裁组件（具体实现取决于image-cropper的API）
    this.setData({ showCropper: true });
  },
 
  // 获取剪裁结果并上传
  onCropConfirm(e) {
    const { tempFilePath } = e.detail;
    this.compressAndUpload(tempFilePath);
  },
 
  // 压缩并上传
  compressAndUpload(filePath) {
    wx.compressImage({
      src: filePath,
      quality: 80,
      success: (res) => {
        const cloudPath = `wrong_questions/${Date.now()}.jpg`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: res.tempFilePath,
          success: (uploadRes) => {
            this.setData({ uploadedUrl: uploadRes.fileID });
            wx.showToast({ title: '保存成功' });
            // TODO: 保存题目信息到数据库
          },
          fail: () => wx.showToast({ title: '上传失败', icon: 'error' })
        });
      },
      fail: () => wx.showToast({ title: '压缩失败', icon: 'error' })
    });
  }
 });