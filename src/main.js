'use strict';

const path = require('path');
const { app, ipcMain, globalShortcut } = require('electron');

const UpdateHandler = require('./handlers/update');
const Common = require('./common');
const AppConfig = require('./configuration');

const SplashWindow = require('./windows/controllers/splash');
const WeChatWindow = require('./windows/controllers/wechat');
const SettingsWindow = require('./windows/controllers/settings');
const AppTray = require('./windows/controllers/app_tray');
const notify = require('./notify/notify');

class ElectronicWeChat {
    constructor() {
        this.wechatWindow = null;
        this.splashWindow = null;
        this.settingsWindow = null;
        this.tray = null;
    }

    init() {
        if (this.checkInstance()) {
            this.initApp();
            this.initIPC();
        } else {
            app.quit();
        }
    }
    checkInstance() {
        if (AppConfig.readSettings('multi-instance') === 'on') return true;
        return !app.makeSingleInstance((commandLine, workingDirectory) => {
            if (this.splashWindow && this.splashWindow.isShown) {
                this.splashWindow.show();
                return
            }
            if (this.wechatWindow) {
                this.wechatWindow.show();
            }
            if (this.settingsWindow && this.settingsWindow.isShown) {
                this.settingsWindow.show();
            }
        });

    }
    initApp() {
        if (process.platform === 'linux') {
            /* allow notification to be transparent on linux platform, which is 
             * equivalent for appending '--enable-transparent-visuals --disable-gpu'
             * on the command line. */
            app.commandLine.appendSwitch('enable-transparent-visuals');
            app.disableHardwareAcceleration();
        }

        app.on('ready', () => {
            this.createSplashWindow();
            this.createWeChatWindow();
            this.createTray();

            if (!AppConfig.readSettings('language')) {
                AppConfig.saveSettings('language', 'en');
                AppConfig.saveSettings('prevent-recall', 'on');
                AppConfig.saveSettings('icon', 'black');
                AppConfig.saveSettings('multi-instance', 'on');
            }

            // register global shortcut
            let ShortcutList = Common.globalShortcut;
            for (var i = 0; i < ShortcutList.length; i++) {
                globalShortcut.register(ShortcutList[i]['Shortcut'], eval(ShortcutList[i]['func']));
            }

        });

        app.on('activate', () => {
            if (this.wechatWindow == null) {
                this.createWeChatWindow();
            } else {
                this.wechatWindow.show();
            }
        });
    };

    initIPC() {
        ipcMain.on('badge-changed', (event, num) => {
            if (process.platform == "darwin") {
                app.dock.setBadge(num);
                if (num) {
                    this.tray.setTitle(` ${num}`);
                } else {
                    this.tray.setTitle('');
                }
            } else if (process.platform === "linux" || process.platform === "win32") {
                app.setBadgeCount(num * 1);
                this.tray.setUnreadStat((num * 1 > 0) ? 1 : 0);
            }
        });

        ipcMain.on('user-logged', () => {
            this.wechatWindow.resizeWindow(true, this.splashWindow)
        });

        ipcMain.on('wx-rendered', (event, isLogged) => {
            this.wechatWindow.resizeWindow(isLogged, this.splashWindow)
        });

        ipcMain.on('log', (event, message) => {
            console.log(message);
        });

        ipcMain.on('reload', (event, repetitive) => {
            if (repetitive) {
                this.wechatWindow.loginState.current = this.wechatWindow.loginState.NULL;
                this.wechatWindow.connectWeChat();
            } else {
                this.wechatWindow.loadURL(Common.WEB_WECHAT);
            }
        });

        ipcMain.on('update', (event, message) => {
            let updateHandler = new UpdateHandler();
            updateHandler.checkForUpdate(`v${app.getVersion()}`, false);
        });

        ipcMain.on('open-settings-window', (event, message) => {
            if (this.settingsWindow) {
                this.settingsWindow.show();
            } else {
                this.createSettingsWindow();
                this.settingsWindow.show();
            }
        });

        ipcMain.on('close-settings-window', (event, messgae) => {
            this.settingsWindow.close();
            this.settingsWindow = null;
        });

        ipcMain.on('notify-click', (event, winId, notifyObj) => {
            notify.closeAll();
            this.wechatWindow.show(notifyObj.options.username);
        });

        notify.init();
    };

    createTray() {
        this.tray = new AppTray(this.splashWindow, this.wechatWindow);
    }

    createSplashWindow() {
        this.splashWindow = new SplashWindow();
        this.splashWindow.show();
    }

    createWeChatWindow() {
        this.wechatWindow = new WeChatWindow();
    }

    createSettingsWindow() {
        this.settingsWindow = new SettingsWindow();
    }

}

new ElectronicWeChat().init();