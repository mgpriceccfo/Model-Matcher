'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  edited?: boolean
}

interface Model {
  id: string
  name: string
  description: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  model: string
  systemPrompt: string
  createdAt: Date
  updatedAt: Date
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('anthropic/claude-sonnet-4')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1000)
  const [isTyping, setIsTyping] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const models: Model[] = [
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Balanced performance and speed' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Latest OpenAI model with vision' },
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Google\'s latest experimental model' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta\'s open-source model' },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const savedApiKey = localStorage.getItem('openrouter-api-key')
    const savedModel = localStorage.getItem('openrouter-model')
    const savedSystemPrompt = localStorage.getItem('system-prompt')
    
    if (savedApiKey) setApiKey(savedApiKey)
    if (savedModel) setModel(savedModel)
    if (savedSystemPrompt) setSystemPrompt(savedSystemPrompt)
  }, [])

  useEffect(() => {
    localStorage.setItem('openrouter-api-key', apiKey)
    localStorage.setItem('openrouter-model', model)
    localStorage.setItem('system-prompt', systemPrompt)
  }, [apiKey, model, systemPrompt])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !apiKey.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsTyping(true)

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Chat Assistant',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ],
          temperature: temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.choices[0]?.message?.content || 'No response received',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API key and try again.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const exportChat = () => {
    const chatData = {
      messages,
      model,
      systemPrompt,
      timestamp: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`${showSettings ? 'w-96' : 'w-0'} transition-all duration-300 bg-muted/30 border-r border-border overflow-hidden`}>
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Enter your OpenRouter API key..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your API key is stored locally and never shared.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Temperature: {temperature}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Higher values make responses more creative but less predictable.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Tokens: {maxTokens}</label>
              <input
                type="range"
                min="100"
                max="4000"
                step="100"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-24 p-3 rounded-md border border-input bg-background text-sm resize-none"
                placeholder="Define the AI's behavior and personality..."
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={clearChat}
                className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm"
              >
                Clear Chat
              </button>
              <button
                onClick={exportChat}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-sm"
              >
                Export Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div>
            <h1 className="text-xl font-semibold">AI Chat Assistant</h1>
            <p className="text-sm text-muted-foreground">{models.find(m => m.id === model)?.name}</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            {showSettings ? 'Hide' : 'Show'} Settings
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-semibold mb-2">Welcome to AI Chat</h2>
                <p className="text-muted-foreground mb-4">Configure your API key in settings to get started.</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>1. Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenRouter</a></p>
                  <p>2. Paste it in the settings panel</p>
                  <p>3. Start chatting!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-2xl px-4 py-3 rounded-lg bg-muted">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border px-6 py-4">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={apiKey.trim() ? "Type your message... (Shift+Enter for new line)" : "Configure API key in settings first..."}
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              disabled={isLoading || !apiKey.trim()}
              rows={1}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !apiKey.trim()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
