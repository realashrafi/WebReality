//@ts-nocheck
import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import jsQR from 'jsqr';

const ContentManager = {
    async fetchContent(qrData) {
        try {
            const response = await fetch(qrData); // مثلاً https://jsonplaceholder.typicode.com/posts/1
            if (!response.ok) throw new Error('خطا در دریافت داده از API');
            const data = await response.json();
            return {
                type: 'aframe',
                content: `
          <a-plane position="0 0.5 0" width="2" height="1" material="color: #f0f0f0; opacity: 0.9" animation="property: position; from: 0 1 0; to: 0 0.5 0; dur: 500; easing: easeOutQuad">
            <a-text value="${data.title}\n${data.body}" color="black" align="center" width="1.8" wrap-count="30"></a-text>
          </a-plane>
        `,
            };
        } catch (err) {
            throw new Error('خطا در دریافت محتوا: ' + err.message);
        }
    },
};

const ARIntegrated = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let scanInterval = null;
        let stream = null;

        const startCamera = async () => {
            try {
                // فقط اگه استریم وجود نداشته باشه، درخواست جدید بده
                if (!stream) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' },
                    });
                    video.srcObject = stream;
                    // صبر کن تا متادیتای ویدیو لود بشه قبل از play
                    video.onloadedmetadata = () => {
                        video.play().catch((err) => {
                            setError('خطا در پخش ویدیو: ' + err.message);
                        });
                        startScanning();
                    };
                }
            } catch (err) {
                setError('خطا در دسترسی به دوربین: ' + err.message);
            }
        };

        const startScanning = () => {
            scanInterval = setInterval(() => {
                if (!isScanning) return;
                scanQRCode();
            }, 100); // اسکن هر 100ms
        };

        const scanQRCode = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.height = video.videoHeight;
                canvas.width = video.videoWidth;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    setIsScanning(false);
                    fetchAndRenderContent(code.data);
                }
            }
        };

        const fetchAndRenderContent = async (qrData) => {
            setLoading(true);
            try {
                if (!qrData.startsWith('https://jsonplaceholder.typicode.com/posts/')) {
                    throw new Error('QR نامعتبر است');
                }
                const newContent = await ContentManager.fetchContent(qrData);
                setContent(newContent);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
                setTimeout(() => setIsScanning(true), 3000); // اسکن دوباره بعد از 3 ثانیه
            }
        };

        startCamera();

        return () => {
            clearInterval(scanInterval);
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [isScanning]);

    return (
        <motion.div
            className="w-full max-w-md mx-auto text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <h2 className="text-2xl font-bold text-white mb-4">اسکن و نمایش AR</h2>
            <div className="relative rounded-lg overflow-hidden shadow-lg">
                <a-scene
                    vr-mode-ui="enabled: false"
                    arjs="sourceType: webcam; debugUIEnabled: false; trackingMethod: best; sourceWidth: 1280; sourceHeight: 720;"
                >
                    <a-marker type="pattern" url="/qr.patt">
                        {content && content.type === 'aframe' && (
                            <a-entity dangerouslySetInnerHTML={{ __html: content.content }} />
                        )}
                    </a-marker>
                    <a-entity camera></a-entity>
                </a-scene>
                <video ref={videoRef} className="hidden" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                {loading && (
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <p className="text-white">در حال لود کردن محتوا...</p>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <p className="text-white">{error}</p>
                    </motion.div>
                )}
                <motion.div
                    className="absolute inset-0 border-4 border-transparent"
                    animate={{
                        borderColor: ['rgba(59, 130, 246, 0.5)', 'rgba(59, 130, 246, 0.2)'],
                    }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                />
            </div>
            <p className="text-gray-300 mt-2">
                {isScanning ? 'دوربین رو روی کد QR بگیر' : 'QR شناسایی شد!'}
            </p>
        </motion.div>
    );
};

export default ARIntegrated;