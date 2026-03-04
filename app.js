// TOTP 生成算法实现
class TOTP {
    constructor(secret) {
        this.secret = secret;
    }

    // Base32 解码
    static base32Decode(str) {
        const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        let value = 0;

        for (let i = 0; i < str.length; i++) {
            value = base32Chars.indexOf(str.charAt(i));
            if (value === -1) throw new Error('无效的Base32字符');
            bits += value.toString(2).padStart(5, '0');
        }

        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substr(i, 8), 2));
        }

        return new Uint8Array(bytes);
    }

    // HMAC-SHA1 实现
    static async hmacSha1(key, message) {
        const keyBuffer = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', keyBuffer, message);
        return new Uint8Array(signature);
    }

    // 生成 TOTP 验证码
    static async generateToken(secret, time = null) {
        time = time || Math.floor(Date.now() / 1000);
        let epoch = Math.floor(time / 30);

        // 构造计数器（8字节）
        const counter = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            counter[i] = epoch & 0xff;
            epoch >>= 8;
        }

        try {
            // 解码 Base32 密钥
            const secretBytes = this.base32Decode(secret);

            // 计算 HMAC-SHA1
            const hmac = await this.hmacSha1(secretBytes, counter);

            // 动态截断
            const offset = hmac[hmac.length - 1] & 0xf;
            const p = (hmac[offset] << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
            const code = (p & 0x7fffffff) % 1000000;

            return code.toString().padStart(6, '0');
        } catch (error) {
            throw new Error('生成验证码失败: ' + error.message);
        }
    }
}

// UI 控制
class TotpUI {
    constructor() {
        this.secretInput = document.getElementById('secretKey');
        this.generateBtn = document.getElementById('generateBtn');
        this.qrcodeBtn = document.getElementById('qrcodeBtn');
        this.secretDisplay = document.getElementById('secretDisplay');
        this.tokenDisplay = document.getElementById('tokenDisplay');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.qrcodeContainer = document.getElementById('qrcodeContainer');
        this.errorMsg = document.getElementById('error');
        this.updateInterval = null;

        this.initEventListeners();
    }

    initEventListeners() {
        this.generateBtn.addEventListener('click', () => this.handleGenerateToken());
        this.qrcodeBtn.addEventListener('click', () => this.handleGenerateQRCode());
        this.secretInput.addEventListener('change', () => {
            this.secretDisplay.textContent = this.secretInput.value.toUpperCase();
            this.qrcodeContainer.classList.add('hidden');
        });

        // 页面加载时自动生成一次验证码
        this.handleGenerateToken();
    }

    async handleGenerateToken() {
        const secret = this.secretInput.value.trim().toUpperCase();
        
        if (!secret) {
            this.showError('请输入密钥');
            return;
        }

        try {
            this.errorMsg.classList.remove('show');
            await this.generateAndUpdateToken(secret);
            this.startCountdown();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async generateAndUpdateToken(secret) {
        try {
            const token = await TOTP.generateToken(secret);
            this.tokenDisplay.textContent = token;
            this.secretDisplay.textContent = secret;
        } catch (error) {
            throw new Error('生成验证码失败: ' + error.message);
        }
    }

    startCountdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        const updateCountdown = async () => {
            const now = Math.floor(Date.now() / 1000);
            const secondsRemaining = 30 - (now % 30);
            this.timeDisplay.textContent = secondsRemaining + ' 秒';

            if (secondsRemaining <= 1) {
                const secret = this.secretInput.value.trim().toUpperCase();
                if (secret) {
                    await this.generateAndUpdateToken(secret);
                }
            }
        };

        updateCountdown();
        this.updateInterval = setInterval(updateCountdown, 1000);
    }

    async handleGenerateQRCode() {
        const secret = this.secretInput.value.trim().toUpperCase();
        
        if (!secret) {
            this.showError('请先输入或生成密钥');
            return;
        }

        try {
            // 调用后端API生成二维码
            const response = await fetch('/api/qrcode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ secret: secret })
            });

            if (!response.ok) {
                throw new Error('生成二维码失败');
            }

            const data = await response.json();
            this.displayQRCode(data.qrcode);
            this.errorMsg.classList.remove('show');
        } catch (error) {
            this.showError('生成二维码失败: ' + error.message);
        }
    }

    displayQRCode(dataUrl) {
        this.qrcodeContainer.innerHTML = `<img src="${dataUrl}" alt="QR Code" />`;
        this.qrcodeContainer.classList.remove('hidden');
    }

    showError(message) {
        this.errorMsg.textContent = message;
        this.errorMsg.classList.add('show');
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    new TotpUI();
});
