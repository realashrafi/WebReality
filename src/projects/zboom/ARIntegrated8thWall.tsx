//@ts-nocheck
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import jsQR, { QRCode } from 'jsqr';
import DOMPurify from 'dompurify';
import * as XR from '@8thwall/xr'; // فرضی: SDK 8th Wall
import * as THREE from 'three';

// توجه: باید 8th Wall SDK رو به پروژه اضافه کنی و API Key رو تنظیم کنی
// <script src="https://apps.8thwall.com/xrweb?appKey=YOUR_8TH_WALL_API_KEY"></script>

interface Content {
    type: 'three' | 'text' | 'video';
    content: JSX.Element;
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
                type: 'three',
                content: (
                    <group position={[0, 0.5, 0]}>
                        <mesh>
                            <planeGeometry args={[2, 1]} />
                            <meshBasicMaterial color="#f0f0f0" opacity={0.9} transparent />
                        </mesh>
                        <mesh position={[0, 0, 0.01]}>
                            <textGeometry
                                args={[`${sanitizedTitle}\n${sanitizedBody}`, { font: 'helvetiker', size: 0.1, height: 0 }]}
                            />
                            <meshBasicMaterial color="black" />
                        </mesh>
                    </group>
                ),
            };
        } catch (err) {
            throw new Error('خطا در دریافت محتوا: ' + err.message);
        }
    },
};

const ARIntegrated8thWall: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [content, setContent] = useState<Content | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState<boolean>(true);
    const [manualInput, setManualInput] = useState<string>('');
    const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true);
    const xrRef = useRef<any>(null);

    const checkBrowserSupport = useCallback(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !XR) {
            setIsBrowserSupported(false);
            setError('این مرورگر از دسترسی به دوربین یا 8th Wall پشتیبانی نمی‌کند');
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
        // تنظیم 8th Wall
        if (XR) {
            XR.XrController.configure({
                enableWorldTracking: false,
                enableImageTracking: true,
            });
            XR.XrController.pipelineModule({
                name: 'app',
                onStart: () => {
                    console.log('8th Wall XR Started');
                },
                onUpdate: () => {
                    // به‌روزرسانی‌های AR در اینجا
                },
            });
            xrRef.current = XR.XrController.start();
        }
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (xrRef.current) {
                xrRef.current.stop();
            }
        };
    }, [startCamera]);

    useEffect(() => {
        const handleResize = () => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                const gl = canvas.getContext('webgl');
                if (gl) {
                    gl.viewport(0, 0, window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
                }
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
            <h2 className="text-2xl font-bold text-white mb-4">اسکن و نمایش AR با 8th Wall</h2>
            <div className="relative rounded-lg overflow-hidden shadow-lg">
                <Canvas
                    gl={{ antialias: true, pixelRatio: window.devicePixelRatio }}
                    style={{ width: '100%', height: '400px' }}
                >
                    <XR.ImageTarget target="qrcode">
                        {content && content.type === 'three' && content.content}
                    </XR.ImageTarget>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                </Canvas>
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
                {isScanning ? 'دوربین را روی کد QR بگیرید' : 'QR شناسایی شد!'}
            </p>
        </motion.div>
    );
};

export default ARIntegrated8thWall;