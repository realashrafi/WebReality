//@ts-nocheck
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import jsQR, { QRCode } from 'jsqr';
import DOMPurify from 'dompurify';

interface Content {
    type: 'aframe' | 'text' | 'video';
    content: string;
}

interface ContentManager {
    fetchContent: (qrData: string) => Promise<Content>;
}

const ContentManager: ContentManager = {
    async fetchContent(qrData: string) {
        const urlRegex = /^https:\/\/jsonplaceholder\.typicode\.com\/posts\/\d+$/;
        if (!urlRegex.test(qrData)) {
            throw new Error('QR نامعتبر است: آدرس باید از jsonplaceholder باشد');
        }

        try {
            const response = await fetch(qrData);
            if (!response.ok) throw new Error('خطا در دریافت داده از API');
            const data = await response.json();

            const sanitizedTitle = DOMPurify.sanitize(data.title);
            const sanitizedBody = DOMPurify.sanitize(data.body);

            return {
                type: 'aframe',
                content: `
          <a-plane position="0 0.5 0" width="2" height="1" material="color: #f0f0f0; opacity: 0.9" animation="property: position; from: 0 1 0; to: 0 0.5 0; dur: 500; easing: easeOutQuad">
            <a-text value="${sanitizedTitle}\n${sanitizedBody}" color="black" align="center" width="1.8" wrap-count="30"></a-text>
          </a-plane>
        `,
            };
        } catch (err) {
            throw new Error('خطا در دریافت محتوا: ' + err.message);
        }
    },
};

const ARIntegratedHiro: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [content, setContent] = useState<Content | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState<boolean>(true);
    const [manualInput, setManualInput] = useState<string>('');
    const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true);

    const checkBrowserSupport = useCallback(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setIsBrowserSupported(false);
            setError('این مرورگر از دسترسی به دوربین پشتیبانی نمی‌کند');
            return false;
        }
        return true;
    }, []);

    const startCamera = useCallback(async () => {
        if (!checkBrowserSupport()) return;

        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play().catch((err) => {
                            setError('خطا در پخش ویدیو: ' + err.message);
                        });
                        startScanning();
                    };
                }
            }
        } catch (err) {
            setError('خطا در دسترسی به دوربین: ' + err.message);
        }
    }, [checkBrowserSupport]);

    const startScanning = useCallback(() => {
        const scanInterval = setInterval(() => {
            if (!isScanning) return;
            scanQRCode();
        }, 200);

        return () => clearInterval(scanInterval);
    }, [isScanning]);

    const scanQRCode = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            setIsScanning(false);
            fetchAndRenderContent(code.data);
        }
    }, []);

    const fetchAndRenderContent = useCallback(async (qrData: string) => {
        setLoading(true);
        try {
            const newContent = await ContentManager.fetchContent(qrData);
            setContent(newContent);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setTimeout(() => setIsScanning(true), 3000);
        }
    }, []);

    const handleManualSubmit = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            if (manualInput) {
                setIsScanning(false);
                fetchAndRenderContent(manualInput);
            }
        },
        [manualInput, fetchAndRenderContent]
    );

    useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, [startCamera]);

    useEffect(() => {
        const handleResize = () => {
            const renderer = document.querySelector('a-scene')?.components['three-renderer']?.renderer;
            if (renderer) {
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setPixelRatio(window.devicePixelRatio);
            }
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('fullscreenchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('fullscreenchange', handleResize);
        };
    }, []);

    if (!isBrowserSupported) {
        return (
            <motion.div
                className="w-full max-w-md mx-auto text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <p className="text-red-500" role="alert">
                    {error}
                </p>
            </motion.div>
        );
    }

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
                    arjs="sourceType: webcam; debugUIEnabled: false; trackingMethod: best; sourceWidth: 640; sourceHeight: 480;"
                    renderer="antialias: true;"
                >
                    <a-marker preset="hiro">
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
                        role="status"
                        aria-live="polite"
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
                        role="alert"
                        aria-live="assertive"
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
                >
                    <div
                        className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-blue-400"
                        style={{ margin: '10%' }}
                        aria-hidden="true"
                    />
                </motion.div>
            </div>
            <div className="mt-4">
                <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="URL را به صورت دستی وارد کنید"
                    className="p-2 rounded-md text-black"
                    aria-label="وارد کردن URL کد QR به صورت دستی"
                />
                <button
                    onClick={handleManualSubmit}
                    className="ml-2 p-2 bg-blue-500 text-white rounded-md"
                    aria-label="ارسال URL دستی"
                >
                    ارسال
                </button>
            </div>
            <button
                onClick={() => setIsScanning(true)}
                className="mt-2 p-2 bg-green-500 text-white rounded-md"
                aria-label="شروع مجدد اسکن QR"
            >
                اسکن مجدد
            </button>
            <p className="text-gray-300 mt-2" role="status" aria-live="polite">
                {isScanning ? 'دوربین را روی کد QR بگیرید و سپس مارکر Hiro را نشان دهید' : 'QR شناسایی شد!'}
            </p>
        </motion.div>
    );
};

export default ARIntegratedHiro;