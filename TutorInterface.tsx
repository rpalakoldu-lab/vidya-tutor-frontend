'use client';

import React, { useRef, useState } from 'react';
import { Mic, MicOff, Video, Loader2, BookOpen } from 'lucide-react';

export default function TutorInterface() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [tutorStatus, setTutorStatus] = useState('Idle');

    const startTutorSession = async () => {
        setIsConnecting(true);
        setTutorStatus('Allocating Simli Avatar...');
        try {
            const sessionResponse = await fetch('http://localhost:5000/api/tutor/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const sessionData = await sessionResponse.json();
            
            if (!sessionResponse.ok) throw new Error(sessionData.error || 'Session negotiation failed');

            setTutorStatus('Bridging Voice WebSocket...');
            const socket = new WebSocket('ws://localhost:5000');
            wsRef.current = socket;

            socket.onopen = () => {
                console.log('Vidya Voice Bridge Established');
                startMicrophoneIngestion(socket);
            };

            setTutorStatus('Establishing WebRTC Link...');
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:://google.com' },
                    { urls: 'stun:://google.com' }
                ]
            });
            peerConnectionRef.current = pc;

            pc.ontrack = (event) => {
                console.log('Receive Track from Simli Edge:', event.streams);
                if (videoRef.current && event.streams) {
                    videoRef.current.srcObject = event.streams;
                }
            };

            pc.createDataChannel('datachannel');

            if (sessionData.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sessionData.sdp }));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
            }

            setIsSessionActive(true);
            setIsConnecting(false);
            setTutorStatus('Listening live...');

        } catch (error) {
            console.error('Core Signaling Stack Crash:', error);
            alert('Failed to boot pipeline. Ensure backend on port 5000 is running.');
            setIsConnecting(false);
            setTutorStatus('Connection Error');
        }
    };

    const startMicrophoneIngestion = async (socket: WebSocket) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source.connect(processor);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
                if (isMuted) return;
                const floatSamples = e.inputBuffer.getChannelData(0);
                
                const int16Buffer = new Int16Array(floatSamples.length);
                for (let i = 0; i < floatSamples.length; i++) {
                    int16Buffer[i] = Math.min(1, Math.max(-1, floatSamples[i])) * 0x7FFF;
                }

                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(int16Buffer.buffer);
                }
            };
        } catch (err) {
            console.error('Microphone allocation denied:', err);
            setTutorStatus('Mic Access Denied');
        }
    };

    const closeSession = () => {
        processorRef.current?.disconnect();
        audioContextRef.current?.close();
        wsRef.current?.close();
        peerConnectionRef.current?.close();
        setIsSessionActive(false);
        setTutorStatus('Idle');
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl w-full max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6 w-full border-b border-slate-800 pb-4 justify-between">
                <div className="flex items-center gap-2">
                    <BookOpen className="text-blue-500 w-6 h-6" />
                    <h2 className="text-xl font-bold text-white tracking-wide">Vidya: The AI Engineering Tutor</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase ${isSessionActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {tutorStatus}
                </span>
            </div>

            <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                {!isSessionActive && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                        <p className="text-slate-400 text-sm text-center max-w-md mb-6 leading-relaxed">
                            Speak to Vidya in real-time. Designed specifically to break down Indian college engineering curriculums (VTU, Anna University, Mumbai University) with zero latency.
                        </p>
                        <button 
                            onClick={startTutorSession}
                            disabled={isConnecting}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 transition-all text-white font-bold px-8 py-3 rounded-xl shadow-lg flex items-center gap-3 active:scale-95 transform"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Connecting Pipeline...
                                </>
                            ) : (
                                <>
                                    <Video className="w-5 h-5" />
                                    Initialize Live Tutor
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {isSessionActive && (
                <div className="flex items-center gap-4 mt-6">
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <button 
                        onClick={closeSession}
                        className="bg-red-600/90 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-xl transition-all"
                    >
                        Disconnect Session
                    </button>
                </div>
            )}
        </div>
    );
}
