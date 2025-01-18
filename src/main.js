const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const instagramGetUrl = require("instagram-url-direct");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Klasör seçme dialogunu yönet
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'İndirme Klasörünü Seçin',
        buttonLabel: 'Klasörü Seç'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Medya indirme işlemini yönet
ipcMain.handle('download-media', async (event, { url, folder }) => {
    try {
        // Instagram medya bilgilerini al
        const mediaInfo = await instagramGetUrl(url);
        
        if (!mediaInfo.url_list || mediaInfo.url_list.length === 0) {
            return { success: false, error: 'Medya linki bulunamadı' };
        }

        const downloadUrl = mediaInfo.url_list[0];
        
        // İndirme klasörünü oluştur
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        
        // Dosya indirme işlemi
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            onDownloadProgress: (progressEvent) => {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                mainWindow.webContents.send('download-progress', progress);
            }
        });

        // Dosya adını oluştur
        const fileExt = downloadUrl.includes('.mp4') ? 'mp4' : 'jpg';
        const fileName = `instagram_${Date.now()}.${fileExt}`;
        const filePath = path.join(folder, fileName);
        
        // Dosyayı kaydet
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                resolve({ success: true, fileName: fileName });
            });
            
            writer.on('error', (err) => {
                reject({ success: false, error: err.message });
            });
        });
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}); 