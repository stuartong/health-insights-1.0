import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '@/types';
import { Bot, User } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
        isUser ? 'bg-gray-200' : 'bg-primary-100'
      }`}>
        {isUser ? (
          <User size={18} className="text-gray-600" />
        ) : (
          <Bot size={18} className="text-primary-600" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-primary-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-3">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-3">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="mb-1">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0">{children}</p>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes('language-');
                    if (isBlock) {
                      return (
                        <code className="block bg-gray-200 p-3 rounded-lg overflow-x-auto text-sm font-mono">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : ''}`}>
          {format(new Date(message.timestamp), 'h:mm a')}
        </p>
      </div>
    </div>
  );
}
