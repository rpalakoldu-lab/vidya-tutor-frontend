import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Explicit CORS gateway mapping configured to prevent 'Failed to Fetch' browser blocks
app.use(cors({
    origin: ['http://localhost:3000', 'https://vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

// Establish secure integration hooks directly targeting your Supabase data cluster
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Simli WebRTC Session Allocation Endpoint + Supabase Ingestion Log
app.post('/api/tutor/session', async (req, res) => {
    try {
        console.log('📬 Inbound session request received from client layout...');
        
        const response = await fetch('https://simli.ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SIMLI_API_KEY}`
            },
            body: JSON.stringify({
                faceId: process.env.SIMLI_FACE_ID,
                isInteractive: true,
                audioProvider: 'Base64', 
                outputFormat: 'PCM_16K'
            })
        });
        
        const data = await response.json();

        // Inserts a clean reference tracking index row down into Supabase
        const { data: sessionRecord, error } = await supabase
            .from('tutor_sessions')
            .insert([{ simli_session_id: data.session_id, university_syllabus: 'General Engineering' }])
            .select()
            .single();

        if (error) console.error('Supabase Session tracking write skipped:', error.message);

        console.log('✅ WebRTC session tokens negotiated successfully. Syncing context...');
        return res.status(200).json({
            ...data,
            db_session_id: sessionRecord?.id
        });
    } catch (error) {
        console.error('Simli allocation crash:', error);
        return res.status(500).json({ error: 'Failed to negotiate video avatar stream layer.' });
    }
});

// 2. Bidirectional Audio Bridge (Student Microphone <-> Backend <-> Gemini Live API)
wss.on('connection', (ws) => {
    console.log('⚡ Student video tutor session connected via WebSocket');
    let activeDbSessionId = null;

    const geminiUri = `wss://://googleapis.com{GEMINI_API_KEY}`;
    const geminiWs = new WebSocket(geminiUri);

    geminiWs.on('open', () => {
        console.log(' Connected safely to Gemini Live Stream API');
        
        const configContext = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                generationConfig: {
                    responseModalities: ["AUDIO", "TEXT"],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
                    }
                },
                systemInstruction: {
                    parts: [{ text: "You are Vidya, a brilliant, highly encouraging AI Video Tutor for Indian college students. Explain technical concepts simply using relatable analogies and everyday examples. Reference standard patterns or questions found in major Indian university syllabi (like VTU, Anna University, Mumbai University) whenever relevant. Keep your explanations highly interactive, conversational, and split into punchy fragments." }]
                }
            }
        };
        geminiWs.send(JSON.stringify(configContext));
    });

    // Ingest data chunks passed from the user client microphone
    ws.on('message', async (message) => {
        try {
            // Handle session linkage tokens passed by client configuration strings
            if (typeof message === 'string') {
                const parsedHeaders = JSON.parse(message);
                if (parsedHeaders.type === 'SET_SESSION_ID') {
                    activeDbSessionId = parsedHeaders.payload;
                    console.log(`📌 Database tracking mapped to Session ID: ${activeDbSessionId}`);
                    return;
                }
            }
        } catch (e) {}

        if (geminiWs.readyState === WebSocket.OPEN && Buffer.isBuffer(message)) {
            const base64Audio = message.toString('base64');
            const audioFrame = {
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio
                    }]
                }
            };
            geminiWs.send(JSON.stringify(audioFrame));
        }
    });

    // Pipe Gemini replies back to the student client and write text transcripts to Supabase
    geminiWs.on('message', async (data) => {
        try {
            const responseFrame = JSON.parse(data.toString());
            
            // FIXED: Clean array-safe index accessor applied here on line 135
            const audioContent = responseFrame.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioContent && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'AUDIO_CHUNK',
                    payload: audioContent
                }));
            }

            // Extract text responses and log into the conversation database safely
            const aiTextReply = responseFrame.serverContent?.modelTurn?.parts?.[0]?.text;
            if (aiTextReply && activeDbSessionId) {
                await supabase
                    .from('conversation_logs')
                    .insert([{ session_id: activeDbSessionId, speaker: 'vidya', transcript_text: aiTextReply }]);
            }
        } catch (e) {
            // Safe fallback metadata handler
        }
    });

    ws.on('close', () => {
        console.log(' Student closed tutor session');
        geminiWs.close();
    });

    geminiWs.on('close', () => ws.close());
    geminiWs.on('error', (err) => console.error('Gemini Stream Error:', err));
    ws.on('error', (err) => console.error('Client Gateway Error:', err));
});

server.listen(PORT, () => console.log(`🚀 Vidya FullStack Unified Server running on port ${PORT}`));
