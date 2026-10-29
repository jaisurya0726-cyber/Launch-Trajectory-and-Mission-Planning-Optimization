import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Cpu,
  Flame,
  ShieldCheck,
  ChevronDown,
  Info,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Mission } from "../types";
import { useTheme } from "../context/ThemeContext";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
  isError?: boolean;
}

interface GeminiChatbotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeMission: Mission;
  activeTab?: number;
}

const STORAGE_KEY = "aeroquantum_gemini_chat_history";

const MODEL_OPTIONS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tag: "General",
    desc: "Balanced general aerospace & quantum reasoning",
    color: "text-cyan-400 border-cyan-500/40 bg-cyan-950/40",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    tag: "Fast",
    desc: "Ultra-fast telemetry checks & quick queries",
    color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/40",
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    tag: "Complex",
    desc: "Deep mathematical reasoning & quantum statevectors",
    color: "text-purple-400 border-purple-500/40 bg-purple-950/40",
  },
];

const ROLES = [
  { id: "aerospace", label: "Aerospace Dynamics", icon: Flame, desc: "RK4 trajectory, Tsiolkovsky, Max-Q & Re-entry" },
  { id: "quantum", label: "Quantum Computing", icon: Cpu, desc: "QUBO Ising matrices, QAOA circuit, QEC & Fidelity" },
  { id: "risk", label: "Mission Risk & Safety", icon: ShieldCheck, desc: "Launch window, weather constraints & risk matrix" },
];

export const GeminiChatbotSidebar: React.FC<GeminiChatbotSidebarProps> = ({
  isOpen,
  onClose,
  activeMission,
  activeTab = 0,
}) => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      {
        id: "welcome-msg",
        role: "assistant",
        content: `Greetings! I am **Gemini**, your Aerospace Flight Dynamics & Quantum Optimization intelligence partner.\n\nI have real-time access to the **AeroQuantum** numerical solvers, 4th-order Runge-Kutta flight dynamics, 9-qubit QAOA quantum circuits, and Sutton-Graves atmospheric re-entry parameters.\n\nHow can I assist your mission planning today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: "gemini-3.8-flash",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");
  const [selectedRole, setSelectedRole] = useState("aerospace");
  const [includeContext, setIncludeContext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  const handleSendMessage = async (userText?: string) => {
    const textToSend = (userText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const payload: any = {
        messages: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        model: selectedModel,
        role: selectedRole,
      };

      if (includeContext && activeMission) {
        payload.missionContext = {
          mission_id: activeMission.mission_id,
          satellite_name: activeMission.satellite_name,
          rocket: activeMission.rocket,
          target_orbit: activeMission.target_orbit,
          altitude: activeMission.altitude,
          payload_mass: activeMission.payload_mass,
          delta_v: activeMission.delta_v,
          specific_impulse: activeMission.specific_impulse,
          thrust: activeMission.thrust,
          safety_status: activeMission.safety_status,
          risk_score: activeMission.risk_score,
          trajectory_type: activeMission.trajectory_type,
          current_stage: activeTab + 1,
        };
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      const botMessage: ChatMessage = {
        id: "bot-" + Date.now(),
        role: "assistant",
        content: data.reply || "No response received.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: data.model || selectedModel,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `⚠️ **Error communicating with Gemini:**\n${err?.message || "Failed to reach backend."}\n\nPlease verify that your server is running or try another question.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Clear all Gemini chat history?")) {
      const initial: ChatMessage[] = [
        {
          id: "welcome-msg-" + Date.now(),
          role: "assistant",
          content: "Chat history cleared. How can I assist with your launch trajectory or quantum optimization?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          model: selectedModel,
        },
      ];
      setMessages(initial);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick suggestion chips based on active workflow
  const SUGGESTED_PROMPTS = [
    `Analyze ${activeMission?.rocket || "vehicle"} delta-V budget & payload margin`,
    "Explain the 9-qubit QUBO Ising Hamiltonian formulation",
    "How does Sutton-Graves compute hypersonic heat flux?",
    "Compare classical simulated annealing vs QAOA quantum circuit",
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl ${
          isExpanded ? "w-full md:w-[680px]" : "w-full sm:w-[440px] md:w-[480px]"
        } ${isOpen ? "translate-x-0" : "translate-x-full"} ${
          isDark
            ? "bg-[#090d16] text-slate-200 border-l border-slate-800"
            : "bg-white text-slate-800 border-l border-slate-200"
        }`}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-500/40 text-cyan-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Chat with Gemini</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold uppercase">
                  AI Copilot
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span>Aerospace &amp; Quantum Intelligence</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors hidden sm:flex cursor-pointer"
              title={isExpanded ? "Collapse width" : "Expand width"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClearChat}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Close Chatbot Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Configuration Bar: Model Selection & Role Toggle */}
        <div className="px-4 py-2.5 border-b border-slate-800/70 bg-slate-900/50 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Model Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 hover:border-cyan-500/50 transition-colors cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold">
                  {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.name || selectedModel}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300">
                  {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.tag}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>

              {showModelPicker && (
                <div className="absolute left-0 top-full mt-1.5 w-64 p-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl z-30 space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 px-2 py-1 uppercase">
                    Select Gemini Model
                  </div>
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSelectedModel(opt.id);
                        setShowModelPicker(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-colors cursor-pointer flex flex-col gap-0.5 ${
                        selectedModel === opt.id
                          ? "bg-cyan-950/60 border border-cyan-500/50 text-white"
                          : "hover:bg-slate-900 text-slate-300 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{opt.name}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded font-bold uppercase bg-slate-900 text-cyan-400">
                          {opt.tag}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Telemetry Context Toggle */}
            <button
              onClick={() => setIncludeContext((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                includeContext
                  ? "bg-cyan-950/70 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-950 border-slate-800 text-slate-500"
              }`}
              title="Include real-time parameters of the currently selected mission"
            >
              <Info className="w-3 h-3" />
              <span>Telemetry: {includeContext ? "ATTACHED" : "OFF"}</span>
            </button>
          </div>

          {/* Role Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-950/90 border border-indigo-500/60 text-indigo-200 font-semibold shadow-xs"
                      : "bg-slate-950/70 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                  title={r.desc}
                >
                  <Icon className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Telemetry Ribbon when attached */}
          {includeContext && activeMission && (
            <div className="px-2 py-1 rounded bg-slate-950/90 border border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-cyan-400 font-semibold truncate">
                {activeMission.rocket} · {activeMission.target_orbit}
              </span>
              <span className="text-slate-500 whitespace-nowrap">
                Δv: {activeMission.delta_v} km/s · {activeMission.payload_mass} kg
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isBot = msg.role === "assistant";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isBot ? "items-start" : "items-start flex-row-reverse"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-mono font-bold ${
                    isBot
                      ? msg.isError
                        ? "bg-rose-950 text-rose-300 border border-rose-800"
                        : "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/30"
                      : "bg-slate-800 text-cyan-300 border border-slate-700"
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`group relative max-w-[85%] rounded-2xl p-3.5 space-y-1.5 shadow-sm ${
                    isBot
                      ? msg.isError
                        ? "bg-rose-950/40 border border-rose-800 text-rose-200"
                        : "bg-slate-900/90 border border-slate-800 text-slate-200"
                      : "bg-cyan-600 text-slate-950 font-medium"
                  }`}
                >
                  {/* Meta Bar */}
                  <div
                    className={`flex items-center justify-between gap-4 text-[10px] font-mono ${
                      isBot ? "text-slate-500" : "text-cyan-950 font-semibold"
                    }`}
                  >
                    <span>{isBot ? msg.model || "Gemini" : "You"}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Body Content with simple formatting */}
                  <div className="font-sans whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Copy Button */}
                  {isBot && !msg.isError && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => copyToClipboard(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer flex items-center gap-1 text-[10px] font-mono"
                        title="Copy message to clipboard"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-start text-xs">
              <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-cyan-950/90 border border-cyan-800 text-cyan-400">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 text-slate-400 font-mono text-xs">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>Gemini is analyzing telemetry &amp; calculating...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompt Chips */}
        <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/40 shrink-0">
          <div className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">
            Suggested Queries
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="px-2 py-1 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] font-sans text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer text-left disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Send Area */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0">
          <div className="relative rounded-xl border border-slate-800 bg-slate-900/90 focus-within:border-cyan-500/60 transition-colors">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Gemini about trajectory, QAOA circuit, or re-entry..."
              disabled={isLoading}
              className="w-full px-3 py-2.5 text-xs text-white placeholder-slate-500 bg-transparent resize-none focus:outline-hidden font-sans"
            />
            <div className="px-3 pb-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Shift+Enter for newline</span>
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  input.trim() && !isLoading
                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm shadow-cyan-500/30"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span>Send</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
