import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { Message, AppSettings, GroundingSource } from './types';
import { ChatBubble } from './components/ChatBubble';
import { SendIcon, LoaderIcon } from './components/Icons';

const DEFAULT_DATASTORE = 'caregiver-corpus_1782918777478';
const DEFAULT_PROJECT_ID = 'gen-lang-client-0240369598';

export default function App() {
  const [settings] = useState<AppSettings>({
    projectId: 'gen-lang-client-0240369598',
    location: 'us',
    datastoreId: 'caregiver-corpus_1782918777478'
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const initChat = async () => {

    setError(null);
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
      const datastorePath = `projects/${settings.projectId}/locations/${settings.location}/collections/default_collection/dataStores/${settings.datastoreId}`;

      let activeInstructions = '';
      let activeGreeting = '';
      
      const resp = await fetch('/api/config/instructions');
      if (!resp.ok) {
        throw new Error('Failed to fetch configuration from GCS');
      }
      const data = await resp.json();
      if (!data.instructions || !data.greeting) {
        throw new Error('Required configuration (instructions or greeting) is missing from GCS');
      }
      activeInstructions = data.instructions;
      activeGreeting = data.greeting;

      const session = ai.chats.create({
        model: 'gemini-3.5-flash',
        config: {
          systemInstruction: activeInstructions,
          temperature: 0.0,
          tools: [{
            retrieval: {
              vertexAiSearch: {
                datastore: datastorePath
              }
            }
          }] as any
        }
      });

      setChatSession(session);
      setMessages([{
        role: 'model',
        text: activeGreeting
      }]);

    } catch (err: any) {
      console.error("Initialization error:", err);
      setError(`Failed to initialize chat: ${err.message || 'Unknown error'}`);
      setChatSession(null);
    } finally {
      setIsConnecting(false);
    }
  };

  // Auto-connect on startup
  useEffect(() => {
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSend = async (userText: string, retryCount: number = 0) => {
    try {
      let strictReminder = "\n\n[STRICT REMINDER: Answer ONLY using the medical corpus. If the answer isn't there, say you don't know. Do not speculate.]";
      if (retryCount > 0) {
        strictReminder += "\n[ADDITIONAL REMINDER: Your previous response did not cite the provided dataset. You MUST ground your answer in the provided dataset. Do not use outside knowledge.]";
      }
      
      const responseStream = await chatSession!.sendMessageStream({ message: userText + strictReminder });

      setMessages(prev => [...prev, { role: 'model', text: '', isStreaming: true }]);

      let fullResponse = '';
      let extractedSources: GroundingSource[] = [];

      for await (const chunk of responseStream) {
        const chunkText = chunk.text || '';
        fullResponse += chunkText;

        const candidate = chunk.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          const chunks = groundingMetadata.groundingChunks;
          const sourcesList: GroundingSource[] = chunks.map((c: any) => {
            const uri = c.web?.uri || c.retrievalChunk?.uri || c.retrievalChunk?.source?.uri || c.retrievalChunk?.metadata?.uri || '';
            const title = c.web?.title || c.retrievalChunk?.title || c.retrievalChunk?.source?.title || c.retrievalChunk?.metadata?.title || '';

            let bucketName = undefined;
            let fileName = undefined;

            if (uri.startsWith('gs://')) {
              const pathParts = uri.replace('gs://', '').split('/');
              bucketName = pathParts[0];
              fileName = pathParts.slice(1).join('/');
            }

            return {
              title: title || fileName || uri.split('/').pop() || 'Document',
              uri,
              bucketName,
              fileName
            };
          }).filter((s: GroundingSource) => s.uri || s.title);

          if (sourcesList.length > 0) {
            const uniqueSources = Array.from(new Map(sourcesList.map(item => [item.uri, item])).values());
            extractedSources = uniqueSources.filter(s => s.uri);
          }
        }

        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = {
            role: 'model',
            text: fullResponse,
            isStreaming: true,
            sources: extractedSources.length > 0 ? extractedSources : undefined
          };
          return newMsgs;
        });
      }

      const wasGrounded = extractedSources.length > 0;
      
      if (!wasGrounded && fullResponse.trim().length > 0 && retryCount < 1) {
        console.log("[Grounding Gate] Response ungrounded. Silently retrying...");
        setMessages(prev => prev.slice(0, -1)); // Remove the ungrounded stream message
        await performSend(userText, retryCount + 1);
        return;
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          role: 'model',
          text: fullResponse,
          isStreaming: false,
          sources: extractedSources.length > 0 ? extractedSources : undefined
        };
        return newMsgs;
      });

    } catch (err: any) {
      console.error("Send message error:", err);
      setError(`Error communicating with the agent: ${err.message || 'Unknown error'}`);
      setMessages(prev => prev.filter(m => m.isStreaming !== true));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSession || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);
    setError(null);

    await performSend(userText);
    
    setIsLoading(false);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">


      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Header */}
        <header className="h-20 bg-white border-b flex items-center justify-between px-4 sm:px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2">
              <img src="/logo.png" alt="SCD Advisor Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 leading-tight">Sickle Cell Advisor</h1>
              <span className="text-[10px] text-gray-500 font-medium block -mt-0.5">v1.0.1</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end justify-center text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-none mb-0.5">Maryland Department of Health</span>
              <span className="text-xs font-semibold text-gray-700 leading-tight">Office of Children and Youth with Specific Health Care Needs</span>
            </div>
            <div className="h-12 w-px bg-gray-200 hidden lg:block mx-1"></div>
            <img src="/mdh-logo.jpg" alt="Maryland Department of Health" className="h-12 w-auto object-contain" />
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 ml-2">
              <span className={`w-2 h-2 rounded-full ${chatSession ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-xs text-gray-600 font-medium">
                {chatSession ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50/50">
          {messages.length === 0 && !error && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                <LoaderIcon className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
              <p className="text-gray-600 font-medium">Connecting to Sickle Cell Advisor datastore...</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatBubble key={idx} message={msg} />
          ))}

          {error && (
            <div className="flex justify-center my-4">
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 max-w-lg text-center shadow-sm">
                {error}
                <div className="mt-2">
                  <button
                    onClick={initChat}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-semibold transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-shrink-0">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={chatSession ? "Ask a question about sickle cell..." : "Connecting to datastore..."}
              disabled={!chatSession || isLoading}
              className="flex-1 min-h-[52px] max-h-32 p-3.5 pr-14 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none resize-none transition-all disabled:opacity-60 disabled:bg-gray-100 text-[15px]"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !chatSession || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex items-center justify-center shadow-sm"
              aria-label="Send message"
            >
              {isLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
            </button>
          </div>
          <div className="text-center mt-2.5">
            <p className="text-[11px] text-gray-400 font-medium">
              Responses are generated by AI and based solely on the provided medical corpus.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
