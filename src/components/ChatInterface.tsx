"use client"
import React, { FC, useEffect, useRef, useState } from 'react'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { Button } from './ui/button'
import { ArrowRight } from 'lucide-react'
import { ChatRequestBody, StreamMessageType } from '@/lib/types'
import { createSSEParser } from '@/lib/createSSEParser'
import { getConvexClient } from '@/lib/convext'
import { api } from '../../convex/_generated/api'
import MessageBubble from './MessageBubble'

interface ChatProps {
    chatId: Id<"chats">,
    initialMessages: Doc<"messages">[]
}

const formatToolOutput = (output: unknown): string => {
    if (typeof output === "string") return output;
    return JSON.stringify(output, null, 2);
};

const formatTerminalOutput = (
    tool: string,
    input: unknown,
    output: unknown
) => {
    const terminalHtml = `<div class="bg-[#1e1e1e] text-white font-mono p-2 rounded-md my-2 overflow-x-auto whitespace-normal max-w-[600px]">
      <div class="flex items-center gap-1.5 border-b border-gray-700 pb-1">
        <span class="text-red-500">●</span>
        <span class="text-yellow-500">●</span>
        <span class="text-green-500">●</span>
        <span class="text-gray-400 ml-1 text-sm">~/${tool}</span>
      </div>
      <div class="text-gray-400 mt-1">$ Input</div>
      <pre class="text-yellow-400 mt-0.5 whitespace-pre-wrap overflow-x-auto">${formatToolOutput(input)}</pre>
      <div class="text-gray-400 mt-2">$ Output</div>
      <pre class="text-green-400 mt-0.5 whitespace-pre-wrap overflow-x-auto">${formatToolOutput(output)}</pre>
    </div>`;

    return `---START---\n${terminalHtml}\n---END---`;
}

const ChatInterface: FC<ChatProps> = ({ chatId, initialMessages }) => {
    const [messages, setMessages] = useState<Doc<"messages">[]>(initialMessages)
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [streamResponse, setStreamResponse] = useState("")
    const [currentTool, setCurrentTool] = useState<{
        name: string,
        input: unknown
    } | null>(null)
    
    const messageEndRef = useRef<HTMLDivElement>(null)

    const processStream = async (reader: ReadableStreamDefaultReader<Uint8Array>, onChunk: (chunk: string) => Promise<void>) => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await onChunk(new TextDecoder().decode(value))
            }
        } catch (error) {
            console.error(error);
            reader.releaseLock()
        }
    }

    useEffect(() => {
        if (messageEndRef) {
            messageEndRef.current?.scrollIntoView({behavior: 'smooth'})
        }
    }, [messages, messageEndRef])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmedInput = input.trim()
        if (!trimmedInput || isLoading) {
            return;
        }

        setInput("")
        setStreamResponse("")
        setCurrentTool(null)
        setIsLoading(false)

        const optimisticUseMessage: Doc<"messages"> ={
            _id: `temp_${Date.now()}`,
            chatId,
            content: trimmedInput,
            role: "user",
            createdAt: Date.now(),
        } as Doc<"messages">

        setMessages([...messages, optimisticUseMessage])

        let fullResponse = ""

        try {
            const requestBody: ChatRequestBody = {
                messages: messages.map((msg) => {
                    return {
                        role: msg.role,
                        content: msg.content
                    }   
                }),
                newMessage: trimmedInput,
                chatId
            }

            const response = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) throw new Error(await response.text())
            if (!response.body) throw new Error("No response body available")
            
            // handle responses

            const parser = createSSEParser()

            const reader = response.body.getReader()

            await processStream(reader, async(chunk) => {
                const messages = parser.parse(chunk)

                for (const msg of messages) {
                    console.log(msg.type)
                    switch (msg.type) {
                        case StreamMessageType.Token:
                            if ("token" in msg) {
                                fullResponse += msg.token
                                setStreamResponse(fullResponse)
                            }
                            break;
                        case StreamMessageType.ToolStart:
                            if ("tool" in msg) {
                                setCurrentTool({
                                    name: msg.tool,
                                    input: msg.input
                                })
                                fullResponse += formatTerminalOutput(
                                    msg.tool,
                                    msg.input,
                                    "Processing..."
                                );
                                setStreamResponse(fullResponse)
                            }
                            break;
                        case StreamMessageType.ToolEnd:

                            if ("tool" in msg && currentTool) {
                                const lastTerminalIndex = fullResponse.lastIndexOf("<div class='bg-[#1e1e1e]'")

                                if (lastTerminalIndex !== -1) {
                                    fullResponse = fullResponse.substring(0, lastTerminalIndex) + formatTerminalOutput(
                                        msg.tool,
                                        msg.type,
                                        msg.output
                                    )
                                    setStreamResponse(fullResponse)
                                }
                                setCurrentTool(null)
                            }
                            break;
                        
                        case StreamMessageType.Error:
                            if ("error" in msg) {
                                throw new Error(msg.error)
                            }
                            break;
                        
                        case StreamMessageType.Done:
                            const assistantMessage: Doc<"messages"> = {
                                _id: `temp_assistant_${Date.now()}`,
                                chatId,
                                content: fullResponse,
                                role: 'assistant',
                                createdAt: Date.now()
                            } as Doc<"messages">

                            const convex = getConvexClient()
                            await convex.mutation(api.messages.store, {
                                chatId,
                                content: fullResponse,
                                role: 'assistant'
                            });
                            setMessages((prev) => [...prev, assistantMessage])
                            setStreamResponse("")

                    }
                    
                }
            })

        } catch (error) {
            console.error("Error sending message",error)
            setMessages((prev)=> prev.filter((msg)=> msg._id !== optimisticUseMessage._id))
            setStreamResponse(
                formatTerminalOutput(
                    "error",
                    "Failed to process message",
                    error instanceof Error ? error.message: "Unknown error"
                )
            )
        } finally {
            setIsLoading(false)
        }
    }

    
    return (<main className='flex flex-col h-[calc(100vh-theme(spacing.14))]'>
        {/* Messages */}
        <section className='flex-1 overflow-y-auto bg-gray-50 p-2 md:p-0'>
            <div className='max-w-4xl mx-auto p-4 space-y-3'>
                {
                    messages.map((msg) => {
                        return <MessageBubble key={msg._id} content={msg.content} isUser={msg.role==="user"} />
                    })
                }
                {streamResponse && <MessageBubble content={streamResponse} />}
                 {isLoading && !streamResponse && (
                <div className="flex justify-start animate-in fade-in-0">
                    <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 rounded-bl-none shadow-sm ring-1 ring-inset ring-gray-200">
                    <div className="flex items-center gap-1.5">
                        {[0.3, 0.15, 0].map((delay, i) => (
                        <div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: `-${delay}s` }}
                        />
                        ))}
                    </div>
                    </div>
                </div>
                )}
                <div ref={messageEndRef} />
            </div>

        </section>
        <footer className='border-t bg-white p-4'>
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message AI Agent..."
              className="flex-1 py-3 px-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 bg-gray-50 placeholder:text-gray-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`absolute right-1.5 rounded-xl h-9 w-9 p-0 flex items-center justify-center transition-all ${
                input.trim()
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <ArrowRight />
            </Button>
          </div>
        </form>
        </footer>
  </main>
  )
}

export default ChatInterface