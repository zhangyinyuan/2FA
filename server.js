const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const speakeasy = require('speakeasy');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API：生成QR码
app.post('/api/qrcode', async (req, res) => {
    try {
        const { secret } = req.body;

        if (!secret) {
            return res.status(400).json({ error: '缺少密钥参数' });
        }

        // 验证密钥是否有效（Base32格式）
        if (!/^[A-Z2-7]+={0,6}$/.test(secret)) {
            return res.status(400).json({ error: '无效的Base32密钥' });
        }

        // 生成QR码内容（Google Authenticator格式）
        const otpauth_url = `otpauth://totp/2FA%20Authenticator?secret=${secret}&issuer=2FA%20Authenticator`;

        // 生成二维码
        const qrcode = await QRCode.toDataURL(otpauth_url, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.95,
            margin: 1,
            width: 300
        });

        res.json({ qrcode });
    } catch (error) {
        console.error('QR码生成错误:', error);
        res.status(500).json({ error: '生成二维码失败' });
    }
});

// API：验证TOTP token（可选，用于验证验证码的正确性）
app.post('/api/verify', (req, res) => {
    try {
        const { secret, token } = req.body;

        if (!secret || !token) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 使用speakeasy库验证token
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1 // 允许前后各1个时间窗口
        });

        if (verified) {
            res.json({ valid: true, message: '验证码正确' });
        } else {
            res.json({ valid: false, message: '验证码错误' });
        }
    } catch (error) {
        console.error('验证错误:', error);
        res.status(500).json({ error: '验证失败' });
    }
});

// API：生成新的密钥
app.post('/api/generate-secret', (req, res) => {
    try {
        const secret = speakeasy.generateSecret({
            name: '2FA Authenticator',
            issuer: '2FA Authenticator',
            length: 32
        });

        res.json({
            secret: secret.base32,
            qrcode: secret.otpauth_url // 可选，返回otpauth URL
        });
    } catch (error) {
        console.error('密钥生成错误:', error);
        res.status(500).json({ error: '生成密钥失败' });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`2FA 认证器运行在 http://0.0.0.0:${PORT}`);
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
});

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});

module.exports = app;
