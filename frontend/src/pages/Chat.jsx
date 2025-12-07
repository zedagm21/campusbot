import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import GradeTabs from "../components/GradeTabs";
import ProfileDropdown from "../components/ProfileDropdown";
import MobileSidebar from "../components/MobileSidebar";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import SearchSuggestionsList from "../components/SearchSuggestionsList";

const STORAGE_KEY = "campusbot_sessionId";

export default function Chat({ token, onLogout }) {
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [gradeHistory, setGradeHistory] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const [portalStatus, setPortalStatus] = useState("disconnected");

  const listRef = useRef();
  const inputRef = useRef();
  const [inputPosition, setInputPosition] = useState(null);
  const navigate = useNavigate();

  // Update input position when suggestions become visible
  useEffect(() => {
    if (isSuggestionsVisible && inputRef.current) {
      const updatePosition = () => {
        const rect = inputRef.current.getBoundingClientRect();
        setInputPosition({
          top: rect.bottom, // Use viewport coordinates (fixed positioning)
          left: rect.left,
          width: rect.width,
        });
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isSuggestionsVisible]);

  // Scroll to bottom on new message
  useEffect(() => {
    listRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Load saved sessionId
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSessionId(Number(saved));

    // Load saved grade history
    const savedHistory = localStorage.getItem("gradeHistory");
    if (savedHistory) {
      try {
        setGradeHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load grade history:", e);
      }
    }
  }, []);

  // Fetch portal status
  useEffect(() => {
    if (!token) return;

    async function fetchPortalStatus() {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const res = await axios.get(`${API_URL}/api/settings/portal/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPortalStatus(res.data.connected ? "active" : "disconnected");
      } catch (err) {
        console.error("Failed to fetch portal status:", err);
        setPortalStatus("disconnected");
      }
    }

    fetchPortalStatus();
  }, [token]);

  // Load all sessions on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async function loadSessions() {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const res = await axios.get(`${API_URL}/api/chat/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        const sess = res.data.sessions || [];
        setSessions(sess);

        if (isCreatingNew) {
          setHistory([]);
          return;
        }

        const saved = sessionId;
        if (saved && sess.some((x) => x.id === saved)) {
          await loadSession(saved);
        } else if (sess.length > 0) {
          await loadSession(sess[0].id);
        } else {
          setSessionId(null);
          setHistory([]);
        }
      } catch (err) {
        console.error("Failed to load sessions:", err);
        if (err.response?.status === 401) {
          onLogout();
          navigate("/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function upsertAndMoveSessionToTop({ id, title, preview, started_at }) {
    setSessions((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      const top = {
        id,
        title: title ?? prev.find((p) => p.id === id)?.title ?? null,
        preview: preview ?? prev.find((p) => p.id === id)?.preview ?? "",
        started_at: started_at ?? new Date().toISOString(),
      };
      return [top, ...filtered];
    });
  }

  function setActiveSessionWithoutReorder({ id, title, preview, started_at }) {
    setSessionId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    setIsCreatingNew(false);

    setSessions((prev) => {
      const found = prev.find((p) => p.id === id);
      if (!found) {
        const top = {
          id,
          title: title ?? null,
          preview: preview ?? "",
          started_at: started_at ?? new Date().toISOString(),
        };
        return [top, ...prev];
      }
      return prev.map((p) =>
        p.id === id
          ? {
            ...p,
            title: title ?? p.title,
            preview: preview ?? p.preview,
            started_at: started_at ?? p.started_at,
          }
          : p
      );
    });
  }

  async function loadSession(id) {
    if (!token || !id) return;
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const r = await axios.get(
        `${API_URL}/api/chat/sessions/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const sid = r.data.sessionId;
      const stitle = r.data.sessionTitle ?? null;

      const mapped = (r.data.messages || []).map((m) => ({
        sender: m.sender,
        text: m.text,
        time: m.created_at,
      }));

      setHistory(mapped);

      const lastMsg = mapped.length
        ? mapped[mapped.length - 1].text
        : "No messages yet";

      setActiveSessionWithoutReorder({
        id: sid,
        title: stitle,
        preview: lastMsg,
        started_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to load session messages:", err);
      if (err.response?.status === 401) {
        onLogout();
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshSessions() {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const res = await axios.get(`${API_URL}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(res.data.sessions || []);
    } catch (err) {
      console.error("Failed to refresh sessions:", err);
    }
  }

  async function send(text = msg) {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const r = await axios.post(
        `${API_URL}/api/chat`,
        { message: text, sessionId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const replyText = r.data.reply;
      const returnedSessionId = r.data.sessionId;
      const returnedSessionTitle = r.data.sessionTitle ?? null;

      setHistory((h) => [
        ...h,
        { sender: "user", text: text },
        { sender: "bot", text: replyText },
      ]);
      setMsg("");

      if (returnedSessionId) {
        setSessionId(returnedSessionId);
        localStorage.setItem(STORAGE_KEY, String(returnedSessionId));
      }

      if (isCreatingNew && returnedSessionId) setIsCreatingNew(false);

      const preview = replyText || text;
      upsertAndMoveSessionToTop({
        id: returnedSessionId,
        title: returnedSessionTitle,
        preview,
        started_at: new Date().toISOString(),
      });

      refreshSessions();

      // Check if this is a grade-related query and save to history
      const gradeKeywords = ["grade", "gpa", "semester", "year", "result", "score", "mark"];
      const isGradeQuery = gradeKeywords.some(keyword =>
        text.toLowerCase().includes(keyword)
      );

      if (isGradeQuery && replyText && !replyText.includes("error") && !replyText.includes("failed")) {
        const newHistoryItem = {
          id: Date.now(),
          title: text.length > 40 ? text.substring(0, 40) + "..." : text,
          query: text,
          response: replyText,
          timestamp: new Date().toISOString()
        };

        setGradeHistory(prev => {
          // Keep only last 5 items
          const updated = [newHistoryItem, ...prev].slice(0, 5);
          // Save to localStorage
          localStorage.setItem("gradeHistory", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.error("[send] error", e.response?.data || e);
      alert(e.response?.data?.error || "Error sending message");
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setIsCreatingNew(true);
    setSessionId(null);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    setIsMobileSidebarOpen(false); // Close mobile sidebar
  }

  async function deleteSession(id) {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      await axios.delete(`${API_URL}/api/chat/sessions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        setSessionId(null);
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Failed to delete chat");
    }
  }

  async function updateTitle(id) {
    const title = editTitle.trim();
    if (!title) {
      alert("Title cannot be empty");
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      await axios.patch(
        `${API_URL}/api/chat/sessions/${id}`,
        { title },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title } : s))
      );
      setEditingId(null);
      setEditTitle("");
    } catch (err) {
      console.error("Failed to update title:", err);
      alert("Failed to rename chat");
    }
  }

  async function handlePortalLogin(username, password) {
    await send(`login ${username} ${password}`);
    // Refresh portal status after login
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const res = await axios.get(`${API_URL}/api/settings/portal/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPortalStatus(res.data.connected ? "active" : "disconnected");
    } catch (err) {
      console.error("Failed to refresh portal status:", err);
    }
  }

  // Load grade history item into chat
  function loadGradeHistory(historyItem) {
    setHistory([
      { sender: "user", text: historyItem.query, time: historyItem.timestamp },
      { sender: "bot", text: historyItem.response, time: historyItem.timestamp }
    ]);
    setActiveTab("chat");
    setIsMobileSidebarOpen(false);
  }

  // Sidebar Content Component
  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
        {!isSidebarCollapsed && (
          <h2 className="font-bold text-gray-700 dark:text-gray-200">Conversations</h2>
        )}
        <div className="flex gap-2">
          {!isSidebarCollapsed && (
            <button
              onClick={refreshSessions}
              className="text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
              title="Refresh"
            >
              ↻
            </button>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
            title={isSidebarCollapsed ? "Show Menu" : "Hide Menu"}
          >
            {isSidebarCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={newChat}
          className="w-full py-2 px-4 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium rounded-md shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          title="New Chat"
        >
          <span>+</span>
          {!isSidebarCollapsed && "New Chat"}
        </button>
      </div>



      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.length === 0 && (
          <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
            No conversations yet
          </div>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group relative p-3 rounded-md cursor-pointer transition-colors duration-200 ${s.id === sessionId
              ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-600 dark:border-blue-400"
              : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            onClick={() => {
              loadSession(s.id);
              setIsMobileSidebarOpen(false); // Close mobile sidebar on selection
            }}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                {editingId === s.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateTitle(s.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="w-full text-sm p-1 border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {s.title || new Date(s.started_at).toLocaleString()}
                  </h3>
                )}

                {!editingId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                    {s.preview || "No messages yet"}
                  </p>
                )}
              </div>

              <div className="hidden group-hover:flex items-center gap-1 ml-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded px-1 absolute right-2 top-2 shadow-sm">
                {editingId === s.id ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTitle(s.id);
                      }}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 p-1 cursor-pointer"
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(s.id);
                        setEditTitle(s.title || "");
                      }}
                      className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 cursor-pointer"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(s.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 cursor-pointer"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "lg:w-16" : "lg:w-64"
        }`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      >
        <SidebarContent />
      </MobileSidebar>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-w-0 h-screen">
        {/* Header */}
        <header className="h-16 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-800 shadow-sm z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu - Mobile Only */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              aria-label="Open menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center text-white font-bold">
              CB
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
              CampusBot
            </h1>
          </div>

          {/* Profile Dropdown */}
          <ProfileDropdown
            onLogout={onLogout}
            onOpenPortalSettings={() => setIsAuthModalOpen(true)}
            token={token}
          />
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">

          {activeTab === "chat" ? (
            <>
              {/* Two-Stage Input Positioning */}
              {history.length === 0 ? (
                /* STAGE 1: Centered Input (Empty Chat - Onboarding) */
                <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
                  <div className="w-full max-w-3xl">
                    <div className="relative" ref={inputRef}>
                      <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400 focus-within:border-transparent transition-all">
                        <textarea
                          value={msg}
                          onChange={(e) => setMsg(e.target.value)}
                          onFocus={() => setIsSuggestionsVisible(true)}
                          onBlur={() => {
                            setTimeout(() => setIsSuggestionsVisible(false), 200);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              send();
                              setIsSuggestionsVisible(false);
                            }
                          }}
                          placeholder={
                            loading
                              ? "CampusBot is thinking..."
                              : "Ask about your grades, courses, or schedule..."
                          }
                          className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 px-2 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                          rows={1}
                          disabled={loading}
                        />
                        <button
                          onClick={() => send()}
                          disabled={loading || !msg.trim()}
                          className={`p-2 rounded-lg transition-colors ${loading || !msg.trim()
                            ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700 shadow-sm"
                            }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5"
                          >
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-center mt-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        CampusBot can make mistakes. Double check important info.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* STAGE 2: Fixed Bottom Input (Active Conversation) */
                <>
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-32 space-y-6">
                    {history.map((m, i) => (
                      <div
                        key={i}
                        className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} group relative`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 sm:px-5 py-3 shadow-sm relative ${m.sender === "user"
                            ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-br-none"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none"
                            }`}
                        >
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-1">
                            {m.text}
                          </div>

                          {/* Copy Button - Inside Bubble */}
                          <div className={`flex ${m.sender === "user" ? "justify-end" : "justify-end"} mt-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button
                              onClick={() => navigator.clipboard.writeText(m.text)}
                              className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ${m.sender === "user" ? "text-teal-100" : "text-gray-400 dark:text-gray-500"
                                }`}
                              title="Copy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={listRef} />
                  </div>

                  {/* Fixed Input */}
                  <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-20">
                    <div className="max-w-4xl mx-auto">
                      <div className="relative" ref={inputRef}>
                        <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-teal-500 dark:focus-within:ring-teal-400 focus-within:border-transparent transition-all">
                          <textarea
                            value={msg}
                            onChange={(e) => setMsg(e.target.value)}
                            onFocus={() => {
                              // Suggestions only in empty chat
                              if (history.length === 0) {
                                setIsSuggestionsVisible(true);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => setIsSuggestionsVisible(false), 200);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                                setIsSuggestionsVisible(false);
                              }
                            }}
                            placeholder={
                              loading
                                ? "CampusBot is thinking..."
                                : "Ask about your grades, courses, or schedule..."
                            }
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 px-2 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                            rows={1}
                            disabled={loading}
                          />
                          <button
                            onClick={() => send()}
                            disabled={loading || !msg.trim()}
                            className={`p-2 rounded-lg transition-all ${loading || !msg.trim()
                              ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                              : "bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700 shadow-sm"
                              }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="text-center mt-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          CampusBot can make mistakes. Double check important info.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center px-4">
                <p className="text-lg font-medium mb-2">Grade History View</p>
                <p className="text-sm">This feature is coming soon!</p>
                <button
                  onClick={() => setActiveTab("chat")}
                  className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  Return to Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Search Suggestions - Only show on empty chat (onboarding) */}
      {history.length === 0 && inputPosition && isSuggestionsVisible && (
        <div
          style={{
            position: 'fixed',
            top: inputPosition.top,
            left: inputPosition.left,
            width: inputPosition.width,
            maxHeight: `calc(100vh - ${inputPosition.top}px - 20px)`,
            zIndex: 9999,
          }}
        >
          <SearchSuggestionsList
            isVisible={isSuggestionsVisible}
            onSelectSuggestion={(suggestion) => {
              setMsg(suggestion);
              setIsSuggestionsVisible(false);
            }}
          />
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handlePortalLogin}
        status={portalStatus}
        onStatusChange={(newStatus) => setPortalStatus(newStatus)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSessionToDelete(null);
        }}
        onConfirm={() => {
          if (sessionToDelete) {
            deleteSession(sessionToDelete);
          }
          setIsDeleteModalOpen(false);
          setSessionToDelete(null);
        }}
      />
    </div>
  );
}
