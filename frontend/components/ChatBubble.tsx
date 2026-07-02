import React from 'react';
import { Message } from '../types';
import { UserIcon, BotIcon } from './Icons';

interface ChatBubbleProps {
  message: Message;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const bubbleClass = isUser
    ? 'bg-blue-600 text-white rounded-br-none'
    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm';
  const alignClass = isUser ? 'self-end flex-row-reverse' : 'self-start flex-row';

  // Simple formatter to handle basic markdown-like bolding and newlines
  const formatText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <span key={i} className="block min-h-[1.25rem]">
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </span>
    ));
  };

  return (
    <div className={`flex gap-4 max-w-[85%] ${alignClass}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isUser ? 'bg-blue-700' : 'bg-teal-600'}`}>
        {isUser ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-white" />}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={`px-5 py-3.5 rounded-2xl ${bubbleClass} leading-relaxed text-[15px]`}>
          {formatText(message.text)}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle rounded-sm" />
          )}
        </div>
        
        {/* Grounding Sources Display with explicit Cloud Storage bucket/file linkage */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="px-2 mt-1">
            <p className="text-xs font-semibold text-gray-500 mb-1">Sources used from medical corpus:</p>
            <div className="flex flex-col gap-1.5">
              {message.sources.filter(s => s.uri).map((source, idx) => {
                const isGs = source.uri?.startsWith('gs://');
                let consoleLink = source.uri;
                if (isGs && source.bucketName && source.fileName) {
                  consoleLink = `https://console.cloud.google.com/storage/browser/_details/${source.bucketName}/${source.fileName}`;
                }

                return (
                  <a 
                    key={idx} 
                    href={consoleLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={source.uri}
                    className="flex flex-col p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 transition-colors no-underline cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800 group-hover:text-blue-700 transition-colors">
                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate max-w-[200px] sm:max-w-md">{source.title}</span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        View Source
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </span>
                    </div>
                    {isGs && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500 font-mono">
                        <span><strong className="font-semibold text-gray-600">Bucket:</strong> {source.bucketName}</span>
                        <span className="truncate"><strong className="font-semibold text-gray-600">Path:</strong> {source.fileName}</span>
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
