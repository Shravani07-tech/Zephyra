import React from "react";
import ReactMarkdown from "react-markdown";
import type { Message as MessageType } from "../api/types";

interface MessageProps {
  message: MessageType;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`w-full flex flex-col py-4 opacity-0 animate-message-reveal ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      <div className={`${isUser ? "max-w-[90%] md:max-w-[620px]" : "w-full"}`}>
        {/* Technical mono label */}
        <div className={`flex items-center gap-2 font-mono text-[8px] md:text-[9px] tracking-widest uppercase text-zephyra-text-veryMuted mb-2.5 select-none ${
          isUser ? "justify-end" : "justify-start"
        }`}>
          {!isUser && (
            <span className="h-1.5 w-1.5 rounded-full bg-zephyra-accent shadow-[0_0_8px_rgba(0,201,167,0.4)]" />
          )}
          <span>{isUser ? "User Node" : "Zephyra Response"}</span>
        </div>

        {/* Message bubble / accent line */}
        {isUser ? (
          <div className="bg-[#1A2235]/15 border border-zephyra-border-surface/50 rounded-2xl rounded-tr-sm px-4.5 py-3.5 shadow-sm text-left">
            <div className="font-sans leading-relaxed text-sm tracking-wide text-zephyra-text-secondary font-normal whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>
        ) : (
          <div className="border-l-2 border-zephyra-accent/40 pl-4 py-0.5 text-left">
            <div className="font-sans leading-relaxed text-sm tracking-wide text-zephyra-text-primary font-normal break-words">
              <ReactMarkdown
                components={{
                  h1: (props) => <h1 className="text-base font-bold my-3 text-zephyra-accent" {...props} />,
                  h2: (props) => <h2 className="text-sm font-bold my-2 text-zephyra-accent" {...props} />,
                  h3: (props) => <h3 className="text-xs font-bold my-1 text-zephyra-text-primary" {...props} />,
                  p: (props) => <p className="mb-2 leading-relaxed" {...props} />,
                  ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                  ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                  li: (props) => <li className="pl-0.5 mb-0.5" {...props} />,
                  pre: (props) => <pre className="bg-[#08090D]/60 border border-zephyra-border-surface/40 p-3 rounded-lg overflow-x-auto my-3 font-mono text-xs text-zephyra-text-primary custom-scrollbar" {...props} />,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-[#1A2235]/40 text-zephyra-accent px-1.5 py-0.5 rounded font-mono text-[11px]" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="font-mono text-xs text-zephyra-text-primary" {...props}>
                        {children}
                      </code>
                    );
                  },
                  a: (props) => <a className="text-zephyra-accent hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
