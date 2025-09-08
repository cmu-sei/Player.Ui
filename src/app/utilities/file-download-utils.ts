// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

export default class FileDownloadUtils {
  static downloadFile(fileData: Blob, filename: string) {
    const fileURL = window.URL.createObjectURL(fileData);
    const fileLink = document.createElement('a');
    fileLink.href = fileURL;
    fileLink.download = filename;
    fileLink.click();
  }
}
